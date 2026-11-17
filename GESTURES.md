# 🎮 Context-Aware Gesture System

One centralized, context-aware gesture manager (`src/lib/gesture/`) gives every
mini-game its own isolated gesture controls. Game gestures can never trigger
hub/world ("RPG exploration") input, and world input never fires inside a game.

## The rule

Exactly **one** gesture context is active at any moment:

| Screen | Active context |
| --- | --- |
| Arcade dashboard / rooms (the "world") | `hub` |
| Any mini-game in the Game Hall | `game:<gameId>` |

Lifecycle: `hub → enter game → game:<id> activated (hub suspended) → play →
leave game → game controller disposed → hub restored`. Switching directly
between two games fully retires the first game controller — two game
controllers are never active at once.

## How isolation works (root cause fix)

Previously, window-level listeners (e.g. arrow-key handlers in Snake/2048)
answered input no matter which screen was showing, and nothing stopped pointer
events inside a game from bubbling to global handlers. Now:

1. `GestureManager` (`manager.ts`) owns a context stack. `dispatch()` routes a
   gesture **only to the active controller**. `activate()` suspends the
   previous context; `deactivate()` restores it.
2. `PointerGestureRecognizer` (`recognizer.ts`) attaches **only to the game
   surface element** using Pointer Events (`pointerdown/move/up/cancel` +
   `lostpointercapture`, `setPointerCapture`). Consumed gestures
   (swipes/drags/long-press/consumed taps) are `stopPropagation()`'d at the
   surface and tagged via `markConsumed()`, so window/document-level
   ("world") handlers never see them. Taps on interactive controls
   (`button/a/input/[role=button]/…`) are **never** stopped, so native click
   and Android TalkBack double-tap activation keep working in both modes.
3. A capture-phase guard tags every pointer/touch event with its owning
   context; world handlers must check `allowsGlobalInput()` (hub only), game
   window-listeners check `allowsContextInput("game:<id>")` — this is how the
   existing Snake/2048 arrow-key listeners are gated.
4. Global safety: `blur`, tab-hidden (`visibilitychange`) and `pointercancel`
   call `releaseAll()` — a cancelled hold/drag, pause, blur or game exit
   always emits a cancelled `hold-end`/`drag-end`, so nothing stays stuck.
   `touch-action` is set on the game surface element only (never globally).

## Gesture vocabulary (`classifier.ts`)

`tap`, `double-tap`, `long-press`, `hold-start` / `hold` / `hold-end`
(press-and-hold is continuous, not a single tap), `swipe-left/right/up/down`,
`drag-start` / `drag` / `drag-end`. When a game registers a `double-tap`
handler, single taps are delayed by the double-tap window, so a double-tap
never also fires a tap (no accidental TalkBack double-activation).

## Adding gestures to a game

1. In `profiles.ts` add/extend the game's profile: gestures + spoken
   instructions in **English, Telugu, Hindi** (announced once on entry).
2. In the game component call:
   ```ts
   useGameGestureHandlers("snake", {
     "swipe-left": () => turn(-1, 0),
     tap: () => start(),
   });
   ```
3. The play page (`/play/[game]`) automatically wraps every game in a
   `.gesture-surface` and activates `game:<gameId>` — no other wiring needed.
4. Put `data-gesture-lock="all"` on boards that need swipes in all directions
   (local `touch-action: none`).

## Future games (Car Racing, Blackjack, …)

`controllers.ts` ships ready-made factories: `createRacingControls()`
(hold = accelerate continuously with pointer capture, swipe = steer, tap =
brake, double-tap only for the explicitly assigned action) and
`createCardTableControls()` (tap actions + TalkBack-friendly double-tap).
Add the game id to `profiles.ts`, register the controller map with
`useGameGestureHandlers(gameId, map)`, and isolation applies automatically.

## Tests

```
node tests/gestures.test.js   # 54 checks: classifier, manager lifecycle,
                              # isolation, recognizer, racing semantics
node tests/stepMove.test.js   # existing board-move sync tests
```

Both TalkBack ON (aria-live announcements + labelled controls + double-tap
activation on focused controls) and TalkBack OFF (native taps, holds, swipes,
drags) are supported in every game.
