/**
 * GestureManager — the single, centralized, context-aware gesture authority.
 *
 * Root cause this fixes: previously any window-level listener (keyboard,
 * pointer, click) could react to input no matter which screen was showing, so a
 * game gesture could be interpreted as world/hub input and vice versa. Now:
 *
 *  - Exactly ONE context is active at a time ("hub" or "game:<id>").
 *  - Activating a game context SUSPENDS the hub controller; leaving the game
 *    DEACTIVATES the game controller and RESTORES the hub controller.
 *  - Only the active controller receives gestures (dispatch()).
 *  - Pointer events that start inside the active game surface are tagged as
 *    game-owned (capture-phase guard) so any world-level handler can check
 *    `isGameEvent(e)` / `allowsGlobalInput(...)` and ignore them; consumed
 *    gestures are additionally stopped at the surface by the recognizer.
 *  - Global safety guards (blur, tab hidden, pointercancel at window capture)
 *    call releaseAll() on the active controller so holds/drags never stick.
 */

import type {
  GestureController,
  GestureEvent,
  GestureHandlerMap,
} from "./types";
import { HUB_CONTEXT_ID, gameContextId } from "./types";

const EVENT_CONTEXT = "__arcadeGestureContext";
const CONSUMED = "__arcadeGestureConsumed";

export class GestureManager {
  private static instance: GestureManager | null = null;

  private controllers = new Map<string, GestureController>();
  /** Stack of context ids; the LAST entry is the active one. */
  private stack: string[] = [];
  private handlers = new Map<string, GestureHandlerMap>();
  private surface: HTMLElement | null = null;
  private guardsInstalled = false;
  private eventContext = new WeakMap<object, string>();
  private consumedEvents = new WeakSet<object>();

  static get(): GestureManager {
    if (!GestureManager.instance) {
      GestureManager.instance = new GestureManager();
      // The hub ("world") controller is always registered as the base context.
      GestureManager.instance.register({
        id: HUB_CONTEXT_ID,
        kind: "hub",
        onGesture: () => false,
        releaseAll: () => {},
      });
    }
    return GestureManager.instance;
  }

  // ---------- registry ----------

  register(controller: GestureController) {
    this.controllers.set(controller.id, controller);
  }

  unregister(id: string) {
    if (this.activeId === id) this.deactivate(id);
    this.controllers.delete(id);
    this.handlers.delete(id);
  }

  // ---------- activation lifecycle ----------

  get activeId(): string | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  get active(): GestureController | null {
    const id = this.activeId;
    return id ? this.controllers.get(id) ?? null : null;
  }

  /** The active GAME id, or null when the hub/world is active. */
  get activeGameId(): string | null {
    const c = this.active;
    return c && c.kind === "game" ? c.gameId ?? null : null;
  }

  isActive(id: string): boolean {
    return this.activeId === id;
  }

  isGameActive(): boolean {
    return this.active?.kind === "game";
  }

  /**
   * Activate a context. The previously active context is suspended first, so
   * two controllers are NEVER active at once. If another GAME context is
   * active, it is fully deactivated (released + removed from the stack) before
   * the new one activates — game controllers never overlap. The hub stays on
   * the stack underneath and is re-activated when the game is left.
   * Returns false for unknown ids.
   */
  activate(id: string): boolean {
    const controller = this.controllers.get(id);
    if (!controller) return false;
    if (this.activeId === id) return true;
    const prevId = this.activeId;
    if (prevId) {
      const prev = this.controllers.get(prevId);
      if (prev && prev.kind === "game" && controller.kind === "game") {
        // Never two game controllers at once: fully retire the previous game.
        this.stack.pop();
        prev.releaseAll?.();
        prev.onSuspend?.();
        prev.onDeactivate?.();
      } else {
        prev?.onSuspend?.();
      }
    }
    this.stack.push(id);
    controller.onActivate?.();
    this.syncSurfaceAttribute();
    this.installGuards();
    return true;
  }

  /**
   * Deactivate a context (e.g. leaving a game). The previous context on the
   * stack (normally the hub) is re-activated — restoring world controls.
   */
  deactivate(id: string): boolean {
    if (this.activeId !== id) return false;
    this.stack.pop();
    this.controllers.get(id)?.releaseAll?.();
    this.controllers.get(id)?.onDeactivate?.();
    const nextId = this.activeId;
    if (nextId) {
      this.controllers.get(nextId)?.onActivate?.();
    }
    this.syncSurfaceAttribute();
    return true;
  }

