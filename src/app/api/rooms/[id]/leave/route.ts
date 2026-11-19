import { store } from "@/lib/cloud-store";
import type { RoomMember } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const player = await store.players.findByCode(c);
    if (!player) return Response.json({ ok: true });

    const room = await store.rooms.byId(roomId);
    if (!room) return Response.json({ ok: true });

    const members: RoomMember[] = (Array.isArray(room.members) ? room.members : [])
      .filter((m) => m.id !== player.id);

    await store.messages.insert({
      roomId, playerId: player.id, playerName: player.name,
      avatar: player.avatar, kind: "system",
      content: `${player.name} left the room`,
    });

    // 🚪 The room STAYS OPEN after anyone leaves (even if empty) and keeps its
    // original owner's name — only the owner can delete it (DELETE /api/rooms).
    await store.rooms.update(roomId, {
      members,
      updatedAt: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: true });
  }
}
