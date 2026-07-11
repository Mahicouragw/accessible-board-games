import { db, isDbConfigured } from "@/db";
import { players, matches } from "@/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { Chess } from "chess.js";

export const dynamic = "force-dynamic";

function initBoard(game: string): unknown {
  if (game === "connect-four") {
    return Array.from({ length: 6 }, () => Array(7).fill(0));
  }
  if (game === "chess") {
    return { fen: new Chess().fen() };
  }
  return Array(9).fill(0);
}

export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { code, game, vsAi } = await req.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!cleanCode || !g) {
      return Response.json({ error: "code and game required" }, { status: 400 });
    }

    const [player] = await db.select().from(players).where(eq(players.code, cleanCode));
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    // Play vs AI — start immediately
    if (vsAi) {
      const [match] = await db
        .insert(matches)
        .values({
          game: g,
          status: "active",
          vsAi: true,
          player1Id: player?.id,
          player1Name: player.name,
          player2Id: null,
          player2Name: "AI Bot 🤖",
          board: initBoard(g),
          turn: 1,
        })
        .returning();
      return Response.json({ match, you: 1 });
    }

    // Look for a waiting opponent (someone else's open match)
    const [waiting] = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.game, g),
          eq(matches.status, "waiting"),
          eq(matches.vsAi, false),
          ne(matches.player1Id, player?.id),
        ),
      )
      .orderBy(desc(matches.createdAt))
      .limit(1);

    if (waiting) {
      const [match] = await db
        .update(matches)
        .set({
          player2Id: player?.id,
          player2Name: player.name,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(matches.id, waiting.id))
        .returning();
      return Response.json({ match, you: 2 });
    }

    // No one waiting — create a waiting match and wait for someone to join
    const [match] = await db
      .insert(matches)
      .values({
        game: g,
        status: "waiting",
        vsAi: false,
        player1Id: player?.id,
        player1Name: player.name,
        board: initBoard(g),
        turn: 1,
      })
      .returning();

    return Response.json({ match, you: 1 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
