"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { GAMES } from "@/lib/games";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type OnlineP = {
  id: number;
  name: string;
  code: string;
  avatar: string;
  wins: number;
  losses: number;
  xp: number;
};

const ONLINE_GAMES = GAMES.filter((g) => g.online);

export default function OnlinePlayers() {
  const { player } = useSession();
  const router = useRouter();
  const [players, setPlayers] = useState<OnlineP[]>([]);
  const [picking, setPicking] = useState<string | null>(null); // by NAME
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/players/online?exclude=${player?.code ?? ""}`);
        const data = await res.json();
        if (active) setPlayers(data.players ?? []);
      } catch {
        /* ignore */
      }
      try {
        const fRes = await fetch(`/api/friends?code=${player?.code ?? ""}`);
        const fData = await fRes.json();
        if (active) {
          setFriends(new Set((fData.friends ?? []).map((f: { name: string }) => f.name.toLowerCase())));
          setPending(new Set((fData.pending ?? []).map((f: { name: string }) => f.name.toLowerCase())));
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(() => {
      if (document.hidden) return; // battery: no polling in background tabs
      load();
    }, 6000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player]);

  async function challenge(opponentName: string, game: string) {
    if (!player || sending) return;
    setSending(true);
    setMsg(null);
    sound.play("click");
    try {
      const res = await fetch("/api/match/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", opponentName, game }),
      });
      const data = await res.json();
      if (data.match) {
        announce(`Challenge sent to ${opponentName}. They will accept in their Notifications tab.`);
        router.push(`/play/${game}?match=${data.match.id}`);
      } else if (data.error) {
        setMsg(data.error);
        announce(data.error);
      }
    } finally {
      setSending(false);
      setPicking(null);
    }
  }

  async function openChat(name: string) {
    if (!player || sending) return;
    setSending(true);
    setMsg(null);
    sound.play("click");
    try {
      const res = await fetch("/api/dm/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player.code, toName: name }),
      });
      const data = await res.json();
      if (data.room) {
        announce(`Private chat with ${name} opened.`);
        router.push(`/rooms/${data.room.id}`);
      } else if (data.error) {
        setMsg(data.error);
        announce(data.error);
      }
    } finally {
      setSending(false);
    }
  }

  async function addFriend(name: string) {
    if (!player) return;
    sound.play("click");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player.code, toName: name }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg(`Friend request sent to ${name}. They'll see it in 🔔 Notifications.`);
        announce(`Friend request sent to ${name}`);
        setPending((s) => new Set(s).add(name.toLowerCase()));
      } else if (data.error) {
        setMsg(data.error);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">🟢 Players Online</h3>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
          {players.length} online
        </span>
      </div>

      {msg && (
        <p className="mt-3 rounded-xl bg-slate-800 px-3 py-2 text-sm text-sky-300" role="status">
          {msg}
        </p>
      )}

      {players.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No one else is online right now. Invite a friend to log in, then challenge them by NAME, open a 💬 private chat, or send a friend request so they appear in your 🔔 Notifications.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {players.map((p) => {
            const isFriend = friends.has(p.name.toLowerCase());
            const isPending = pending.has(p.name.toLowerCase());
            return (
              <li key={p.id} className="rounded-2xl bg-slate-800/60 p-3">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-xl">
                    {p.avatar}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-400">
                      {p.wins}W · {p.losses}L · {p.xp} XP
                    </div>
                  </div>
                  <button
                    onClick={() => addFriend(p.name)}
                    disabled={isFriend || isPending}
                    className="rounded-xl border border-violet-500/60 px-3 py-2 text-xs font-bold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-40"
                    title="Send a friend request by name"
                  >
                    {isFriend ? "👫 Friend" : isPending ? "⏳ Sent" : "➕ Friend"}
                  </button>
                  <button
                    onClick={() => openChat(p.name)}
                    disabled={sending}
                    className="rounded-xl border border-emerald-500/60 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                    title="Open a private 1-to-1 chat"
                  >
                    💬 Chat
                  </button>
                  <button
                    onClick={() => setPicking(picking === p.name ? null : p.name)}
                    className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
                  >
                    Play ▶
                  </button>
                </div>

                {picking === p.name && (
                  <div className="mt-3 border-t border-slate-700 pt-3">
                    <div className="mb-2 text-xs text-slate-400">
                      Challenge <b className="text-sky-400">{p.name}</b> to a game (invite by name):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ONLINE_GAMES.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => challenge(p.name, g.id)}
                          disabled={sending}
                          className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-600 disabled:opacity-50"
                        >
                          <span>{g.emoji}</span>
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Invite by name even when the friend is offline */}
      <div className="mt-4 border-t border-slate-800 pt-4">
        <div className="text-sm font-bold">✉️ Invite a player by NAME</div>
        <NameInvite onChallenge={challenge} sending={sending} />
      </div>
    </div>
  );
}

function NameInvite({
  onChallenge,
  sending,
}: {
  onChallenge: (opponentName: string, game: string) => void;
  sending: boolean;
}) {
  const [name, setName] = useState("");
  const [game, setGame] = useState<string>(ONLINE_GAMES[0]?.id ?? "tic-tac-toe");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Friend's name (e.g. Asha)"
        aria-label="Friend's name to invite"
        className="w-48 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
      />
      <select
        value={game}
        onChange={(e) => setGame(e.target.value)}
        aria-label="Game to invite them to"
        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
      >
        {ONLINE_GAMES.map((g) => (
          <option key={g.id} value={g.id}>
            {g.emoji} {g.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => name.trim() && onChallenge(name.trim(), game)}
        disabled={sending || !name.trim()}
        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        Send invite ✉️
      </button>
    </div>
  );
}
