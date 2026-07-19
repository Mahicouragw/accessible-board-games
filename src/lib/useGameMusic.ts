"use client";

import { useEffect } from "react";
import { sound } from "./sound";

/**
 * Gives every game its own background music theme.
 * Ludo → playful bounce, Snakes & Ladders → mysterious waltz,
 * Carrom → lounge, all other games → arcade hub tune.
 * The track switches only while the music toggle is ON (user's choice),
 * and returns to the hub theme when leaving the game.
 */
export function useGameMusic(gameId: string) {
  useEffect(() => {
    sound.setGameTheme(gameId);
    return () => sound.setGameTheme(null);
  }, [gameId]);
}
