import { Plugin } from "obsidian";

const GRIP_HEIGHT = 44;
const MIN_VIEWPORT_HEIGHT = 64;

interface FrostedScrollbarInstance {
  viewport: HTMLElement;
  root: HTMLDivElement;
  rail: HTMLDivElement;
  grip: HTMLSpanElement;
  resizeObserver?: ResizeObserver;
  dragOffset: number;
  pointerId?: number;
  onScroll: () => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerEnd: (event: PointerEvent) => void;
}

function isVerticalScrollViewport(element: HTMLElement) {
  if (element.closest(".owen-editor-frosted-scroll-overlay")) return false;
  if (element.matches("input, select, textarea")) return false;
  const style = getComputedStyle(element);
  if (!/(auto|scroll|overlay)/.test(style.overflowY)) return false;
  const bounds = element.getBoundingClientRect();
  return bounds.width > 24
    && bounds.height >= MIN_VIEWPORT_HEIGHT
    && style.display !== "none"
    && style.visibility !== "hidden";
}

function overlayZIndex(viewport: HTMLElement) {
  let zIndex = 1;
  for (let element: HTMLElement | null = viewport; element; element = element.parentElement) {
    const value = Number.parseInt(getComputedStyle(element).zIndex, 10);
    if (Number.isFinite(value)) zIndex = Math.max(zIndex, value + 1);
  }
  return zIndex;
}

