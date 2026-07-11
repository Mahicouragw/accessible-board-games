"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { getGame } from "@/lib/games";
import type { RoomMember } from "@/db/schema";
import RoomChat from "@/components/room/RoomChat";
import VoiceCall from "@/components/room/VoiceCall";
import { sound } from "@/lib/sound";

type Room = {
  id: number;
  code: string;
  game: string;
  hostId: number;
  hostName: string;
  members: RoomMember[];
  status: string;
};

type OnlineP = { id: number; name: string; code: string; avatar: string };

export default function RoomPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <div className="animate-pulse text-4xl">🎮</div>
        </div>
      }
    >
      <RoomPageInner params={params} />
    </Suspense>
  );
}

function RoomPageInner({ params }: { params: { id: string } }) {
  const { id } = params;
  const roomId = Number(id);
  const { player, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spectate = searchParams.get("spectate") === "1";
  const [room, setRoom] = useState<Room | null>(null);
  const [role, setRole] = useState<"player" | "spectator">("player");
  const [online, setOnline] = useState<OnlineP[]>([]);
  const [invited, setInvited] = useState<number[]>([]);
  const [notFound, setNotFound] = useState(false);

  const info = getGame(room?.game ?? "");

  // Join room on mount.
  useEffect(() => {
    if (!player?.code) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: player?.code ?? "", asSpectator: spectate }),
        });
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!active) return;
        setRoom(data.room);
        setRole(data.role);
        sound.play("turn");
      } catch {
        setNotFound(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [player, roomId, spectate]);

  // Poll room state.
  useEffect(() => {
    if (!player?.code) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setRoom(data.room);
      } catch {
        /* ignore */
      }
    };
    const iv = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player, roomId]);

  // Online players for inviting.
  useEffect(() => {
    if (!player?.code) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/players/online?exclude=${player?.code ?? ""}`);
        const data = await res.json();
        if (active) setOnline(data.players ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const iv = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player]);

  const leave = useCallback(async () => {
    if (player?.code) {
      try {
        await fetch(`/api/rooms/${roomId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: player?.code ?? "" }),
        });
      } catch {
        /* ignore */
      }
    }
    router.push("/");
  }, [player, roomId, router]);

  async function invite(opponentCode: string, oid: number) {
    if (!player?.code) return;
    sound.play("click");
    setInvited((v) => [...v, oid]);
    await fetch(`/api/rooms/${roomId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: player?.code ?? "", opponentCode }),
    });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-4xl">🎮</div>
      </div>
    );
  }
  if (!player) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-slate-400">Log in to join this room.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-slate-400">This room is closed or doesn&apos;t exist.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950">
            Back to Arcade
          </Link>
        </div>
      </div>
    );
  }

  const members = room?.members ?? [];
  const playersList = members.filter((m) => m.role === "player");
  const spectators = members.filter((m) => m.role === "spectator");
  const inRoomIds = new Set(members.map((m) => m.id));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={leave}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          ← Leave Room
        </button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{info?.emoji}</span>
          {info?.name} Room
        </h1>
        <span className="rounded-lg bg-slate-800 px-3 py-1.5 font-mono text-sm text-emerald-400">
          Code: {room?.code ?? "----"}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Participants */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">👥 Players ({playersList.length}/4)</h2>
              {role === "spectator" && (
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300">
                  You&apos;re spectating 👀
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {playersList.map((m) => (
                <div key={m.id} className="rounded-2xl bg-slate-800/60 p-3 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-2xl">
                    {m.avatar}
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold">
                    {m.name}
                    {m.id === room?.hostId && " 👑"}
                    {m.id === player?.id && " (You)"}
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - playersList.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="grid place-items-center rounded-2xl border-2 border-dashed border-slate-700 p-3 text-xs text-slate-600"
                >
                  Waiting…
                </div>
              ))}
            </div>
            {spectators.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                <span className="text-xs text-slate-500">👀 Spectators:</span>
                {spectators.map((s) => (
                  <span key={s.id} className="rounded-full bg-slate-800 px-2 py-1 text-xs">
                    {s.avatar} {s.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Play the game */}
          {info?.online && (
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-bold">🎮 Play {info.name}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Open the game to play or watch live. Chat and voice stay connected here.
              </p>
              <Link
                href={`/play/${room?.game ?? ""}`}
                className={`mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${info.color} px-6 py-3 font-bold text-white`}
              >
                {role === "spectator" ? "Watch Game ▶" : "Open Game ▶"}
              </Link>
            </section>
          )}

          {/* Invite online players */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-bold">➕ Invite Players</h2>
            <p className="mt-1 text-sm text-slate-400">
              Invite anyone online to join this room (up to 4 players, unlimited spectators).
            </p>
            {online.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No other players online right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {online.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-800/60 p-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-700 text-lg">
                      {p.avatar}
                    </div>
                    <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                    {inRoomIds.has(p.id) ? (
                      <span className="text-xs text-emerald-400">In room</span>
                    ) : (
                      <button
                        onClick={() => invite(p.code, p.id)}
                        disabled={invited.includes(p.id)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                      >
                        {invited.includes(p.id) ? "Invited ✓" : "Invite"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column: voice + chat */}
        <aside className="space-y-4">
          <VoiceCall roomId={roomId} members={members} />
          <RoomChat roomId={roomId} />
        </aside>
      </div>
    </main>
  );
}
