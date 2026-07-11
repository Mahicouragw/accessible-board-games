import { db, isDbConfigured } from "@/db";
import { players, matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Chess } from "chess.js";

export const dynamic = "force-dynamic";

function initBoard(game: string): unknown {
  if (game === "connect-four") return Array.from({ length: 6 }, () => Array(7).fill(0));
  if (game === "chess") return { fen: new Chess().fen() };
  return Array(9).fill(0);
}

export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { code, opponentCode, game } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!c || !oc || !g) {
      return Response.json({ error: "code, opponentCode and game required" }, { status: 400 });
    }
    if (c === oc) return Response.json({ error: "cannot challenge yourself" }, { status: 400 });

    const [me] = await db.select().from(players).where(eq(players.code, c));
    const [opp] = await db.select().from(players).where(eq(players.code, oc));
    if (!me || !opp) return Response.json({ error: "player not found" }, { status: 404 });

    const [match] = await db
      .insert(matches)
      .values({
        game: g,
        status: "invited",
        vsAi: false,
        player1Id: me.id,
        player1Name: me.name,
        player2Id: opp.id,
        player2Name: opp.name,
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
