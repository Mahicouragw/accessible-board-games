import { db, isDbConfigured } from "@/db";
import { players, messages } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Fetch messages after a given id (for polling).
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
    const after = Number(searchParams.get("after") ?? 0);

    const rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.roomId, roomId), gt(messages.id, after)))
      .orderBy(desc(messages.id))
      .limit(50);

    return Response.json({ messages: rows.reverse() });
  } catch (e) {
    console.error(e);
    return Response.json({ messages: [] });
  }
}

// Send a text or voice message.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const roomId = Number(id);
    const { code, kind, content } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const k = kind === "voice" ? "voice" : "text";
    const body = String(content ?? "");

    if (!body) return Response.json({ error: "empty" }, { status: 400 });
    // Guard payload size (voice ~ base64). Limit to ~700KB.
    if (body.length > 950_000) {
      return Response.json({ error: "message too large" }, { status: 413 });
    }

    const [player] = await db.select().from(players).where(eq(players.code, c));
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const [msg] = await db
      .insert(messages)
      .values({
        roomId,
        playerId: player?.id,
        playerName: player.name,
        avatar: player.avatar,
        kind: k,
        content: k === "text" ? body.slice(0, 500) : body,
      })
      .returning();

    return Response.json({ message: msg });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
