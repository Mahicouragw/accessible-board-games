"use client";

import { useCallback } from "react";
import { useSession } from "@/lib/session";

export function useSaveScore(game: string) {
  const { player, refresh } = useSession();
  return useCallback(
    async (score: number, meta?: unknown) => {
      if (!player) return;
      try {
        await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: player?.code ?? "", game, score, meta }),
        });
        refresh();
      } catch {
        // ignore
      }
    },
    [player, game, refresh],
  );
}
