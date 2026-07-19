"use client";

// Wallet chip for the PlayVerse fair-reward economy — coins 🪙, gems 💎,
// streak 🔥 — plus a once-a-day free chest. Fully screen-reader friendly:
// balance changes announce themselves through the shared a11y live region.

import { useEffect, useState } from "react";
import {
  claimDailyChest,
  getRewards,
  subscribeRewards,
  type Rewards,
} from "@/lib/rewards";

export default function RewardsBadge() {
  const [r, setR] = useState<Rewards>(getRewards());

  useEffect(() => subscribeRewards(() => setR(getRewards())), []);

  const today = new Date().toISOString().slice(0, 10);
  const claimed = r.lastDaily === today;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-500/30 bg-slate-900 px-4 py-3"
      role="group"
      aria-label={`Rewards wallet: ${r.coins} coins, ${r.gems} gems, best streak ${r.bestStreak}`}
    >
      <span className="text-lg" aria-hidden>
        🪙
      </span>
      <span className="text-sm font-bold text-amber-300" aria-live="polite">
        {r.coins}
      </span>
      <span className="text-lg" aria-hidden>
        💎
      </span>
      <span className="text-sm font-bold text-cyan-300">{r.gems}</span>
      {r.streak > 1 && (
        <span className="text-xs font-bold text-orange-400" aria-label={`win streak ${r.streak}`}>
          🔥{r.streak}
        </span>
      )}
      <button
        onClick={claimDailyChest}
        disabled={claimed}
        aria-label={claimed ? "Daily chest already claimed today" : "Claim daily chest of 25 coins"}
        className={`ml-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
          claimed
            ? "cursor-not-allowed bg-slate-800 text-slate-500"
            : "bg-amber-500 text-slate-950 hover:bg-amber-400"
        }`}
      >
        {claimed ? "✓ Claimed" : "🎁 Daily +25"}
      </button>
    </div>
  );
}
