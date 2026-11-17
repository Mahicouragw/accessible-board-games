/**
 * GestureClassifier — pure, DOM-free gesture recognition.
 *
 * Feed it pointer samples (down/move/up/cancel) with coordinates and it emits
 * classified gestures: tap, double-tap, long-press, hold-start/hold/hold-end,
 * swipe-left/right/up/down, drag-start/drag/drag-end.
 *
 * It is deliberately framework-free so it can be unit-tested in Node and reused
 * by any surface (Pointer Events recognizer in the browser, test harness, or a
 * future native bridge).
 *
 * Classification rules (all thresholds configurable):
 *  - A pointer that stays within `tapMaxDist` and is released within `tapMaxMs`
 *    is a tap. If the owner registered a double-tap handler, the single tap is
 *    delayed by `doubleTapMs` so a second tap turns it into "double-tap" and
 *    the single tap is NEVER emitted (no accidental double activation).
 *  - Holding still fires "hold-start" immediately on down, "hold" ticks while
 *    down, and "hold-end" on up/cancel — press-and-hold is continuous, not a
 *    single tap.
 *  - Moving beyond `tapMaxDist` starts a drag (hold-end is emitted first).
 *    On release, a fast long displacement is a swipe (dominant axis); a slow one
 *    is just drag-end.
 *  - Staying still past `longPressMs` fires "long-press" once.
 *  - cancel()/releaseAll() end every in-flight gesture with cancelled=true and
 *    clear all timers, so no hold/drag can ever remain "stuck".
 */

import type { GestureEvent, GestureHandlerMap, GestureType } from "./types";

export interface ClassifierThresholds {
  /** Max movement (px) for a press to still count as a tap. */
  tapMaxDist: number;
  /** Max duration (ms) for a press to still count as a tap. */
  tapMaxMs: number;
  /** Min displacement (px) for a release to count as a swipe. */
  swipeMinDist: number;
  /** Max duration (ms) for a displacement to count as a swipe (vs slow drag). */
  swipeMaxMs: number;
  /** ms of stillness before "long-press" fires. */
  longPressMs: number;
  /** ms window between two taps that makes a "double-tap". */
  doubleTapMs: number;
  /** ms between "hold" ticks while the pointer stays down. */
  holdTickMs: number;
}

export const DEFAULT_THRESHOLDS: ClassifierThresholds = {
  tapMaxDist: 12,
  tapMaxMs: 320,
  swipeMinDist: 48,
  swipeMaxMs: 650,
  longPressMs: 500,
  doubleTapMs: 300,
  holdTickMs: 60,
};

export interface ClassifierOptions {
  thresholds?: Partial<ClassifierThresholds>;
  /** Injectable clock (ms) — tests pass a fake. */
  now?: () => number;
  /** Called for every classified gesture. */
  emit: (g: GestureEvent) => void;
  /** True when the surface has a "double-tap" handler (enables tap delay). */
  hasDoubleTapHandler?: () => boolean;
  /** True when the pointerdown target is an interactive control (button etc.) —
   *  taps on interactive controls are never delayed/consumed so that native
   *  click and TalkBack double-tap activation keep working. */
  isInteractiveTarget?: (target: EventTarget | null) => boolean;
  /** Optional bounds check: when the pointer leaves the surface and this returns
   *  false, an active hold is ended (accelerator must not stay stuck). */
  inBounds?: (x: number, y: number) => boolean;
  /** End an active hold when the pointer leaves the bounds. Default true. */
  endHoldOnLeave?: boolean;
}

interface TrackedPointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  startTime: number;
  target: EventTarget | null;
  interactive: boolean;
  dragging: boolean;
  longPressFired: boolean;
  holdActive: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  holdTimer: ReturnType<typeof setInterval> | null;
  pendingTapTimer: ReturnType<typeof setTimeout> | null;
}

export class GestureClassifier {
  private th: ClassifierThresholds;
  private now: () => number;
  private emit: (g: GestureEvent) => void;
  private hasDoubleTapHandler: () => boolean;
  private isInteractiveTarget: (t: EventTarget | null) => boolean;
  private inBounds?: (x: number, y: number) => boolean;
  private endHoldOnLeave: boolean;
  private pointers = new Map<number, TrackedPointer>();
  private lastTap: { time: number; x: number; y: number } | null = null;
  /** Pointer whose single tap is pending the double-tap window. */
  private pendingTap: TrackedPointer | null = null;

