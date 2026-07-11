import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const clean = String(code ?? "").trim().toUpperCase();
    if (!clean) {
      return Response.json({ error: "Player ID is required" }, { status: 400 });
    }

    // FIX: Demo mode without DB - return mock player for any code
    // This prevents "Cannot read properties of undefined (reading 'code')" crash
    if (!isDbConfigured()) {
      const mockPlayer = {
        id: Math.floor(Math.random() * 100000),
        name: "Guest Player",
        code: clean,
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

    const [player] = await db.select().from(players).where(eq(players.code, clean));
    if (!player) {
      return Response.json({ error: "No player found with that ID" }, { status: 404 });
    }

    await db.update(players).set({ lastSeen: new Date() }).where(eq(players.id, player?.id));

    const playerScores = await db
      .select()
      .from(scores)
      .where(eq(scores.playerId, player?.id));

    return Response.json({ player, scores: playerScores });
  } catch (e) {
    console.error(e);
    // Fallback to mock player to allow offline play
    try {
      const { code } = await req.json();
      const clean = String(code ?? "GUEST").trim().toUpperCase() || "GUEST";
      const mockPlayer = {
        id: Math.floor(Math.random() * 100000),
        name: "Guest Player",
        code: clean,
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
    } catch {
      return Response.json({ error: "Failed to login" }, { status: 500 });
    }
  }
}
