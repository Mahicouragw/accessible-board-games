import { db, isDbConfigured } from "@/db";
import { players, scores } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Save a score/progress for a single-player game. Keeps only the best.
export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { code, game, score, meta } = await req.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    const s = Math.max(0, Math.floor(Number(score) || 0));
    if (!cleanCode || !g) {
      return Response.json({ error: "code and game required" }, { status: 400 });
    }

    const [player] = await db.select().from(players).where(eq(players.code, cleanCode));
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const [existing] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.playerId, player?.id), eq(scores.game, g)));

    let record;
    if (existing) {
      if (s > existing.score) {
        [record] = await db
          .update(scores)
          .set({ score: s, meta: meta ?? existing.meta, createdAt: new Date() })
          .where(eq(scores.id, existing.id))
          .returning();
      } else {
        record = existing;
      }
    } else {
      [record] = await db
        .insert(scores)
        .values({ playerId: player?.id, playerName: player.name, game: g, score: s, meta })
        .returning();
    }

    // grant XP
    const [updated] = await db
      .update(players)
      .set({ xp: player.xp + Math.max(1, Math.floor(s / 10)) })
      .where(eq(players.id, player?.id))
      .returning();

    return Response.json({ record, player: updated });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// Leaderboard for a game
export async function GET(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const { searchParams } = new URL(req.url);
    const g = String(searchParams.get("game") ?? "").trim();
    if (!g) return Response.json({ error: "game required" }, { status: 400 });

    const rows = await db
      .select()
      .from(scores)
      .where(eq(scores.game, g))
      .orderBy(desc(scores.score))
      .limit(20);

    return Response.json({ leaderboard: rows });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
