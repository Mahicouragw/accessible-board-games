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
    const { code, opponentCode, opponentName, game } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();
    const on = String(opponentName ?? "").trim().slice(0, 24);
    const g = String(game ?? "").trim();
    if (!c || (!oc && !on) || !g) {
      return Response.json({ error: "code, opponent (name or ID) and game required" }, { status: 400 });
    }

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "your player was not found — please register again" }, { status: 404 });
    // Resolve opponent by Player ID first, then by NAME (friends invite by name;
    // IDs are only for logging in).
    let opp = oc ? await store.players.findByCode(oc) : null;
    if (!opp && on) opp = await store.players.findByName(on);
    if (!opp && on) opp = await store.players.findByCode(on.toUpperCase());
    if (!opp) {
      return Response.json({ error: on ? `No player named "${on}" is registered yet.` : "No player found with that ID." }, { status: 404 });
    }
    if (Number(opp.id) === Number(me.id)) return Response.json({ error: "cannot challenge yourself" }, { status: 400 });

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
