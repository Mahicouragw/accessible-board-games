/**
 * PointerGestureRecognizer — binds a GestureClassifier to a DOM element using
 * the Pointer Events API.
 *
 * Isolation rules implemented here:
 *  - Listeners attach ONLY to the game surface element (never to window), so a
 *    game recognizer can never see hub/world input.
 *  - When the owning context is active and a gesture is consumed (any non-tap
 *    gesture, or a tap with a registered handler on a non-interactive target),
 *    the native event is stopPropagation()'d at the surface: it never bubbles
 *    to window/document-level ("world") handlers. The manager also tags it via
 *    markConsumed() so capture-phase world guards can identify it.
 *  - Taps on interactive controls (button/a/input/[role=button]/[tabindex]) are
 *    NEVER consumed or delayed: native click and Android TalkBack double-tap
 *    activation keep working exactly as before.
 *  - Consumed gestures suppress the synthetic click (capture-phase click
 *    guard) so a swipe can never "click" a control underneath.
 *  - touch-action is set on the surface element only (scoped — global scrolling
 *    and accessibility navigation are untouched).
 *  - Pointer capture is used for continuous interactions (hold/drag), and
 *    pointercancel / lostpointercapture / blur release everything safely.
 */

import { GestureClassifier, type ClassifierThresholds } from "./classifier";
import type { GestureManager } from "./manager";
import type { GestureEvent } from "./types";

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [role="gridcell"], [tabindex], label, summary';

export interface RecognizerOptions {
  manager: GestureManager;
  /** Context id that owns this surface, e.g. "game:chess". */
  contextId: string;
  thresholds?: Partial<ClassifierThresholds>;
  /**
   * Selector for elements that own their own pointer handling (e.g. the Carrom
   * canvas). Gestures starting on these elements are ignored by this
   * recognizer so the element's own handlers stay in charge.
   */
  ignoreSelector?: string;
  /** "none" locks all panning/zooming on the surface; "pan-y" allows vertical
   *  page scroll but keeps horizontal swipes for the game. Default "pan-y". */
  touchAction?: "none" | "pan-y";
  /** Called for each emitted gesture; defaults to manager.dispatch. */
  onGesture?: (g: GestureEvent) => boolean;
}

export class PointerGestureRecognizer {
  private el: HTMLElement;
  private opts: RecognizerOptions;
  private classifier: GestureClassifier;
  private disposed = false;
  private activePointerId: number | null = null;
  private passthrough = false; // current pointer started on an interactive control
  private selfOwned = false; // current pointer started on an ignoreSelector element
  private suppressClickUntil = 0;
  private prevTouchAction: string | null = null;

