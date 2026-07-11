import { db, isDbConfigured } from "@/db";
import { players } from "@/db/schema";
import { gt, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Players active in the last 45 seconds are considered "online".
export async function GET(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { searchParams } = new URL(req.url);
    const exclude = String(searchParams.get("exclude") ?? "").trim().toUpperCase();
    const since = new Date(Date.now() - 45_000);

    const online = await db
      .select({
        id: players.id,
        name: players.name,
        code: players.code,
        avatar: players.avatar,
        wins: players.wins,
        losses: players.losses,
        xp: players.xp,
      })
      .from(players)
      .where(gt(players.lastSeen, since))
      .orderBy(desc(players.lastSeen))
      .limit(50);

    const list = online.filter((p) => (exclude ? p.code !== exclude : true));
    return Response.json({ players: list });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
