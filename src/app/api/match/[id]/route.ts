import { db, isDbConfigured } from "@/db";
import { matches } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { id } = params;
    const matchId = Number(id);
    if (!Number.isFinite(matchId)) {
      return Response.json({ error: "invalid id" }, { status: 400 });
    }
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ match });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// Leave / cancel a waiting match
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const matchId = Number(id);
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (match && (match.status === "waiting" || match.status === "invited")) {
      await db.delete(matches).where(eq(matches.id, matchId));
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
