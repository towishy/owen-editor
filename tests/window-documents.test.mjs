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

function createHost() {
  const mainWindow = {};
  const mainDocument = { defaultView: mainWindow };
  mainWindow.document = mainDocument;
  const listeners = new Map();
  const unload = [];
  const workspace = {
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
  new Function("module", "exports", "activeDocument", outputFiles[0].text)(module, module.exports, mainDocument);
  return {
    plugin,
    workspace,
    mainDocument,
    register: module.exports.registerWindowDocuments,
    emit(name, ...args) {
      for (const { callback } of listeners.get(name) ?? []) callback(...args);
    },
    unload() {
      for (let index = unload.length - 1; index >= 0; index -= 1) unload[index]();
    }
  };
}

test("attaches existing main and popout documents once despite multiple leaves and layout events", () => {
  const host = createHost();
  const popout = { defaultView: {} };
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
