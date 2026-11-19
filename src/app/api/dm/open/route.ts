import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";
import type { RoomMember } from "@/db/schema";

export const dynamic = "force-dynamic";

// 💬 Open (or find) a private 1-to-1 chat room between the logged-in player and
// another player BY NAME. Chat rooms use game="chat" so they never show up in
// the public Rooms browser; members chat in /rooms/[id] like any room.
export async function POST(req: Request) {
  try {
    const { code, toName } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const name = String(toName ?? "").trim();
    if (!c || !name) return Response.json({ error: "code and toName required" }, { status: 400 });

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "Player session not found. Please set your player name again." }, { status: 404 });

    const target = await store.players.findByName(name);
    if (!target) return Response.json({ error: `No player named "${name}". Names are case-insensitive — ask them for their exact name.` }, { status: 404 });
    if (target.id === me.id) return Response.json({ error: "You cannot chat with yourself." }, { status: 400 });

    // Reuse an existing open chat room between these two players.
    const open = await store.rooms.listOpen();
    const existing = open.find((r) => {
      if (r.game !== "chat") return false;
      const ids = (r.members ?? []).map((m: { id: number }) => Number(m.id));
      return ids.includes(Number(me.id)) && ids.includes(Number(target.id));
    });
    if (existing) {
      return Response.json({ room: existing, cloud: true, reused: true });
    }

    let roomCode = "";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 6; i++) {
      roomCode += chars[Math.floor(Math.random() * chars.length)];
      if (!(await store.rooms.byCode(roomCode))) break;
    }

    const members: RoomMember[] = [
      { id: me.id, name: me.name, avatar: me.avatar, role: "player" },
      { id: target.id, name: target.name, avatar: target.avatar, role: "player" },
    ];

    const room = await store.rooms.insert({
      code: roomCode, game: "chat",
      hostId: me.id, hostName: me.name,
      members, status: "open",
    });
    if (!room) throw new Error("room insert returned no row");

    await store.messages.insert({
      roomId: room.id, playerId: me.id, playerName: me.name,
      avatar: me.avatar, kind: "system",
      content: `💬 ${me.name} started a private chat with ${target.name}`,
    });

    // Notify the target so the chat also appears in their 🔔 Notifications.
    await store.roomInvites.insert({
      roomId: room.id, fromName: me.name, toId: target.id, game: "chat",
    });

    return Response.json({ room, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
