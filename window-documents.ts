import type { App, Plugin } from "obsidian";

export function registerWindowDocuments(
  plugin: Plugin,
  attach: (doc: Document) => () => void,
  options: { includeSettings?: boolean } = {}
) {
  const cleanups = new Map<Window, () => void>();
  const runtimeApp: App & { setting?: { modalEl?: HTMLElement } } = plugin.app;
  const hostDocument = plugin.app.workspace.rootSplit.doc;
  const hostWindow = hostDocument.defaultView;
  if (!hostWindow) throw new Error("Owen Editor cannot attach to a document without a window.");
  let disposed = false;
  let queued = false;
  let settingsElement: HTMLElement | undefined;
  const observer = new hostWindow.MutationObserver(() => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      discoverWindows();
    });
  });
  const observeHost = () => {
    if (options.includeSettings) observer.observe(hostDocument.body, {
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  };
  const attachDocument = (doc: Document) => {
    const win = doc.defaultView;
    if (!win) throw new Error("Owen Editor cannot attach to a document without a window.");
    if (win.closed) return;
    if (!cleanups.has(win)) cleanups.set(win, attach(doc));
  };
  const discoverWindows = () => {
    if (disposed) return;
    for (const [win, cleanup] of cleanups) {
      if (win.closed || !win.document?.defaultView) {
        cleanup();
        cleanups.delete(win);
      }
    }
    attachDocument(hostDocument);
    plugin.app.workspace.iterateAllLeaves((leaf) => attachDocument(leaf.view.containerEl.doc));
    // Settings popouts are modal windows, not workspace "window-open" events.
    const modal = options.includeSettings ? runtimeApp.setting?.modalEl : undefined;
    if (modal && modal !== settingsElement) {
      observer.disconnect();
      observeHost();
      observer.observe(modal, { childList: true, subtree: true });
      settingsElement = modal;
    }
    if (modal?.ownerDocument.defaultView) attachDocument(modal.ownerDocument);
  };

  plugin.registerEvent(plugin.app.workspace.on("window-open", (_workspaceWindow, win) => attachDocument(win.document)));
  plugin.registerEvent(plugin.app.workspace.on("window-close", (_workspaceWindow, win) => {
    cleanups.get(win)?.();
    cleanups.delete(win);
  }));
  plugin.registerEvent(plugin.app.workspace.on("layout-change", discoverWindows));
  plugin.registerEvent(plugin.app.workspace.on("css-change", discoverWindows));
  plugin.register(() => {
    disposed = true;
    observer.disconnect();
    for (const cleanup of cleanups.values()) cleanup();
    cleanups.clear();
  });
  plugin.app.workspace.onLayoutReady(discoverWindows);
  observeHost();
  discoverWindows();
}
