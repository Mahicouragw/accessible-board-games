import { db, isDbConfigured } from "@/db";
import { players, roomInvites } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    if (!code) return Response.json({ invites: [] });
    const [me] = await db.select().from(players).where(eq(players.code, code));
    if (!me) return Response.json({ invites: [] });

    const rows = await db
      .select()
      .from(roomInvites)
      .where(eq(roomInvites.toId, me.id))
      .orderBy(desc(roomInvites.id))
      .limit(5);

    return Response.json({ invites: rows });
  } catch (e) {
    console.error(e);
    return Response.json({ invites: [] });
  }
}

// Dismiss / accept an invite (removes it).
export async function DELETE(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (id) await db.delete(roomInvites).where(eq(roomInvites.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: true });
  }
}
