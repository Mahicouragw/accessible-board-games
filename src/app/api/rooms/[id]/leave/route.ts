import { db, isDbConfigured } from "@/db";
import { players, rooms, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const roomId = Number(id);
    const { code } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const [player] = await db.select().from(players).where(eq(players.code, c));
    if (!player) return Response.json({ ok: true });

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) return Response.json({ ok: true });

    const members = room.members.filter((m) => m.id !== player?.id);
    await db.insert(messages).values({
      roomId,
      playerId: player?.id,
      playerName: player.name,
      avatar: player.avatar,
      kind: "system",
      content: `${player.name} left`,
    });

    // If empty or host left with no players, close the room.
    const remainingPlayers = members.filter((m) => m.role === "player");
    let newHostId = room.hostId;
    let newHostName = room.hostName;
    let status = room.status;
    if (members.length === 0) {
      status = "closed";
    } else if (room.hostId === player?.id && remainingPlayers.length > 0) {
      newHostId = remainingPlayers[0].id;
      newHostName = remainingPlayers[0].name;
    }

    await db
      .update(rooms)
      .set({ members, status, hostId: newHostId, hostName: newHostName, updatedAt: new Date() })
      .where(eq(rooms.id, roomId));

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: true });
  }
}
