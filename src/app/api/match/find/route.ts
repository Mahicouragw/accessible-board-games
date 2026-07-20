import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";
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
    const { code, game, vsAi } = await req.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!cleanCode || !g) {
      return Response.json({ error: "code and game required" }, { status: 400 });
    }

    const player = await store.players.findByCode(cleanCode);
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    // Play vs AI — start immediately
    if (vsAi) {
      const match = await store.matches.insert({
        game: g, status: "active", vsAi: true,
        player1Id: player.id, player1Name: player.name,
        player2Id: null, player2Name: "AI Bot 🤖",
        board: initBoard(g), turn: 1,
      });
      return Response.json({ match, you: 1, cloud: true });
    }

    // Look for a waiting opponent (someone else's open match)
    const waiting = await store.matches.waitingOpponent(g, player.id);
    if (waiting) {
      const match = await store.matches.update(waiting.id, {
        player2Id: player.id,
        player2Name: player.name,
        status: "active",
        updatedAt: new Date().toISOString(),
      });
      return Response.json({ match, you: 2, cloud: true });
    }

    // No one waiting — create a waiting match and wait for someone to join
    const match = await store.matches.insert({
      game: g, status: "waiting", vsAi: false,
      player1Id: player.id, player1Name: player.name,
      board: initBoard(g), turn: 1,
    });
    return Response.json({ match, you: 1, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
