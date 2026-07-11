"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { GAMES } from "@/lib/games";
import { sound } from "@/lib/sound";

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
  const [picking, setPicking] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
    };
    load();
    const iv = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player]);

  async function challenge(opponentCode: string, game: string) {
    if (!player || sending) return;
    setSending(true);
    sound.play("click");
    try {
      const res = await fetch("/api/match/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", opponentCode, game }),
      });
      const data = await res.json();
      if (data.match) {
        router.push(`/play/${game}?match=${data.match.id}`);
      }
    } finally {
      setSending(false);
      setPicking(null);
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

      {players.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No one else is online right now. Invite a friend to log in and challenge them!
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {players.map((p) => (
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
                  onClick={() => setPicking(picking === p.code ? null : p.code)}
                  className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
                >
                  Play ▶
                </button>
              </div>

              {picking === p.code && (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <div className="mb-2 text-xs text-slate-400">Pick a game to challenge:</div>
                  <div className="flex flex-wrap gap-2">
                    {ONLINE_GAMES.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => challenge(p.code, g.id)}
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
          ))}
        </ul>
      )}
    </div>
  );
}