  constructor(opts: ClassifierOptions) {
    this.th = { ...DEFAULT_THRESHOLDS, ...(opts.thresholds ?? {}) };
    this.now = opts.now ?? (() => Date.now());
    this.emit = opts.emit;
    this.hasDoubleTapHandler = opts.hasDoubleTapHandler ?? (() => false);
    this.isInteractiveTarget = opts.isInteractiveTarget ?? (() => false);
    this.inBounds = opts.inBounds;
    this.endHoldOnLeave = opts.endHoldOnLeave ?? true;
  }

  private emitGesture(
    p: TrackedPointer,
    type: GestureType,
    opts: { x?: number; y?: number; durationMs?: number; originalEvent?: Event | null; cancelled?: boolean } = {},
  ) {
    this.emit({
      type,
      pointerId: p.id,
      x: opts.x ?? p.x,
      y: opts.y ?? p.y,
      startX: p.startX,
      startY: p.startY,
      dx: (opts.x ?? p.x) - p.startX,
      dy: (opts.y ?? p.y) - p.startY,
      durationMs: opts.durationMs ?? this.now() - p.startTime,
      target: p.target,
      originalEvent: opts.originalEvent ?? null,
      cancelled: opts.cancelled,
    });
  }

  private clearTimers(p: TrackedPointer) {
    if (p.longPressTimer) clearTimeout(p.longPressTimer);
    if (p.holdTimer) clearInterval(p.holdTimer);
    if (p.pendingTapTimer) clearTimeout(p.pendingTapTimer);
    p.longPressTimer = p.holdTimer = p.pendingTapTimer = null;
  }

  private endHold(p: TrackedPointer, originalEvent: Event | null, cancelled = false) {
    if (!p.holdActive) return;
    p.holdActive = false;
    if (p.holdTimer) clearInterval(p.holdTimer);
    p.holdTimer = null;
    this.emitGesture(p, "hold-end", { originalEvent, cancelled });
  }

  /** pointerdown */
  down(id: number, x: number, y: number, target: EventTarget | null, originalEvent: Event | null) {
    // A second finger while one is tracked: release the old one safely first.
    if (this.pointers.size > 0) this.releaseAll(originalEvent);
    const interactive = this.isInteractiveTarget(target);
    const p: TrackedPointer = {
      id,
      startX: x,
      startY: y,
      x,
      y,
      startTime: this.now(),
      target,
      interactive,
      dragging: false,
      longPressFired: false,
      holdActive: false,
      longPressTimer: null,
      holdTimer: null,
      pendingTapTimer: null,
    };
    this.pointers.set(id, p);
    // Press-and-hold begins immediately and continuously — NOT as a single tap.
    p.holdActive = true;
    this.emitGesture(p, "hold-start", { originalEvent });
    p.holdTimer = setInterval(() => {
      if (this.pointers.get(id) === p && p.holdActive && !p.dragging) {
        this.emitGesture(p, "hold", { originalEvent });
      }
    }, this.th.holdTickMs);
    p.longPressTimer = setTimeout(() => {
      const cur = this.pointers.get(id);
      if (cur === p && !p.dragging && !p.longPressFired) {
        p.longPressFired = true;
        this.emitGesture(p, "long-press", { originalEvent });
      }
    }, this.th.longPressMs);
  }

  /** pointermove */
  move(id: number, x: number, y: number, originalEvent: Event | null) {
    const p = this.pointers.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    const dist = Math.hypot(x - p.startX, y - p.startY);
    if (!p.dragging && dist > this.th.tapMaxDist) {
      p.dragging = true;
      if (p.longPressTimer) clearTimeout(p.longPressTimer);
      p.longPressTimer = null;
      // Leaving tap territory: the hold becomes a drag.
      this.endHold(p, originalEvent);
      this.emitGesture(p, "drag-start", { originalEvent });
    }
    if (p.dragging) {
      this.emitGesture(p, "drag", { originalEvent });
    }
    if (
      this.endHoldOnLeave &&
      p.holdActive &&
      this.inBounds &&
      !this.inBounds(x, y)
    ) {
      this.endHold(p, originalEvent);
    }
  }

