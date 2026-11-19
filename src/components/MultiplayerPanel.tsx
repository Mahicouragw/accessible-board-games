"use client";

// 🌐 Multiplayer tab — rules, random online matchmaking, invites by NAME,
// online players list, and local multiplayer on this device (2 or 4 players).

import Link from "next/link";
import OnlinePlayers from "@/components/OnlinePlayers";
import { GAMES } from "@/lib/games";

const ONLINE_GAMES = GAMES.filter((g) => g.online);
const LOCAL_MULTI = GAMES.filter((g) => ["ludo", "snake-ladder", "carrom"].includes(g.id));

const RULES = [
  "🎯 Pick a game → 🎲 Random match: you join the queue and the match starts automatically when another player picks Random for the same game.",
  "✉️ Or invite a friend by their NAME (from Players Online or the invite box in the game) — they get a notification and tap Accept & Play.",
  "🔔 All invites (games, rooms, friend requests) appear in the 🔔 Notifications tab.",
  "📱 Local multiplayer: Ludo, Snake & Ladder and Carrom can be played by 2 or 4 players on THIS device — pass the phone around.",
  "🤖 No one online? Every game also has vs AI (works fully offline).",
  "🗄️ Everything (accounts, chat, matches, invites, scores, custom sounds) is stored in the real cloud database — log in with your Player ID on any device.",
];

export default function MultiplayerPanel() {
  return (
    <div className="space-y-4">
      {/* Rules */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">📜 Multiplayer Rules</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      {/* Random online matches */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🎲 Random Match (online players)</h3>
        <p className="mt-1 text-xs text-slate-500">Open a game and tap “🎲 Random match — online players”. Two random players get matched automatically.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ONLINE_GAMES.map((g) => (
            <Link
              key={g.id}
              href={`/play/${g.id}`}
              className={`rounded-2xl bg-gradient-to-r ${g.color} px-4 py-3 text-sm font-bold text-white transition hover:opacity-90`}
            >
              {g.emoji} {g.name} 🎲
            </Link>
          ))}
        </div>
      </section>

      {/* Local multiplayer on this device */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">📱 Local Multiplayer (2 or 4 players on this device)</h3>
        <p className="mt-1 text-xs text-slate-500">Open the game and choose players — pass the device after each turn.</p>
        <div className="mt-3 flex flex-wrap gap-2">
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

      {/* Online players with invite-by-name + add friend */}
      <OnlinePlayers />
    </div>
  );
}
