import { db, isDbConfigured } from "@/db";
import { players, matches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Pending challenges waiting for me to accept.
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
      .from(matches)
      .where(and(eq(matches.player2Id, me.id), eq(matches.status, "invited")))
      .orderBy(desc(matches.createdAt))
      .limit(5);

    return Response.json({ invites: rows });
  } catch (e) {
    console.error(e);
    return Response.json({ invites: [] });
  }
}
