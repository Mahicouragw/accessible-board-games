"use client";

// 🌐 Multiplayer tab — ONLINE MULTIPLAYER ONLY:
// random matchmaking, challenge online players by NAME, send friend requests,
// open private 1-to-1 chats, and your list of private chats.
// (vs AI and local pass-and-play live inside each game / the 👥 Local Multi tab.)

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import OnlinePlayers from "@/components/OnlinePlayers";
import { GAMES } from "@/lib/games";

const ONLINE_GAMES = GAMES.filter((g) => g.online);

const RULES = [
  "🎯 Pick a game → 🎲 Random match: you join the queue and the match starts automatically when another player picks Random for the same game.",
  "✉️ Or challenge a player by their NAME (from Players Online below) — they get a notification and tap Accept & Play.",
  "💬 Chat: open a private 1-to-1 chat with any online player — your chats are listed below.",
  "👫 Friend requests are sent from Players Online — accepted friends show up in 🔔 Notifications.",
  "🚪 For bigger parties (up to 24 members + spectators) use the 🚪 Rooms tab.",
  "🗄️ Everything (accounts, chat, matches, invites, scores, custom sounds) is stored in the real cloud database — log in with your Player ID on any device.",
];

type ChatRoom = {
  id: number;
  code: string;
  hostName: string;
  members: { id: number; name: string; avatar: string }[];
};

export default function MultiplayerPanel() {
  const { player } = useSession();
  const [chats, setChats] = useState<ChatRoom[]>([]);

  // 💬 My private chats = open rooms with game "chat" that include me.
  useEffect(() => {
    if (!player) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/rooms");
        const data = await res.json();
        if (!active) return;
        const mine = (data.rooms ?? []).filter(
          (r: ChatRoom & { game: string }) =>
            r.game === "chat" && (r.members ?? []).some((m) => m.id === player.id),
        );
        setChats(mine);
      } catch {
        /* offline */
      }
    };
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 6000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player]);

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
        <h3 className="text-lg font-bold">🎲 Random Match (online players only)</h3>
        <p className="mt-1 text-xs text-slate-500">Open a game and tap “🎲 Random match — online players”, or pick a game here. Two random online players get matched automatically.</p>
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

      {/* 🎮 Every game — open any of them and choose vs AI / local / online inside the game */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🎮 All games (incl. Snake &amp; Ladder, Carrom, Ludo…)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Open a game and pick your mode inside: 🌐 online (random/invite), 🤖 vs AI, or 👥 local pass-and-play.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <Link
              key={g.id}
              href={`/play/${g.id}`}
              className={`rounded-2xl bg-gradient-to-r ${g.color} px-3 py-2 text-xs font-bold text-white transition hover:opacity-90`}
            >
              {g.emoji} {g.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Online players with challenge-by-name + friend request + private chat */}
      <OnlinePlayers />

      {/* My private chats */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">💬 My private chats</h3>
        {chats.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No chats yet — tap 💬 next to an online player above to start one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {chats.map((r) => {
              const other = r.members.find((m) => m.id !== player?.id);
              return (
                <li key={r.id}>
                  <Link
                    href={`/rooms/${r.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-slate-800/60 p-3 transition hover:bg-slate-800"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-lg">
                      {other?.avatar ?? "💬"}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">
                      {other ? `Chat with ${other.name}` : `Private chat (${r.code})`}
                    </span>
                    <span className="text-xs font-bold text-sky-400">Open 💬</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