  /** pointerup */
  up(id: number, x: number, y: number, originalEvent: Event | null) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    const now = this.now();
    const durationMs = now - p.startTime;
    const dx = x - p.startX;
    const dy = y - p.startY;
    const dist = Math.hypot(dx, dy);
    this.clearTimers(p);

    if (p.dragging) {
      this.endHold(p, originalEvent);
      if (dist >= this.th.swipeMinDist && durationMs <= this.th.swipeMaxMs) {
        const type: GestureType =
          Math.abs(dx) >= Math.abs(dy)
            ? dx < 0
              ? "swipe-left"
              : "swipe-right"
            : dy < 0
              ? "swipe-up"
              : "swipe-down";
        this.emitGesture(p, type, { x, y, durationMs, originalEvent });
      } else {
        this.emitGesture(p, "drag-end", { x, y, durationMs, originalEvent });
      }
      this.lastTap = null;
      return;
    }

    // hold (no movement) ends here
    this.endHold(p, originalEvent);

    if (dist <= this.th.tapMaxDist && durationMs <= this.th.tapMaxMs && !p.longPressFired) {
      const isDoubleTap =
        this.lastTap !== null &&
        now - this.lastTap.time <= this.th.doubleTapMs &&
        Math.hypot(x - this.lastTap.x, y - this.lastTap.y) <= this.th.tapMaxDist * 2;

      if (isDoubleTap && this.hasDoubleTapHandler() && !p.interactive) {
        this.lastTap = null;
        // Cancel the FIRST tap's pending timer, then emit double-tap — the
        // single tap must never fire alongside the double-tap.
        if (this.pendingTap) {
          if (this.pendingTap.pendingTapTimer) clearTimeout(this.pendingTap.pendingTapTimer);
          this.pendingTap.pendingTapTimer = null;
          this.pendingTap = null;
        }
        this.emitGesture(p, "double-tap", { x, y, durationMs, originalEvent });
        return;
      }

      this.lastTap = { time: now, x, y };
      if (this.hasDoubleTapHandler() && !p.interactive) {
        // Delay the single tap so a following second tap becomes double-tap
        // and the single tap never fires (no accidental double activation).
        // The pending timer closes over p directly — the pointer is NOT kept
        // in the active map, so a second pointerdown is not treated as a
        // "second finger" and the double-tap window stays intact.
        p.pendingTapTimer = setTimeout(() => {
          p.pendingTapTimer = null;
          this.pendingTap = null;
          this.emitGesture(p, "tap", { x, y, durationMs, originalEvent });
        }, this.th.doubleTapMs);
        this.pendingTap = p;
      } else {
        this.emitGesture(p, "tap", { x, y, durationMs, originalEvent });
      }
    }
  }

  /** pointercancel / lostpointercapture / blur / explicit release */
  cancel(id: number, originalEvent: Event | null = null) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    if (this.pendingTap === p) {
      if (p.pendingTapTimer) clearTimeout(p.pendingTapTimer);
      p.pendingTapTimer = null;
      this.pendingTap = null;
    }
    const wasDragging = p.dragging;
    this.clearTimers(p);
    this.endHold(p, originalEvent, true);
    if (wasDragging) {
      this.emitGesture(p, "drag-end", { originalEvent, cancelled: true });
    }
    this.lastTap = null;
  }

  /** Release everything (app blur, tab hidden, game pause/exit). Nothing stays stuck. */
  releaseAll(originalEvent: Event | null = null) {
    for (const id of Array.from(this.pointers.keys())) this.cancel(id, originalEvent);
    if (this.pendingTap) {
      if (this.pendingTap.pendingTapTimer) clearTimeout(this.pendingTap.pendingTapTimer);
      this.pendingTap.pendingTapTimer = null;
      this.pendingTap = null;
    }
    this.lastTap = null;
  }

  get activePointerCount() {
    return this.pointers.size;
  }
}

/** Convenience: which gesture types a handler map cares about. */
export function handlerTypes(map: GestureHandlerMap): GestureType[] {
  return Object.keys(map) as GestureType[];
}
