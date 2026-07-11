"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { getGame } from "@/lib/games";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type UnifiedInvite = {
  kind: "match" | "room";
  id: number; // match id or room-invite id
  targetId: number; // match id or room id to navigate to
  game: string;
  fromName: string;
};

export default function InviteWatcher() {
  const { player } = useSession();
  const router = useRouter();
  const [invite, setInvite] = useState<UnifiedInvite | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!player) return;
    let active = true;
    const poll = async () => {
      try {
        const [mRes, rRes] = await Promise.all([
          fetch(`/api/match/invites?code=${player?.code ?? ""}`),
          fetch(`/api/rooms/invites?code=${player?.code ?? ""}`),
        ]);
        const mData = await mRes.json();
        const rData = await rRes.json();
        if (!active) return;

        const matchInvites = (mData.invites ?? []).map(
          (m: { id: number; game: string; player1Name: string | null }) => ({
            kind: "match" as const,
            id: m.id,
            targetId: m.id,
            game: m.game,
            fromName: m.player1Name ?? "Someone",
          }),
        );
        const roomInvites = (rData.invites ?? []).map(
          (r: { id: number; roomId: number; game: string; fromName: string }) => ({
            kind: "room" as const,
            id: r.id,
            targetId: r.roomId,
            game: r.game,
            fromName: r.fromName,
          }),
        );

        const all = [...roomInvites, ...matchInvites];
        const fresh = all[0] ?? null;
        setInvite(fresh);
        if (fresh) {
          const key = `${fresh.kind}-${fresh.id}`;
          if (!seen.current.has(key)) {
            seen.current.add(key);
            sound.play("turn");
            announce(
              `New ${fresh.kind === "room" ? "room" : "game"} invite from ${
                fresh.fromName
              } to play ${getGame(fresh.game)?.name ?? fresh.game}`,
            );
          }
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [player]);

  if (!invite) return null;
  const g = getGame(invite.game);

  async function decline() {
    if (!invite) return;
    try {
      if (invite.kind === "match") {
        await fetch(`/api/match/${invite.id}`, { method: "DELETE" });
      } else {
        await fetch(`/api/rooms/invites?id=${invite.id}`, { method: "DELETE" });
      }
    } catch {
      /* ignore */
    }
    setInvite(null);
  }

  async function accept() {
    if (!invite) return;
    sound.play("click");
    const target =
      invite.kind === "match"
        ? `/play/${invite.game}?match=${invite.targetId}`
        : `/rooms/${invite.targetId}`;
    if (invite.kind === "room") {
      try {
        await fetch(`/api/rooms/invites?id=${invite.id}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
    }
    setInvite(null);
    router.push(target);
  }

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,26rem)] -translate-x-1/2">
      <div className="animate-pieceIn rounded-2xl border border-sky-500/50 bg-slate-900 p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{g?.emoji ?? "🎮"}</div>
          <div className="flex-1">
            <div className="font-bold">
              {invite.kind === "room" ? "Room Invite!" : "Game Invite!"}
            </div>
            <div className="text-sm text-slate-400">
              <b className="text-sky-400">{invite.fromName}</b> wants to play{" "}
              {g?.name ?? invite.game}
              {invite.kind === "room" ? " in a live room" : ""}
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={accept}
            className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            {invite.kind === "room" ? "Join Room" : "Accept & Play"}
          </button>
          <button
            onClick={decline}
            className="rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
