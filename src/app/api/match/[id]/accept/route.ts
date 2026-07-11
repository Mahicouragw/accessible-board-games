import { db, isDbConfigured } from "@/db";
import { players, matches } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    const { code } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const [me] = await db.select().from(players).where(eq(players.code, c));
    if (!me) return Response.json({ error: "player not found" }, { status: 404 });

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return Response.json({ error: "not found" }, { status: 404 });
    if (match.player2Id !== me.id) {
      return Response.json({ error: "not your invite" }, { status: 403 });
    }

    const [updated] = await db
      .update(matches)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(matches.id, matchId))
      .returning();

    return Response.json({ match: updated, you: 2 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
