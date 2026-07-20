import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";
import type { RoomMember } from "@/db/schema";
import * as LocalDB from "@/lib/local-cloud-db";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, asSpectator } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const player = await store.players.findByCode(c);
    if (!player) {
      return Response.json({ error: "Player session not found. Please set your player name again." }, { status: 404 });
    }

    const room = await store.rooms.byId(roomId);
    if (!room) return Response.json({ error: "room not found" }, { status: 404 });
    if (room.status === "closed") return Response.json({ error: "room closed" }, { status: 400 });

    const members: RoomMember[] = Array.isArray(room.members) ? [...room.members] : [];
    const existing = members.find((m) => m.id === player.id);

    const playerCount = members.filter((m) => m.role === "player").length;
    const wantSpectator = Boolean(asSpectator) || playerCount >= 4;
    const role: RoomMember["role"] = wantSpectator ? "spectator" : "player";

    if (existing) {
      existing.name = player.name;
      existing.avatar = player.avatar;
    } else {
      members.push({ id: player.id, name: player.name, avatar: player.avatar, role });
      await store.messages.insert({
        roomId, playerId: player.id, playerName: player.name,
        avatar: player.avatar, kind: "system",
        content: `${player.name} joined as ${role}`,
      });
    }

    const updated = await store.rooms.update(roomId, {
      members, updatedAt: new Date().toISOString(),
    });

    return Response.json({ room: updated, role: existing ? existing.role : role, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      // Local fallback so room joining still demonstrates the flow on one device.
      try {
        const roomId = Number(params.id);
        const { code, asSpectator } = await req.json().catch(() => ({}));
        const result = LocalDB.joinRoom(roomId, String(code ?? ""), Boolean(asSpectator));
        if (result) return Response.json({ room: result.room, role: result.role, cloud: false });
      } catch { /* fall through */ }
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
