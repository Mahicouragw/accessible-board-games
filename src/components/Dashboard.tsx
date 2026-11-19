"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { GAMES } from "@/lib/games";
import RoomsBrowser from "@/components/RoomsBrowser";
import RewardsBadge from "@/components/RewardsBadge";
import MultiplayerPanel from "@/components/MultiplayerPanel";
import LocalMultiPanel from "@/components/LocalMultiPanel";
import NotificationsPanel from "@/components/NotificationsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import QuickA11y from "@/components/QuickA11y";
import { useHubGestureContext } from "@/lib/gesture/useGameGestures";

function level(xp: number) {
  return Math.floor(xp / 100) + 1;
}

type Tab = "home" | "games" | "multiplayer" | "local" | "ai" | "rooms" | "notifications" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "games", label: "Games", icon: "🎮" },
  { id: "multiplayer", label: "Multiplayer", icon: "🌐" },
  { id: "local", label: "Local Multi", icon: "👥" },
  { id: "ai", label: "Vs AI", icon: "🤖" },
  { id: "rooms", label: "Rooms", icon: "🚪" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

/** Live count of pending game/room invites + friend requests (for the 🔔 badge). */
function useNotificationCount(code: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!code) return;
    let active = true;
    const load = async () => {
      try {
        const [m, r, f] = await Promise.all([
          fetch(`/api/match/invites?code=${code}`).then((x) => x.json()),
          fetch(`/api/rooms/invites?code=${code}`).then((x) => x.json()),
          fetch(`/api/friends?code=${code}`).then((x) => x.json()),
        ]);
        if (active) {
          setCount(
            (m.invites ?? []).length + (r.invites ?? []).length + (f.pending ?? []).length,
          );
        }
      } catch {
        /* offline */
      }
    };
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 8000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [code]);
  return count;
}

export default function Dashboard() {
  const { player, logout } = useSession();
  const [tab, setTab] = useState<Tab>("home");
  useHubGestureContext();
  const notifCount = useNotificationCount(player?.code);
  if (!player) return null;

  const lvl = level(player?.xp ?? 0);
  const progress = (player?.xp ?? 0) % 100;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-3xl font-black text-transparent">
            🎮 PlayVerse Arcade
          </h1>
          <p className="text-slate-400">Pick a tab — everything is one tap away.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-2xl">
            {player?.avatar ?? "🎮"}
          </div>
          <div>
            <div className="font-semibold leading-tight">{player?.name ?? "Guest"}</div>
            <div className="font-mono text-xs text-emerald-400">ID: {player?.code ?? "GUEST"}</div>
          </div>
          <RewardsBadge />
        </div>
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

      {/* Tabs */}
      <nav
        className="sticky top-0 z-40 mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/95 p-1 backdrop-blur"
        role="tablist"
        aria-label="Arcade sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === t.id
                ? "bg-gradient-to-r from-sky-500 to-violet-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.id === "notifications" && notifCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-black text-white">
                {notifCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="mt-6" role="tabpanel">
        {tab === "home" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">👋 Welcome, {player?.name ?? "Guest"}!</h2>
              <p className="mt-2 text-sm text-slate-400">
                🎮 <b>Games</b> — pick any game; each one can be played vs the AI right inside the game.
                🌐 <b>Multiplayer</b> — see who&apos;s online, challenge them by name, chat privately, send friend requests.
                👥 <b>Local Multi</b> — 2 or 4 players on this one device, pass-and-play.
                🚪 <b>Rooms</b> — create a room (up to 24 members + spectators), pick a game, play together.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setTab("games")} className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white">🎮 Browse games</button>
                <button onClick={() => setTab("multiplayer")} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white">🌐 Multiplayer</button>
                <button onClick={() => setTab("rooms")} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-bold text-white">🚪 Rooms</button>
                <a href="https://accessible-board-games.vercel.app" target="_blank" rel="noreferrer" className="rounded-xl border border-sky-700 bg-sky-500/15 px-4 py-2.5 text-sm font-semibold text-sky-300 hover:bg-sky-500/30">🌐 Live site ↗</a>
              </div>
            </section>
            <QuickA11y />
          </div>
        )}
        {tab === "games" && (
          <>
            <h2 className="text-xl font-bold">Choose a Game</h2>
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

            {/* Tools */}
            <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href="https://accessible-board-games.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-emerald-600"
              >
                <div className="text-2xl">🌐</div>
                <div className="mt-1 font-bold">Live site ↗</div>
                <div className="text-xs text-slate-400">accessible-board-games.vercel.app — share with friends to play online</div>
              </a>
            </section>
          </>
        )}

        {tab === "multiplayer" && <MultiplayerPanel />}
        {tab === "local" && <LocalMultiPanel />}
        {tab === "ai" && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold">🤖 Play vs the AI — every game</h2>
            <p className="mt-1 text-sm text-slate-400">
              Every game in the arcade has a built-in computer opponent — Memory Match, Hand Cricket, Chess,
              Snake &amp; Ladder, Carrom, Ludo and more. Open a game and choose “🤖 Play vs AI”. Works fully offline,
              and every move is announced out loud with real sounds.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GAMES.map((g) => (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-800/50 p-4 transition hover:border-violet-500"
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <div>
                    <div className="font-bold">{g.name}</div>
                    <div className="text-xs text-violet-300">🤖 vs AI available</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {tab === "rooms" && <RoomsBrowser />}
        {tab === "notifications" && <NotificationsPanel />}
        {tab === "settings" && <SettingsPanel />}
      </div>

      <p className="mt-8 text-center text-xs text-slate-600">
        Logged in as {player?.name} ({player?.code}) ·{" "}
        <button onClick={logout} className="underline hover:text-slate-400">Log out</button>
      </p>
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
