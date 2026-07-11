import { db, isDbConfigured } from "@/db";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { id } = await params;
    const [room] = await db.select().from(rooms).where(eq(rooms.id, Number(id)));
    if (!room) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ room });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
