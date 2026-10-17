import type { Plugin } from "obsidian";

export function registerWindowDocuments(plugin: Plugin, attach: (doc: Document) => () => void) {
  const cleanups = new Map<Window, () => void>();
  let disposed = false;
  const attachDocument = (doc: Document) => {
    const win = doc.defaultView;
    if (!win) throw new Error("Owen Editor cannot attach to a document without a window.");
    if (!cleanups.has(win)) cleanups.set(win, attach(doc));
  };
  const discoverWindows = () => {
    if (disposed) return;
    attachDocument(activeDocument);
    plugin.app.workspace.iterateAllLeaves((leaf) => attachDocument(leaf.view.containerEl.doc));
  };

  plugin.registerEvent(plugin.app.workspace.on("window-open", (_workspaceWindow, win) => attachDocument(win.document)));
  plugin.registerEvent(plugin.app.workspace.on("window-close", (_workspaceWindow, win) => {
    cleanups.get(win)?.();
    cleanups.delete(win);
  }));
  plugin.registerEvent(plugin.app.workspace.on("layout-change", discoverWindows));
  plugin.register(() => {
    disposed = true;
    for (const cleanup of cleanups.values()) cleanup();
    cleanups.clear();
  });
  plugin.app.workspace.onLayoutReady(discoverWindows);
  discoverWindows();
}
