/**
 * Shared types for the context-aware gesture system.
 *
 * The whole app has exactly ONE active gesture context at any moment:
 *   - "hub"                 → the arcade dashboard / rooms (the "world" screen)
 *   - "game:<gameId>"       → a single mini-game opened from the Game Hall
 *
 * While a game context is active, every pointer gesture that starts inside the
 * game surface is owned by that game: it is consumed at the surface and can
 * never reach hub/world-level handlers (and vice versa).
 */

export type GestureType =
  | "tap"
  | "double-tap"
  | "long-press"
  | "hold-start"
  | "hold"
  | "hold-end"
  | "swipe-left"
  | "swipe-right"
  | "swipe-up"
  | "swipe-down"
  | "drag-start"
  | "drag"
  | "drag-end";

export type GestureKind = "hub" | "game";

export interface GestureEvent {
  type: GestureType;
  /** Pointer id that produced the gesture. */
  pointerId: number;
  /** Current pointer position (client coords). */
  x: number;
  y: number;
  /** Position where the pointer went down. */
  startX: number;
  startY: number;
  /** Total displacement from the start point. */
  dx: number;
  dy: number;
  /** ms between pointerdown and the event that finished the gesture. */
  durationMs: number;
  /** Original DOM target of the pointerdown. */
  target: EventTarget | null;
  /** The native event that produced this gesture (for stopPropagation etc.). */
  originalEvent: Event | null;
  /** True when the gesture was ended by pointercancel / blur / releaseAll. */
  cancelled?: boolean;
}

/** A named handler for one gesture type, registered by a mounted game. */
export type GestureHandler = (g: GestureEvent) => void;

export type GestureHandlerMap = Partial<Record<GestureType, GestureHandler>>;

/**
 * A gesture controller owns one context. Only the ACTIVE controller receives
 * gestures; activating a game controller suspends the hub controller and
 * deactivating it restores the hub controller.
 */
export interface GestureController {
  /** Unique context id, e.g. "hub" or "game:chess". */
  id: string;
  kind: GestureKind;
  /** Game id when kind === "game". */
  gameId?: string;
  onActivate?: () => void;
  /** Called when another context takes over (e.g. entering a game). */
  onSuspend?: () => void;
  onDeactivate?: () => void;
  /** Route a recognized gesture. Return true when the gesture was consumed. */
  onGesture?: (g: GestureEvent) => boolean;
  /** Drop every held/continuous state (pause, blur, pointercancel, exit). */
  releaseAll?: () => void;
}

export const HUB_CONTEXT_ID = "hub";
export const gameContextId = (gameId: string) => `game:${gameId}`;
