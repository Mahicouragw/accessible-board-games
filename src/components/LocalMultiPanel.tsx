"use client";

// 👥 Local Multi tab — pass-and-play games on THIS device (2 or 4 players).
// Multiplayer (online) lives in the 🌐 Multiplayer tab; this tab is local only.

import Link from "next/link";
import { GAMES } from "@/lib/games";

const LOCAL_MULTI = GAMES.filter((g) => ["ludo", "snake-ladder", "carrom", "dice-race"].includes(g.id));

export default function LocalMultiPanel() {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">📱 Local multiplayer — one device, 2 or 4 players</h3>
        <p className="mt-2 text-sm text-slate-400">
          Open a game below and choose “👥 2/4 players on this device”. Pass the phone after every turn —
          every move is announced out loud and a real sound plays, so everyone can follow along.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LOCAL_MULTI.map((g) => (
            <Link
              key={g.id}
              href={`/play/${g.id}`}
              className={`rounded-2xl bg-gradient-to-r ${g.color} px-4 py-3 text-sm font-bold text-white transition hover:opacity-90`}
            >
              {g.emoji} {g.name} 👥
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🤖 Prefer the computer?</h3>
        <p className="mt-2 text-sm text-slate-400">
          Every game in the 🎮 Games tab also has a built-in AI opponent — open the game and choose
          “🤖 Play vs AI”. No account or internet needed.
        </p>
      </section>
    </div>
  );
}
