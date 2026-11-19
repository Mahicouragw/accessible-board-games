"use client";

// 🔔 Notifications tab — everything that needs your attention:
// game invitations (challenges), room invitations, and friend requests.
// Friends are added BY NAME; Player IDs are only for logging in.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { getGame } from "@/lib/games";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type MatchInvite = { id: number; game: string; player1Name: string | null };
type RoomInvite = { id: number; roomId: number; game: string; fromName: string };
type FriendReq = {
  id: number;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  status: string;
};

export default function NotificationsPanel() {
  const { player } = useSession();
  const router = useRouter();
  const [matchInvites, setMatchInvites] = useState<MatchInvite[]>([]);
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);
  const [friendReqs, setFriendReqs] = useState<FriendReq[]>([]);
  const [friends, setFriends] = useState<FriendReq[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!player) return;
    try {
      const [m, r, f] = await Promise.all([
        fetch(`/api/match/invites?code=${player.code}`).then((x) => x.json()),
        fetch(`/api/rooms/invites?code=${player.code}`).then((x) => x.json()),
        fetch(`/api/friends?code=${player.code}`).then((x) => x.json()),
      ]);
      setMatchInvites(m.invites ?? []);
      setRoomInvites(r.invites ?? []);
      setFriendReqs((f.pending ?? []) as FriendReq[]);
      setFriends((f.friends ?? []) as FriendReq[]);
    } catch {
      /* offline */
    }
  }, [player]);

  useEffect(() => {
    load();
    const iv = setInterval(() => {
      if (!document.hidden) load();
    }, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const say = (m: string) => { setMsg(m); announce(m); };

  async function acceptMatch(id: number, game: string) {
    try {
      const res = await fetch(`/api/match/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "" }),
      });
      if (res.ok) {
        sound.play("win");
        say(`Game invite accepted — starting ${getGame(game)?.name ?? game}!`);
        router.push(`/play/${game}?match=${id}`);
      } else {
        say("Could not accept that invite (it may have expired).");
      }
    } catch {
      say("Network error — try again.");
    }
    load();
  }

  async function answerFriend(id: number, action: "accept" | "decline") {
    try {
      const res = await fetch(`/api/friends/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", action }),
      });
      if (res.ok) {
        sound.play(action === "accept" ? "win" : "click");
        say(action === "accept" ? "Friend request accepted! 🎉" : "Friend request declined.");
      }
    } catch {
      say("Network error — try again.");
    }
    load();
  }

  const total = matchInvites.length + roomInvites.length + friendReqs.length;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🔔 Notifications</h3>
        {msg && <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{msg}</p>}
        {total === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nothing new. Game invites, room invites and friend requests will appear here automatically.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {friendReqs.map((f) => (
              <li key={`fr${f.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-800/70 p-4">
                <span className="text-2xl">🤝</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Friend request from {f.fromName}</div>
                  <div className="text-xs text-slate-400">Add them to play and chat together</div>
                </div>
                <button onClick={() => answerFriend(f.id, "accept")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400">Accept</button>
                <button onClick={() => answerFriend(f.id, "decline")} className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Decline</button>
              </li>
            ))}
            {matchInvites.map((m) => (
              <li key={`mi${m.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-800/70 p-4">
                <span className="text-2xl">{getGame(m.game)?.emoji ?? "🎮"}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Game invite: {getGame(m.game)?.name ?? m.game}</div>
                  <div className="text-xs text-slate-400">from {m.player1Name ?? "a player"}</div>
                </div>
                <button onClick={() => acceptMatch(m.id, m.game)} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-sky-400">Accept & Play ▶</button>
              </li>
            ))}
            {roomInvites.map((r) => (
              <li key={`ri${r.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-800/70 p-4">
                <span className="text-2xl">🚪</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Room invite: {getGame(r.game)?.name ?? r.game}</div>
                  <div className="text-xs text-slate-400">from {r.fromName}</div>
                </div>
                <button onClick={() => { sound.play("select"); router.push(`/rooms/${r.roomId}`); }} className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400">Join Room</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {friends.length > 0 && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-bold">🤝 Friends ({friends.length})</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {friends.map((f) => {
              const other = Number(f.fromId) === Number(player?.id) ? f.toName : f.fromName;
              return (
                <li key={`f${f.id}`} className="rounded-full bg-slate-800 px-4 py-2 text-sm">
                  {other}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
