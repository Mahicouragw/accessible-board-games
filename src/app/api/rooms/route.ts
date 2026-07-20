import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";
import type { RoomMember } from "@/db/schema";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// List open / playing rooms anyone can join or spectate.
export async function GET() {
  try {
    const rooms = await store.rooms.listOpen();
    return Response.json({ rooms, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ rooms: [], cloud: false });
  }
}

// Create a new room.
export async function POST(req: Request) {
  try {
    const { code, game } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!c || !g) return Response.json({ error: "code and game required" }, { status: 400 });

    const host = await store.players.findByCode(c);
    if (!host) {
      return Response.json({ error: "Player session not found. Please set your player name again from the home screen." }, { status: 404 });
    }

    let roomCode = genCode();
    for (let i = 0; i < 6; i++) {
      const dup = await store.rooms.byCode(roomCode);
      if (!dup) break;
      roomCode = genCode();
    }

    const member: RoomMember = {
      id: host.id, name: host.name, avatar: host.avatar, role: "player",
    };

    const room = await store.rooms.insert({
      code: roomCode, game: g,
      hostId: host.id, hostName: host.name,
      members: [member], status: "open",
    });
    if (!room) throw new Error("room insert returned no row");

    await store.messages.insert({
      roomId: room.id, playerId: host.id, playerName: host.name,
      avatar: host.avatar, kind: "system",
      content: `${host.name} created the room`,
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

// Close rooms that a host wants to end (kept for symmetry, not required).
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    const host = await store.players.findByCode(code);
    if (!host) return Response.json({ error: "player not found" }, { status: 404 });
    await store.rooms.updateOwned(id, host.id, { status: "closed", updatedAt: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
