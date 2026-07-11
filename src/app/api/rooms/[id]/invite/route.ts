import { db, isDbConfigured } from "@/db";
import { players, rooms, roomInvites } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const roomId = Number(id);
    const { code, opponentCode } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();

    const [me] = await db.select().from(players).where(eq(players.code, c));
    const [opp] = await db.select().from(players).where(eq(players.code, oc));
    if (!me || !opp) return Response.json({ error: "player not found" }, { status: 404 });

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) return Response.json({ error: "room not found" }, { status: 404 });

    // Avoid duplicate pending invites.
    const [dup] = await db
      .select()
      .from(roomInvites)
      .where(and(eq(roomInvites.roomId, roomId), eq(roomInvites.toId, opp.id)));
    if (!dup) {
      await db.insert(roomInvites).values({
        roomId,
        fromName: me.name,
        toId: opp.id,
        game: room.game,
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
