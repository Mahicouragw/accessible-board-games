"use client";

/**
 * React bindings for the context-aware gesture system.
 *
 * Lifecycle (per screen):
 *
 *   Hub / Game Hall  →  activate "hub" context
 *   Enter a game     →  register "game:<id>" controller, activate it
 *                       (hub controller is suspended), attach a
 *                       PointerGestureRecognizer to the game surface,
 *                       announce the game's spoken instructions ONCE
 *   Leave the game   →  dispose recognizer, deactivate game controller,
 *                       unregister it, clear the surface → hub context is
 *                       restored automatically
 *
 * Only one context is ever active (enforced by GestureManager), so game
 * gestures can never reach world handlers and world input never fires inside
 * a game.
 */

import { useEffect, useRef, type RefObject } from "react";
import { announce } from "@/lib/a11y";
import { sound } from "@/lib/sound";
import { t } from "@/lib/i18n";
import { getGame } from "@/lib/games";
import { GestureManager, HUB_CONTEXT_ID, gameContextId } from "./manager";
import { PointerGestureRecognizer } from "./recognizer";
import { getGameProfile } from "./profiles";
import type { GestureController, GestureHandlerMap } from "./types";

/** Announce a game's control instructions once per entry, in the set language. */
function announceInstructions(gameId: string) {
  const profile = getGameProfile(gameId);
  const text = t(profile.instructions);
  announce(text); // TalkBack / aria-live
  sound.speak(text); // spoken narration (respects the voice setting)
}

/**
 * Activates the gesture context for one mini-game and attaches the pointer
 * recognizer to the given surface element. Call once in the play page.
 */
export function useGameGestureContext(gameId: string, surfaceRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!getGame(gameId)) return; // unknown game id (e.g. "not found" page): hub stays active
    const manager = GestureManager.get();
    const contextId = gameContextId(gameId);
    const controller: GestureController = {
      id: contextId,
      kind: "game",
      gameId,
      onGesture: (g) => manager.dispatch(g),
      releaseAll: () => manager.releaseAll(),
    };
    manager.register(controller);
    manager.activate(contextId); // suspends the hub controller
    const el = surfaceRef.current;
    manager.setActiveSurface(el);
    const recognizer = el
      ? new PointerGestureRecognizer(el, {
          manager,
          contextId,
          // The Carrom canvas owns its own pointer handling for aim/shoot.
          ignoreSelector: gameId === "carrom" ? "canvas" : undefined,
          touchAction: "pan-y",
        })
      : null;
    announceInstructions(gameId); // once, not during gameplay

    return () => {
      recognizer?.dispose();
      manager.deactivate(contextId); // restores the hub controller
      manager.unregister(contextId);
      if (manager.activeSurface === el) manager.setActiveSurface(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
}

/**
 * Activates the hub ("world") gesture context. Call once on the arcade
 * dashboard and room screens. While a game is open the hub controller is
 * suspended; returning here restores it.
 */
export function useHubGestureContext() {
  useEffect(() => {
    const manager = GestureManager.get();
    manager.activate(HUB_CONTEXT_ID);
    return () => {
      if (manager.isActive(HUB_CONTEXT_ID)) manager.deactivate(HUB_CONTEXT_ID);
    };
  }, []);
}

/**
 * Lets a mounted game component register its own gesture handlers for its
 * context ("game:<gameId>"). Handlers receive classified gestures; returning
 * them marks the gesture as consumed so it cannot leak to world handlers.
 * The latest handler map is always used (no stale closures).
 */
export function useGameGestureHandlers(gameId: string, handlers: GestureHandlerMap) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    const manager = GestureManager.get();
    const contextId = gameContextId(gameId);
    manager.setHandlers(contextId, new Proxy({} as GestureHandlerMap, {
      get: (_t, prop: string) => handlersRef.current[prop as keyof GestureHandlerMap],
    }) as GestureHandlerMap);
    return () => manager.clearHandlers(contextId);
  }, [gameId]);
}

/** Re-exported for convenience in game components. */
export { GestureManager, gameContextId, HUB_CONTEXT_ID };
