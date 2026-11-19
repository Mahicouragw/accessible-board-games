"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { getGame } from "@/lib/games";
import type { RoomMember } from "@/db/schema";
import RoomChat from "@/components/room/RoomChat";
import VoiceCall from "@/components/room/VoiceCall";
import TeamSetup from "@/components/room/TeamSetup";
import { sound } from "@/lib/sound";
import { useHubGestureContext } from "@/lib/gesture/useGameGestures";

type Room = {
  id: number;
  code: string;
  game: string;
  hostId: number;
  hostName: string;
  members: RoomMember[];
  status: string;
  meta?: any;
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
  const [inviteName, setInviteName] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Hub/world gesture context for the room screen (suspended while in a game).
  useHubGestureContext();

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
    // The room itself stays open for others — only the owner can delete it.
    router.push("/");
  }, [player, roomId, router]);

  // 🗑️ Only the room OWNER can delete the room (it persists until then).
  const deleteRoom = useCallback(async () => {
    if (!player?.code) return;
    try {
      await fetch(`/api/rooms?id=${roomId}&code=${encodeURIComponent(player.code)}`, {
        method: "DELETE",
      });
    } catch {
      /* ignore */
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

  // Invite by NAME — Player IDs are only for logging in.
  async function inviteByName() {
    const name = inviteName.trim();
    if (!player?.code || !name) return;
    sound.play("click");
    setInviteMsg("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player.code, opponentName: name }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setInviteMsg(`✅ Invite sent to ${name} — they'll see it in 🔔 Notifications.`);
        setInviteName("");
      } else {
        setInviteMsg(`❌ ${j.error ?? "could not send invite"}`);
      }
    } catch {
      setInviteMsg("❌ network error — try again");
    }
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
        <div className="flex items-center gap-2">
          {confirmLeave ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-600/50 bg-amber-900/30 px-3 py-2" role="alertdialog" aria-label="Confirm leaving the room">
              <span className="text-sm font-semibold text-amber-200">Do you want to exit this room?</span>
              <button
                onClick={() => { setConfirmLeave(false); leave(); }}
                className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmLeave(false)}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLeave(true)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              ← Leave Room
            </button>
          )}
          {player?.id === room?.hostId && room?.game !== "chat" && (
            confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl border border-rose-600/50 bg-rose-900/30 px-3 py-2" role="alertdialog" aria-label="Confirm deleting the room">
                <span className="text-sm font-semibold text-rose-200">Delete this room for everyone?</span>
                <button
                  onClick={() => { setConfirmDelete(false); deleteRoom(); }}
                  className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-900/50"
                title="Only the owner can delete the room"
              >
                🗑️ Delete room
              </button>
            )
          )}
        </div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{room?.game === "chat" ? "💬" : info?.emoji}</span>
          {room?.game === "chat" ? "Private chat" : `${room?.hostName ?? "Host"}'s ${info?.name ?? ""} Room`}
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
              <h2 className="text-lg font-bold">👥 Members ({members.length}/24 · {playersList.length} players)</h2>
              {role === "spectator" && (
                <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-300">
                  You&apos;re spectating 👀
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {members.map((m) => {
                const isOnline = online.some((o) => o.id === m.id);
                return (
                <div key={m.id} className="rounded-2xl bg-slate-800/60 p-3 text-center">
                  <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-2xl">
                    {m.avatar}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`}
                      title={isOnline ? "online" : "offline"}
                    />
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold">
                    {m.name}
                    {m.id === room?.hostId && " 👑"}
                    {m.id === player?.id && " (You)"}
                    {m.role === "spectator" && " 👀"}
                  </div>
                </div>
                );
              })}
              {Array.from({ length: Math.max(0, Math.min(4, 24 - members.length)) }).map((_, i) => (
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

          {/* Teams & captains (host sets countries/captains; captains pick striker/bowler) */}
          {room && room.game !== "chat" && (
            <TeamSetup
              roomId={roomId}
              hostId={room.hostId}
              members={members}
              meta={room.meta}
              meId={player?.id ?? null}
              myCode={player?.code ?? ""}
            />
          )}

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
              Invite by the player&apos;s NAME (up to 24 members incl. spectators) — IDs are only for logging in.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Player's name (e.g. Asha)"
                aria-label="Player's name to invite"
                className="w-52 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
              <button
                onClick={inviteByName}
                disabled={!inviteName.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                ✉️ Send invite
              </button>
            </div>
            {inviteMsg && <p className="mt-2 text-xs text-sky-300" role="status">{inviteMsg}</p>}
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
