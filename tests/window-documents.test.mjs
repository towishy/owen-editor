import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("../window-documents.ts", import.meta.url))],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false
});

function createHost(activeDocument) {
  const observers = [];
  const mainWindow = {
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        observers.push(this);
      }
      observe(target) { this.targets.push(target); }
      disconnect() { this.targets = []; }
    }
  };
  const mainDocument = { defaultView: mainWindow, body: {} };
  mainWindow.document = mainDocument;
  const listeners = new Map();
  const unload = [];
  const workspace = {
    rootSplit: { doc: mainDocument },
    leaves: [{ view: { containerEl: { doc: mainDocument } } }],
    on(name, callback) {
      const reference = { name, callback };
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(reference);
      return reference;
    },
    offref(reference) {
      listeners.get(reference.name)?.delete(reference);
    },
    iterateAllLeaves(callback) {
      this.leaves.forEach(callback);
    },
    onLayoutReady(callback) {
      this.ready = callback;
    }
  };
  const plugin = {
    app: { workspace },
    register(callback) {
      unload.push(callback);
    },
    registerEvent(reference) {
      unload.push(() => workspace.offref(reference));
    }
  };
  const module = { exports: {} };
  new Function("module", "exports", "activeDocument", outputFiles[0].text)(module, module.exports, activeDocument ?? mainDocument);
  return {
    plugin,
    workspace,
    mainDocument,
    observers,
    register: module.exports.registerWindowDocuments,
    emit(name, ...args) {
      for (const { callback } of listeners.get(name) ?? []) callback(...args);
    },
    unload() {
      for (let index = unload.length - 1; index >= 0; index -= 1) unload[index]();
    }
  };
}

test("excludes active settings windows unless explicitly opted in", () => {
  const settingsDocument = { defaultView: {} };
  settingsDocument.defaultView.document = settingsDocument;
  const host = createHost(settingsDocument);
  host.plugin.app.setting = { modalEl: { ownerDocument: settingsDocument } };
  const attached = [];
  host.register(host.plugin, (doc) => {
    attached.push(doc);
    return () => {};
  });
  host.workspace.ready();
  host.emit("layout-change");
  assert.deepEqual(attached, [host.mainDocument]);
  host.unload();
});

test("attaches existing main and popout documents once despite multiple leaves and layout events", () => {
  const host = createHost();
  const popout = { defaultView: {} };
  popout.defaultView.document = popout;
  host.workspace.leaves.push(...[popout, popout].map((doc) => ({ view: { containerEl: { doc } } })));
  const attached = [];
  host.register(host.plugin, (doc) => {
    attached.push(doc);
    return () => {};
  });
  host.workspace.ready();
  host.emit("layout-change");
  assert.deepEqual(attached, [host.mainDocument, popout]);
  host.unload();
});

test("attaches a newly opened popout and disposes its bindings when that window closes", () => {
  const host = createHost();
  const attached = new Set();
  const win = {};
  win.document = { defaultView: win };
  host.register(host.plugin, (doc) => {
    attached.add(doc);
    return () => attached.delete(doc);
  });
  host.emit("window-open", {}, win);
  assert.equal(attached.has(win.document), true);
  host.emit("window-close", {}, win);
  assert.deepEqual([...attached], [host.mainDocument]);
  host.emit("window-close", {}, win);
  host.unload();
  assert.equal(attached.size, 0);
});

test("unloading releases every window and unregisters future workspace events", () => {
  const host = createHost();
  const attached = new Set();
  host.register(host.plugin, (doc) => {
    attached.add(doc);
    return () => attached.delete(doc);
  });
  host.unload();
  const win = {};
  win.document = { defaultView: win };
  host.emit("window-open", {}, win);
  host.emit("layout-change");
  host.workspace.ready();
  assert.equal(attached.size, 0);
});

test("rejects documents without an owning window rather than using an unrelated global window", () => {
  const host = createHost();
  host.workspace.leaves.push({ view: { containerEl: { doc: { defaultView: null } } } });
  assert.throws(() => host.register(host.plugin, () => () => {}), /document without a window/);
  host.unload();
});

test("discovers adopted native settings documents without a workspace window-open event", async () => {
  const host = createHost();
  const modal = { ownerDocument: { defaultView: null } };
  host.plugin.app.setting = { modalEl: modal };
  const attached = new Set();
  host.register(host.plugin, doc => {
    attached.add(doc);
    return () => attached.delete(doc);
  }, { includeSettings: true });
  assert(host.observers[0].targets.includes(modal));
  const win = {};
  const document = { defaultView: win };
  win.document = document;
  modal.ownerDocument = document;
  host.observers[0].callback();
  host.observers[0].callback();
  await Promise.resolve();
  assert.equal(attached.has(document), true);
  win.closed = true;
  host.emit("layout-change");
  assert.equal(attached.has(document), false);
  modal.ownerDocument = host.mainDocument;
  host.observers[0].callback();
  await Promise.resolve();
  assert.equal(attached.has(document), false);
  host.unload();
  host.observers[0].callback();
  await Promise.resolve();
  assert.equal(attached.size, 0);
  assert.equal(host.observers[0].targets.length, 0);
});
