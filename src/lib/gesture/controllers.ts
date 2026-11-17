/**
 * Ready-made game gesture controllers.
 *
 * These factories turn a GestureHandlerMap into the exact semantics a game
 * needs, on top of the shared GestureClassifier. They exist so that ANY game
 * added to the Game Hall (today or in the future) gets correct, isolated
 * gesture controls by registering one controller — e.g. a future Car Racing
 * game wires createRacingControls(...) and gets:
 *
 *  - press-and-hold accelerator (hold-start/hold/hold-end with pointer
 *    capture; releasing, leaving the area, pause, blur, pointercancel or
 *    exiting the game ALL stop acceleration — nothing stays stuck),
 *  - swipe left/right steering that can never move the RPG world,
 *  - single-tap brake with spoken confirmation,
 *  - double-tap reserved for an explicitly assigned action only (the
 *    classifier delays single taps when a double-tap handler is registered,
 *    so TalkBack-style double activation can't fire unrelated controls).
 *
 * Usage: pass the returned map to useGameGestureHandlers(gameId, map) inside
 * the game component, and the play page's gesture surface activates the
 * game context automatically.
 */

import type { GestureEvent, GestureHandlerMap } from "./types";

export interface RacingControls {
  /** Hold the accelerator: called continuously while held. */
  onAccelerate: (g: GestureEvent) => void;
  /** Acceleration stopped (finger up, cancel, blur, exit, left the area). */
  onAcceleratorRelease: (g: GestureEvent) => void;
  onSteerLeft: (g: GestureEvent) => void;
  onSteerRight: (g: GestureEvent) => void;
  /** Single tap on the brake control. */
  onBrake: (g: GestureEvent) => void;
  /** Optional explicitly-assigned double-tap action. */
  onDoubleTap?: (g: GestureEvent) => void;
}

/**
 * Car Racing gesture map: hold = accelerate continuously, swipe = steer,
 * tap = brake, double-tap only fires the explicitly assigned action.
 */
export function createRacingControls(c: RacingControls): GestureHandlerMap {
  let holding = false;
  return {
    "hold-start": (g) => {
      holding = true;
      c.onAccelerate(g);
    },
    hold: (g) => {
      if (holding) c.onAccelerate(g); // continuous while the finger stays down
    },
    "hold-end": (g) => {
      if (!holding) return;
      holding = false;
      c.onAcceleratorRelease(g); // release / cancel / blur / exit → always stops
    },
    "swipe-left": (g) => c.onSteerLeft(g),
    "swipe-right": (g) => c.onSteerRight(g),
    tap: (g) => c.onBrake(g),
    ...(c.onDoubleTap ? { "double-tap": (g) => c.onDoubleTap!(g) } : {}),
  };
}

export interface CardTableControls {
  onHit?: (g: GestureEvent) => void;
  onStand?: (g: GestureEvent) => void;
  onDoubleDown?: (g: GestureEvent) => void;
  onSplit?: (g: GestureEvent) => void;
  /** Tap a card to select/inspect it. */
  onCardTap?: (g: GestureEvent) => void;
  onDoubleTap?: (g: GestureEvent) => void;
}

/**
 * Blackjack-style gesture map: taps activate the focused action button;
 * double-tap is only delivered when explicitly assigned, so Android TalkBack
 * double-tap activation on a focused control never triggers unrelated actions.
 */
export function createCardTableControls(c: CardTableControls): GestureHandlerMap {
  return {
    tap: (g) => c.onCardTap?.(g),
    "double-tap": (g) => c.onDoubleTap?.(g),
    // Action buttons (Hit / Stand / Double Down / Split) are real buttons, so
    // their taps pass through natively and work with TalkBack double-tap.
    // Games can also bind swipe gestures to actions if they want, e.g.:
    // "swipe-up": (g) => c.onHit?.(g),
  };
}