  private onPointerDown = (e: PointerEvent) => this.handleDown(e);
  private onPointerMove = (e: PointerEvent) => this.handleMove(e);
  private onPointerUp = (e: PointerEvent) => this.handleUp(e);
  private onPointerCancel = (e: PointerEvent) => this.handleCancel(e);
  private onLostCapture = (e: PointerEvent) => this.handleCancel(e);
  private onClickCapture = (e: MouseEvent) => {
    if (this.disposed) return;
    if (Date.now() < this.suppressClickUntil) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  private onContextMenu = (e: Event) => {
    if (this.disposed) return;
    if (this.activePointerId !== null) {
      // Long-press on touch must not open the context menu inside a game.
      e.preventDefault();
    }
  };

  constructor(el: HTMLElement, opts: RecognizerOptions) {
    this.el = el;
    this.opts = opts;
    this.prevTouchAction = el.style.touchAction;
    el.style.touchAction = opts.touchAction ?? "pan-y";

    this.classifier = new GestureClassifier({
      thresholds: opts.thresholds,
      hasDoubleTapHandler: () => {
        const map = opts.manager.getHandlers(opts.contextId);
        return !!map?.["double-tap"];
      },
      isInteractiveTarget: (t) =>
        t instanceof Element && !!t.closest(INTERACTIVE_SELECTOR),
      inBounds: (x, y) => {
        const r = el.getBoundingClientRect();
        return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24;
      },
      emit: (g) => this.handleGesture(g),
    });

    el.addEventListener("pointerdown", this.onPointerDown as EventListener, { passive: false });
    el.addEventListener("pointermove", this.onPointerMove as EventListener, { passive: false });
    el.addEventListener("pointerup", this.onPointerUp as EventListener, { passive: false });
    el.addEventListener("pointercancel", this.onPointerCancel as EventListener, { passive: false });
    el.addEventListener("lostpointercapture", this.onLostCapture as EventListener);
    el.addEventListener("click", this.onClickCapture as EventListener, { capture: true });
    el.addEventListener("contextmenu", this.onContextMenu as EventListener, { passive: false });
  }

  private ownsContext(): boolean {
    return this.opts.manager.isActive(this.opts.contextId);
  }

  private handleDown(e: PointerEvent) {
    if (this.disposed || !this.ownsContext()) return;
    if (this.activePointerId !== null) {
      // second finger: release the first safely
      this.classifier.releaseAll(e);
      this.activePointerId = null;
    }
    const target = e.target;
    this.selfOwned =
      !!this.opts.ignoreSelector &&
      target instanceof Element &&
      !!target.closest(this.opts.ignoreSelector);
    this.passthrough =
      target instanceof Element && !!target.closest(INTERACTIVE_SELECTOR);
    this.activePointerId = e.pointerId;
    if (this.selfOwned) return; // element owns its own pointer handling
    // Pointer capture keeps move/up flowing to us for continuous gestures.
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    this.classifier.down(e.pointerId, e.clientX, e.clientY, e.target, e);
  }

  private handleMove(e: PointerEvent) {
    if (this.disposed || !this.ownsContext()) return;
    if (e.pointerId !== this.activePointerId || this.selfOwned) return;
    this.classifier.move(e.pointerId, e.clientX, e.clientY, e);
  }

  private handleUp(e: PointerEvent) {
    if (this.disposed || !this.ownsContext()) return;
    if (e.pointerId !== this.activePointerId || this.selfOwned) return;
    this.classifier.up(e.pointerId, e.clientX, e.clientY, e);
    this.activePointerId = null;
    // A consumed tap on a non-interactive surface must not become a click.
    if (this.lastGestureConsumed && !this.passthrough) {
      this.suppressClickUntil = Date.now() + 600;
    }
    this.passthrough = false;
    this.selfOwned = false;
  }

  private handleCancel(e: PointerEvent) {
    if (this.disposed) return;
    if (e.pointerId !== this.activePointerId) return;
    this.classifier.cancel(e.pointerId, e);
    this.activePointerId = null;
    this.passthrough = false;
    this.selfOwned = false;
  }

  private lastGestureConsumed = false;

  private handleGesture(g: GestureEvent): void {
    if (this.disposed || !this.ownsContext()) return;
    if (this.selfOwned) return;
    const consumed = (this.opts.onGesture ?? ((ev) => this.opts.manager.dispatch(ev)))(g);
    this.lastGestureConsumed = consumed;
    const native = g.originalEvent;
    // Isolation: a gesture owned by the active game context must not reach
    // world/hub-level (window/document) handlers. Press-like gestures that
    // started on an interactive control (button etc.) are never stopped, so
    // native click and TalkBack double-tap activation keep working. Swipes
    // and drags are always contained, even if they start on a control.
    const pressLike =
      g.type === "tap" ||
      g.type === "double-tap" ||
      g.type === "long-press" ||
      g.type.startsWith("hold");
    const mayContain = !(pressLike && this.passthrough);
    if (native && (consumed || g.type !== "tap") && mayContain) {
      try {
        native.stopPropagation();
      } catch {
        /* noop */
      }
      this.opts.manager.markConsumed(native);
      if (g.type.startsWith("swipe") || g.type.startsWith("drag") || g.type === "long-press") {
        if (native.cancelable) {
          try {
            native.preventDefault();
          } catch {
            /* noop */
          }
        }
        this.suppressClickUntil = Date.now() + 600;
      }
    }
  }

  /** Release any in-flight gesture (pause/exit/blur). Nothing stays stuck. */
  release() {
    this.classifier.releaseAll();
    this.activePointerId = null;
    this.passthrough = false;
    this.selfOwned = false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    const el = this.el;
    el.removeEventListener("pointerdown", this.onPointerDown as EventListener);
    el.removeEventListener("pointermove", this.onPointerMove as EventListener);
    el.removeEventListener("pointerup", this.onPointerUp as EventListener);
    el.removeEventListener("pointercancel", this.onPointerCancel as EventListener);
    el.removeEventListener("lostpointercapture", this.onLostCapture as EventListener);
    el.removeEventListener("click", this.onClickCapture as EventListener, { capture: true } as EventListenerOptions);
    el.removeEventListener("contextmenu", this.onContextMenu as EventListener);
    if (this.prevTouchAction === null || this.prevTouchAction === "") el.style.removeProperty("touch-action");
    else el.style.touchAction = this.prevTouchAction;
  }
}
