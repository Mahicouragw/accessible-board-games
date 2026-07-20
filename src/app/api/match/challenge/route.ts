import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";
import { Chess } from "chess.js";

export const dynamic = "force-dynamic";

function initBoard(game: string): unknown {
  if (game === "connect-four") return Array.from({ length: 6 }, () => Array(7).fill(0));
  if (game === "chess") return { fen: new Chess().fen() };
  return Array(9).fill(0);
}

export async function POST(req: Request) {
  try {
    const { code, opponentCode, game } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!c || !oc || !g) {
      return Response.json({ error: "code, opponentCode and game required" }, { status: 400 });
    }
    if (c === oc) return Response.json({ error: "cannot challenge yourself" }, { status: 400 });

    const me = await store.players.findByCode(c);
    const opp = await store.players.findByCode(oc);
    if (!me) return Response.json({ error: "your player was not found — please register again" }, { status: 404 });
    if (!opp) return Response.json({ error: "no player found with that friend code" }, { status: 404 });

    const match = await store.matches.insert({
      game: g, status: "invited", vsAi: false,
      player1Id: me.id, player1Name: me.name,
      player2Id: opp.id, player2Name: opp.name,
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
