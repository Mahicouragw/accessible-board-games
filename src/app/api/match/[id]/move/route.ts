import { db, isDbConfigured } from "@/db";
import { players, matches } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  checkTicTacToe,
  bestTicTacToeMove,
  checkConnectFour,
  bestConnectFourMove,
  c4DropRow,
} from "@/lib/games";
import { Chess, type Move } from "chess.js";

export const dynamic = "force-dynamic";

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function evalBoard(g: Chess): number {
  let s = 0;
  for (const row of g.board())
    for (const cell of row)
      if (cell) s += cell.color === "w" ? PIECE_VALUE[cell.type] : -PIECE_VALUE[cell.type];
  return s;
}

function chessAiMove(g: Chess): Move | null {
  const moves = g.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;
  const color = g.turn() === "w" ? 1 : -1;
  let best = -Infinity;
  let pick: Move[] = [];
  for (const m of moves) {
    g.move(m);
    let val: number;
    if (g.isCheckmate()) val = 99999;
    else {
      // one-ply reply search
      let worst = Infinity;
      const replies = g.moves({ verbose: true }) as Move[];
      if (!replies.length) worst = color * evalBoard(g);
      else
        for (const r of replies) {
          g.move(r);
          const e = color * evalBoard(g);
          g.undo();
          if (e < worst) worst = e;
        }
      val = worst + Math.random();
    }
    g.undo();
    if (val > best + 0.0001) {
      best = val;
      pick = [m];
    } else if (Math.abs(val - best) < 1) pick.push(m);
  }
  return pick[Math.floor(Math.random() * pick.length)] ?? moves[0];
}

async function applyResult(match: {
  player1Id: number | null;
  player2Id: number | null;
  vsAi: boolean;
}, winner: number) {
  // winner: 0 draw, 1 player1, 2 player2
  const bump = async (id: number | null, field: "wins" | "losses" | "draws") => {
    if (!id) return;
    const [p] = await db.select().from(players).where(eq(players.id, id));
    if (!p) return;
    await db
      .update(players)
      .set({
        [field]: p[field] + 1,
        totalGames: p.totalGames + 1,
        xp: p.xp + (field === "wins" ? 25 : field === "draws" ? 10 : 5),
      } as Partial<typeof players.$inferInsert>)
      .where(eq(players.id, id));
  };

  if (winner === 0) {
    await bump(match.player1Id, "draws");
    await bump(match.player2Id, "draws");
  } else if (winner === 1) {
    await bump(match.player1Id, "wins");
    await bump(match.player2Id, "losses");
  } else {
    await bump(match.player1Id, "losses");
    await bump(match.player2Id, "wins");
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const matchId = Number(id);
    const { code, move } = await req.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();

    const [player] = await db.select().from(players).where(eq(players.code, cleanCode));
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return Response.json({ error: "match not found" }, { status: 404 });
    if (match.status !== "active") {
      return Response.json({ error: "match not active", match }, { status: 400 });
    }

    const you = match.player1Id === player?.id ? 1 : match.player2Id === player?.id ? 2 : 0;
    if (you === 0) return Response.json({ error: "not in this match" }, { status: 403 });
    if (match.turn !== you) return Response.json({ error: "not your turn", match }, { status: 400 });

    let winner: number | null = null;

    if (match.game === "tic-tac-toe") {
      const board = [...(match.board as number[])];
      const idx = Number(move);
      if (idx < 0 || idx > 8 || board[idx] !== 0) {
        return Response.json({ error: "invalid move", match }, { status: 400 });
      }
      board[idx] = you;
      winner = checkTicTacToe(board);
      let turn = you === 1 ? 2 : 1;

      // AI responds
      if (winner === null && match.vsAi && turn === 2) {
        const aiMove = bestTicTacToeMove(board, 2);
        if (aiMove >= 0) board[aiMove] = 2;
        winner = checkTicTacToe(board);
        turn = 1;
      }

      const [updated] = await db
        .update(matches)
        .set({
          board,
          turn,
          winner,
          status: winner === null ? "active" : "finished",
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      if (winner !== null) await applyResult(match, winner);
      return Response.json({ match: updated });
    }

    if (match.game === "connect-four") {
      const board = (match.board as number[][]).map((r) => [...r]);
      const col = Number(move);
      if (col < 0 || col > 6) return Response.json({ error: "invalid move", match }, { status: 400 });
      const row = c4DropRow(board, col);
      if (row < 0) return Response.json({ error: "column full", match }, { status: 400 });
      board[row][col] = you;
      winner = checkConnectFour(board);
      let turn = you === 1 ? 2 : 1;

      if (winner === null && match.vsAi && turn === 2) {
        const aiCol = bestConnectFourMove(board, 2);
        const aiRow = c4DropRow(board, aiCol);
        if (aiRow >= 0) board[aiRow][aiCol] = 2;
        winner = checkConnectFour(board);
        turn = 1;
      }

      const [updated] = await db
        .update(matches)
        .set({
          board,
          turn,
          winner,
          status: winner === null ? "active" : "finished",
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      if (winner !== null) await applyResult(match, winner);
      return Response.json({ match: updated });
    }

    if (match.game === "chess") {
      const state = match.board as { fen: string };
      const g = new Chess(state.fen);
      // player1 = white, player2 = black
      const expected = you === 1 ? "w" : "b";
      if (g.turn() !== expected) {
        return Response.json({ error: "not your turn", match }, { status: 400 });
      }
      const mv = move as { from: string; to: string; promotion?: string };
      let res: Move | null = null;
      try {
        res = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion || "q" });
      } catch {
        res = null;
      }
      if (!res) return Response.json({ error: "illegal move", match }, { status: 400 });

      const decide = (): number | null => {
        if (g.isCheckmate()) return g.turn() === "w" ? 2 : 1; // side to move is checkmated
        if (g.isDraw() || g.isStalemate() || g.isThreefoldRepetition()) return 0;
        return null;
      };
      winner = decide();

      // AI reply (black)
      if (winner === null && match.vsAi && g.turn() === "b") {
        const aiMv = chessAiMove(g);
        if (aiMv) g.move(aiMv);
        winner = decide();
      }

      const turn = g.turn() === "w" ? 1 : 2;
      const [updated] = await db
        .update(matches)
        .set({
          board: { fen: g.fen() },
          turn,
          winner,
          status: winner === null ? "active" : "finished",
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId))
        .returning();

      if (winner !== null) await applyResult(match, winner);
      return Response.json({ match: updated });
    }

    return Response.json({ error: "unsupported game" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
