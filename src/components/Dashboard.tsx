"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { GAMES } from "@/lib/games";
import OnlinePlayers from "@/components/OnlinePlayers";
import RoomsBrowser from "@/components/RoomsBrowser";
import RewardsBadge from "@/components/RewardsBadge";

function level(xp: number) {
  return Math.floor(xp / 100) + 1;
}

export default function Dashboard() {
  const { player, logout } = useSession();
  if (!player) return null;

  const lvl = level(player?.xp ?? 0);
  const progress = player?.xp ?? 0 % 100;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-3xl font-black text-transparent">
            🎮 PlayVerse Arcade
          </h1>
          <p className="text-slate-400">Pick a game and jump in.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-2xl">
            {player?.avatar ?? "🎮"}
          </div>
          <div>
            <div className="font-semibold leading-tight">{player?.name ?? "Guest"}</div>
            <div className="font-mono text-xs text-emerald-400">ID: {player?.code ?? "GUEST"}</div>
          </div>
          <button
            onClick={logout}
            className="ml-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
        <RewardsBadge />
      </header>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Level" value={lvl} accent="text-violet-400" />
        <Stat label="Wins" value={player?.wins ?? 0} accent="text-emerald-400" />
        <Stat label="Losses" value={player?.losses ?? 0} accent="text-rose-400" />
        <Stat label="Draws" value={player?.draws ?? 0} accent="text-amber-400" />
        <Stat label="Games" value={player?.totalGames ?? 0} accent="text-sky-400" />
      </section>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2 flex justify-between text-sm text-slate-400">
          <span>Level {lvl}</span>
          <span>{player?.xp ?? 0} XP</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Live rooms */}
      <div className="mt-6">
        <RoomsBrowser />
      </div>

      {/* Online players */}
      <div className="mt-6">
        <OnlinePlayers />
      </div>

      {/* Games grid */}
      <h2 className="mt-8 text-xl font-bold">Choose a Game</h2>
      <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.id}
            href={`/play/${g.id}`}
            className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:shadow-2xl"
          >
            <div
              className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${g.color} opacity-20 blur-2xl transition group-hover:opacity-40`}
            />
            <div className="text-5xl">{g.emoji}</div>
            <h3 className="mt-4 text-lg font-bold">{g.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{g.tagline}</p>
            <div className="mt-4 flex items-center gap-2">
              {g.online && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                  Online / AI
                </span>
              )}
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                {g.scoreLabel}
              </span>
            </div>
            <div
              className={`mt-5 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r ${g.color} px-4 py-2 text-sm font-bold text-white`}
            >
              Play ▶
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
      <div className={`text-2xl font-black ${accent}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