  // ---------- per-game gesture handlers (registered by mounted components) ----------

  setHandlers(contextId: string, map: GestureHandlerMap) {
    this.handlers.set(contextId, map);
  }

  clearHandlers(contextId: string) {
    this.handlers.delete(contextId);
  }

  getHandlers(contextId: string): GestureHandlerMap | undefined {
    return this.handlers.get(contextId);
  }

  /**
   * Route a gesture to the ACTIVE controller only. Returns true when the
   * gesture was consumed (a handler matched) and must not leak anywhere else.
   */
  private lastHoldGesture: GestureEvent | null = null;

  dispatch(g: GestureEvent): boolean {
    const controller = this.active;
    if (!controller) return false;
    if (g.type === "hold-start" || g.type === "hold") this.lastHoldGesture = g;
    let consumed = false;
    const map = this.handlers.get(controller.id);
    const handler = map?.[g.type];
    if (handler) {
      handler(g);
      consumed = true;
    }
    if (controller.onGesture?.(g)) consumed = true;
    return consumed;
  }

  /**
   * Release all held state on the active controller: continuous controls
   * (accelerator, drags) receive a cancelled hold-end / drag-end so nothing
   * stays stuck after pause, blur, pointercancel or leaving the game.
   */
  releaseAll() {
    this.active?.releaseAll?.();
    const map = this.active ? this.handlers.get(this.active.id) : undefined;
    if (this.lastHoldGesture && map?.["hold-end"]) {
      map["hold-end"]({ ...this.lastHoldGesture, cancelled: true });
    }
    this.lastHoldGesture = null;
  }

  // ---------- the active game surface ----------

  setActiveSurface(el: HTMLElement | null) {
    this.surface = el;
    this.syncSurfaceAttribute();
  }

  get activeSurface(): HTMLElement | null {
    return this.surface;
  }

  private syncSurfaceAttribute() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-gesture-context]").forEach((el) => {
      el.removeAttribute("data-gesture-active");
    });
    const el = this.surface;
    if (el) {
      el.setAttribute("data-gesture-context", this.activeId ?? "");
      el.setAttribute("data-gesture-active", "true");
    }
  }

  // ---------- event tagging / isolation guards ----------

  /** Tag a native event with the context that owns it (capture-phase guard). */
  tagEvent(e: Event) {
    const id = this.activeId;
    if (!id) return;
    this.eventContext.set(e, id);
    const target = e.target;
    if (
      this.active?.kind === "game" &&
      this.surface &&
      target instanceof Node &&
      this.surface.contains(target)
    ) {
      this.consumedEvents.add(e); // game-owned: world handlers must ignore it
    }
  }

  /** Mark a native event as consumed by the active game surface. */
  markConsumed(e: Event) {
    this.consumedEvents.add(e);
    const id = this.activeId;
    if (id) this.eventContext.set(e, id);
  }

  /** Context id that owns this event, if any. */
  getEventContext(e: Event): string | null {
    return this.eventContext.get(e) ?? null;
  }

  /** True when the event belongs to an active game surface (world must ignore). */
  isGameEvent(e: Event): boolean {
    if (!this.isGameActive()) return false;
    return this.consumedEvents.has(e);
  }

  /**
   * World/hub-level handlers (window keydown, pointer, etc.) MUST call this
   * first: global input is only delivered while the hub context is active, so
   * game gestures can never be interpreted as world movement and world input
   * never fires while a game is open.
   */
  allowsGlobalInput(): boolean {
    return this.activeId === HUB_CONTEXT_ID;
  }

  /** Game-level window listeners (e.g. Snake arrow keys) must check their own context. */
  allowsContextInput(contextId: string): boolean {
    return this.activeId === contextId;
  }

  // ---------- one-time global safety guards ----------

  installGuards() {
    if (this.guardsInstalled || typeof window === "undefined") return;
    this.guardsInstalled = true;

    // Tag every pointer/touch event with its owning context BEFORE any other
    // listener runs (capture phase). We never stopPropagation here — the game
    // surface's own handlers must still receive their events.
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "touchend", "touchcancel"]) {
      window.addEventListener(type, (e) => this.tagEvent(e), { capture: true, passive: true });
    }

    // Safety: releasing everything when the app loses focus or the tab hides —
    // no accelerator/hold/drag may stay stuck.
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
    window.addEventListener("pointercancel", () => this.releaseAll(), { capture: true });
  }
}

export const gestureManager = GestureManager.get();
export { HUB_CONTEXT_ID, gameContextId };
