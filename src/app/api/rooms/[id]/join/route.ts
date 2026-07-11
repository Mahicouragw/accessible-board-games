import { db } from "@/db";
import { isDbConfigured } from "@/db";
import * as LocalDB from "@/lib/local-cloud-db";
import { players, rooms, messages, type RoomMember } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const roomId = Number(id);
    const { code, asSpectator } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    if (!isDbConfigured()) {
      // REAL Local Cloud DB - no Neon needed!
      const result = LocalDB.joinRoom(roomId, c, Boolean(asSpectator));
      if (!result) return Response.json({ error: "player or room not found" }, { status: 404 });
      return Response.json({ room: result.room, role: result.role });
    }

    const [player] = await db.select().from(players).where(eq(players.code, c));
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) return Response.json({ error: "room not found" }, { status: 404 });
    if (room.status === "closed") return Response.json({ error: "room closed" }, { status: 400 });

    const members = [...room.members];
    const existing = members.find((m) => m.id === player.id);

    const playerCount = members.filter((m) => m.role === "player").length;
    const wantSpectator = Boolean(asSpectator) || playerCount >= 4;
    const role: RoomMember["role"] = wantSpectator ? "spectator" : "player";

    if (existing) {
      existing.name = player.name;
      existing.avatar = player.avatar;
    } else {
      members.push({ id: player.id, name: player.name, avatar: player.avatar, role });
      await db.insert(messages).values({
        roomId,
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar,
        kind: "system",
        content: `${player.name} joined as ${role}`,
      });
    }

    const [updated] = await db
      .update(rooms)
      .set({ members, updatedAt: new Date() })
      .where(eq(rooms.id, roomId))
      .returning();

    return Response.json({ room: updated, role: existing ? existing.role : role });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
