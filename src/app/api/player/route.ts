import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    if (!code) return Response.json({ error: "code required" }, { status: 400 });

    // FIX: Demo mode - return mock player if no DB, prevents crash
    if (!isDbConfigured()) {
      const mockPlayer = {
        id: 1,
        name: "Guest Player",
        code,
        avatar: "🎮",
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        xp: 0,
        createdAt: new Date(),
        lastSeen: new Date(),
      };
      return Response.json({ player: mockPlayer, scores: [] });
    }

    const [player] = await db.select().from(players).where(eq(players.code, code));
    if (!player) return Response.json({ error: "not found" }, { status: 404 });

    const playerScores = await db
      .select()
      .from(scores)
      .where(eq(scores.playerId, player?.id))
      .orderBy(desc(scores.createdAt));

    return Response.json({ player, scores: playerScores });
  } catch (e) {
    console.error(e);
    // Fallback mock to prevent "Cannot read properties of undefined"
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "GUEST").trim().toUpperCase() || "GUEST";
    const mockPlayer = {
      id: 1,
      name: "Guest Player",
      code,
      avatar: "🎮",
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      xp: 0,
      createdAt: new Date(),
      lastSeen: new Date(),
    };
    return Response.json({ player: mockPlayer, scores: [] });
  }
}