export function registerFrostedScrollbars(plugin: Plugin) {
  const instances = new Map<HTMLElement, FrostedScrollbarInstance>();
  const pendingRoots = new Set<Node>();
  let discoveryFrame: number | undefined;
  let syncFrame: number | undefined;

  const syncGrip = (instance: FrostedScrollbarInstance) => {
    const { viewport, root, rail, grip } = instance;
    if (!viewport.isConnected) return;
    const bounds = viewport.getBoundingClientRect();
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const visible = maxScroll > 0
      && bounds.width > 24
      && bounds.height >= MIN_VIEWPORT_HEIGHT
      && bounds.bottom > 0
      && bounds.right > 0
      && bounds.top < window.innerHeight
      && bounds.left < window.innerWidth;
    root.hidden = !visible;
    if (!visible) return;

    root.style.top = `${bounds.top}px`;
    root.style.left = `${bounds.left}px`;
    const paletteModal = root.classList.contains("mod-palette")
      ? viewport.closest<HTMLElement>(".owen-editor-palette-modal")
      : null;
    const overlayRight = paletteModal?.getBoundingClientRect().right ?? bounds.right;
    root.style.width = `${Math.max(bounds.width, overlayRight - bounds.left)}px`;
    root.style.height = `${bounds.height}px`;
    root.style.zIndex = String(overlayZIndex(viewport));
    const maxGripTravel = Math.max(0, rail.clientHeight - GRIP_HEIGHT);
    const ratio = maxScroll > 0 ? viewport.scrollTop / maxScroll : 0;
    grip.style.setProperty("--owen-frosted-grip-y", `${Math.max(0, ratio * maxGripTravel)}px`);
  };

  const scheduleSync = () => {
    if (syncFrame !== undefined) return;
    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = undefined;
      for (const [viewport, instance] of instances) {
        if (!viewport.isConnected) {
          instance.resizeObserver?.disconnect();
          viewport.removeEventListener("scroll", instance.onScroll);
          instance.root.remove();
          instances.delete(viewport);
          continue;
        }
        syncGrip(instance);
      }
    });
  };

  const scrollFromPointer = (instance: FrostedScrollbarInstance, clientY: number) => {
    const bounds = instance.rail.getBoundingClientRect();
    const maxGripTravel = Math.max(0, bounds.height - GRIP_HEIGHT);
    const gripY = Math.min(maxGripTravel, Math.max(0, clientY - bounds.top - instance.dragOffset));
    const maxScroll = Math.max(0, instance.viewport.scrollHeight - instance.viewport.clientHeight);
    instance.viewport.scrollTop = maxGripTravel > 0 ? (gripY / maxGripTravel) * maxScroll : 0;
    syncGrip(instance);
  };

  const createInstance = (viewport: HTMLElement) => {
    const root = document.createElement("div");
    root.className = "owen-frosted-scroll owen-editor-frosted-scroll-overlay";
    if (viewport.matches(".owen-editor-palette-content, .owen-editor-palette-rail-items")) {
      root.classList.add("mod-palette");
    }
    if (viewport.matches(".nav-files-container")) {
      root.classList.add("mod-file-explorer");
    }
    root.setAttribute("aria-hidden", "true");
    const rail = document.createElement("div");
    rail.className = "owen-frosted-scroll__rail";
    const grip = document.createElement("span");
    grip.className = "owen-frosted-scroll__grip";
    rail.appendChild(grip);
    root.appendChild(rail);
    document.body.appendChild(root);
    viewport.classList.add("owen-frosted-scroll__viewport", "owen-editor-frosted-scroll-viewport");

    const instance: FrostedScrollbarInstance = {
      viewport,
      root,
      rail,
      grip,
      dragOffset: GRIP_HEIGHT / 2,
      onScroll: () => syncGrip(instance),
      onPointerDown: (event) => {
        if (event.button !== 0) return;
        const bounds = grip.getBoundingClientRect();
        instance.dragOffset = event.target === grip
          ? Math.min(GRIP_HEIGHT, Math.max(0, event.clientY - bounds.top))
          : GRIP_HEIGHT / 2;
        instance.pointerId = event.pointerId;
        rail.dataset.active = "";
        rail.setPointerCapture?.(event.pointerId);
        scrollFromPointer(instance, event.clientY);
        event.preventDefault();
      },
      onPointerMove: (event) => {
        if (instance.pointerId === event.pointerId) scrollFromPointer(instance, event.clientY);
      },
      onPointerEnd: (event) => {
        if (instance.pointerId !== event.pointerId) return;
        instance.pointerId = undefined;
        delete rail.dataset.active;
        if (rail.hasPointerCapture?.(event.pointerId)) rail.releasePointerCapture?.(event.pointerId);
      }
    };
    viewport.addEventListener("scroll", instance.onScroll, { passive: true });
    rail.addEventListener("pointerdown", instance.onPointerDown);
    rail.addEventListener("pointermove", instance.onPointerMove);
    rail.addEventListener("pointerup", instance.onPointerEnd);
    rail.addEventListener("pointercancel", instance.onPointerEnd);
    instance.resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => syncGrip(instance));
    instance.resizeObserver?.observe(viewport);
    instances.set(viewport, instance);
    syncGrip(instance);
  };

  const discover = (root: Node) => {
    const elements: HTMLElement[] = [];
    if (root instanceof HTMLElement) elements.push(root);
    if (root instanceof Document || root instanceof DocumentFragment || root instanceof HTMLElement) {
      elements.push(...Array.from(root.querySelectorAll<HTMLElement>("*")));
    }
    for (const element of elements) {
      if (instances.has(element) || !isVerticalScrollViewport(element)) continue;
      createInstance(element);
    }
  };

  const scheduleDiscovery = (root: Node) => {
    pendingRoots.add(root);
    if (discoveryFrame !== undefined) return;
    discoveryFrame = window.requestAnimationFrame(() => {
      discoveryFrame = undefined;
      for (const pendingRoot of pendingRoots) discover(pendingRoot);
      pendingRoots.clear();
      scheduleSync();
    });
  };

  const mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      scheduleDiscovery(record.target);
      for (const node of Array.from(record.addedNodes)) scheduleDiscovery(node);
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  document.body.classList.add("owen-editor-frosted-scrollbars-active");
  document.addEventListener("scroll", scheduleSync, true);
  window.addEventListener("resize", scheduleSync);
  plugin.registerEvent(plugin.app.workspace.on("layout-change", () => scheduleDiscovery(document.body)));
  plugin.registerEvent(plugin.app.workspace.on("css-change", () => scheduleDiscovery(document.body)));
  scheduleDiscovery(document.body);

  plugin.register(() => {
    mutationObserver.disconnect();
    document.removeEventListener("scroll", scheduleSync, true);
    window.removeEventListener("resize", scheduleSync);
    if (discoveryFrame !== undefined) window.cancelAnimationFrame(discoveryFrame);
    if (syncFrame !== undefined) window.cancelAnimationFrame(syncFrame);
    document.body.classList.remove("owen-editor-frosted-scrollbars-active");
    for (const instance of instances.values()) {
      instance.resizeObserver?.disconnect();
      instance.viewport.removeEventListener("scroll", instance.onScroll);
      instance.rail.removeEventListener("pointerdown", instance.onPointerDown);
      instance.rail.removeEventListener("pointermove", instance.onPointerMove);
      instance.rail.removeEventListener("pointerup", instance.onPointerEnd);
      instance.rail.removeEventListener("pointercancel", instance.onPointerEnd);
      instance.viewport.classList.remove("owen-frosted-scroll__viewport", "owen-editor-frosted-scroll-viewport");
      instance.root.remove();
    }
    instances.clear();
  });
}
