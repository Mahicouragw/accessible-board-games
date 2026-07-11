"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { GAMES, getGame } from "@/lib/games";
import { sound } from "@/lib/sound";
import type { RoomMember } from "@/db/schema";

type Room = {
  id: number;
  code: string;
  game: string;
  hostName: string;
  members: RoomMember[];
  status: string;
};

export default function RoomsBrowser() {
  const { player } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);
  const [pickGame, setPickGame] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/rooms");
        const data = await res.json();
        if (active) setRooms(data.rooms ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, []);

  async function createRoom(game: string) {
    if (!player || creating) return;
    setCreating(true);
    sound.play("click");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", game }),
      });
      const data = await res.json();
      if (data.room) router.push(`/rooms/${data.room.id}`);
    } finally {
      setCreating(false);
      setPickGame(false);
    }
  }

  function joinRoom(id: number, spectate: boolean) {
    sound.play("click");
    router.push(`/rooms/${id}${spectate ? "?spectate=1" : ""}`);
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">🎉 Live Rooms</h2>
          <p className="text-sm text-slate-400">
            Create a party, invite up to 4 players, chat, voice & call — or jump into any live room.
          </p>
        </div>
        <button
          onClick={() => setPickGame((v) => !v)}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 font-bold text-white transition hover:opacity-90"
        >
          + Create Room
        </button>
      </div>

      {pickGame && (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="mb-2 text-sm text-slate-300">Pick a game for your room:</div>
          <div className="flex flex-wrap gap-2">
            {GAMES.map((g) => (
              <button
                key={g.id}
                onClick={() => createRoom(g.id)}
                disabled={creating}
                className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold transition hover:bg-slate-600 disabled:opacity-50"
              >
                <span>{g.emoji}</span>
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No live rooms yet. Be the first to create one!
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {rooms.map((r) => {
            const g = getGame(r.game);
            const playerCount = r.members.filter((m) => m.role === "player").length;
            const full = playerCount >= 4;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-slate-800/60 p-3"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-700 text-2xl">
                  {g?.emoji ?? "🎮"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{g?.name ?? r.game}</div>
                  <div className="text-xs text-slate-400">
                    Host {r.hostName} · {playerCount}/4 players
                    {r.status === "playing" && " · 🔴 live"}
                  </div>
                  <div className="mt-0.5 flex -space-x-1">
                    {r.members.slice(0, 5).map((m) => (
                      <span
                        key={m.id}
                        className="grid h-5 w-5 place-items-center rounded-full bg-slate-600 text-[10px] ring-1 ring-slate-900"
                      >
                        {m.avatar}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => joinRoom(r.id, full)}
                    className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400"
                  >
                    {full ? "Watch" : "Join"}
                  </button>
                  {!full && (
                    <button
                      onClick={() => joinRoom(r.id, true)}
                      className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-600"
                    >
                      Spectate
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
