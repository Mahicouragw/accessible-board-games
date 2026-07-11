import { db, isDbConfigured } from "@/db";
import { players, signals } from "@/db/schema";
import { eq, and, gt, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Poll signals addressed to me (or broadcast), not sent by me.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { id } = params;
    const roomId = Number(id);
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    const after = Number(searchParams.get("after") ?? 0);

    const [me] = await db.select().from(players).where(eq(players.code, code));
    if (!me) return Response.json({ signals: [] });

    const rows = await db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.roomId, roomId),
          gt(signals.id, after),
          or(eq(signals.toId, me.id), eq(signals.toId, 0)),
        ),
      )
      .orderBy(desc(signals.id))
      .limit(60);

    const mine = rows.filter((s) => s.fromId !== me.id).reverse();
    return Response.json({ signals: mine });
  } catch (e) {
    console.error(e);
    return Response.json({ signals: [] });
  }
}

// Post a signal (offer/answer/ice/hangup).
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const roomId = Number(id);
    const { code, toId, kind, payload } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const [me] = await db.select().from(players).where(eq(players.code, c));
    if (!me) return Response.json({ error: "player not found" }, { status: 404 });

    const [sig] = await db
      .insert(signals)
      .values({
        roomId,
        fromId: me.id,
        toId: Number(toId) || 0,
        kind: String(kind),
        payload,
      })
      .returning();

    return Response.json({ signal: { id: sig.id } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
