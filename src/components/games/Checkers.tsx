"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { useSaveScore } from "@/lib/useSaveScore";
import { announce } from "@/lib/a11y";

type Piece = { color: "red" | "black"; king: boolean } | null;
type Board = Piece[][];

const SIZE = 8;

function createInitialBoard(): Board {
  const board: Board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: "black", king: false };
    }
  }
  for (let r = 5; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) board[r][c] = { color: "red", king: false };
    }
  }
  return board;
}

type Move = { from: [number, number]; to: [number, number]; capture: boolean };

/** All legal moves for a piece. Kings move both ways; men move toward the far side. */
function pieceMoves(b: Board, r: number, c: number): Move[] {
  const piece = b[r][c];
  if (!piece) return [];
  const moves: Move[] = [];
  const dirs = piece.king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : piece.color === "red"
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !b[nr][nc]) {
      moves.push({ from: [r, c], to: [nr, nc], capture: false });
    }
    const jr = r + dr * 2;
    const jc = c + dc * 2;
    const mid = b[nr]?.[nc];
    if (
      jr >= 0 && jr < SIZE && jc >= 0 && jc < SIZE &&
      !b[jr][jc] && mid && mid.color !== piece.color
    ) {
      moves.push({ from: [r, c], to: [jr, jc], capture: true });
    }
  }
  return moves;
}

function allMoves(b: Board, color: "red" | "black"): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c]?.color === color) out.push(...pieceMoves(b, r, c));
    }
  }
  return out;
}

function hasAnyPiece(b: Board, color: "red" | "black"): boolean {
  return b.some((row) => row.some((p) => p?.color === color));
}

function applyMove(b: Board, m: Move): Board {
  const nb = b.map((row) => [...row]);
  const piece = nb[m.from[0]][m.from[1]];
  nb[m.from[0]][m.from[1]] = null;
  if (m.capture) {
    nb[(m.from[0] + m.to[0]) / 2][(m.from[1] + m.to[1]) / 2] = null;
  }
  if (piece && ((piece.color === "red" && m.to[0] === 0) || (piece.color === "black" && m.to[0] === SIZE - 1))) {
    piece.king = true;
  }
  nb[m.to[0]][m.to[1]] = piece;
  return nb;
}

function aiPickMove(b: Board): Move | null {
  const moves = allMoves(b, "black");
  if (!moves.length) return null;
  const captures = moves.filter((m) => m.capture);
  const pool = captures.length ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Checkers() {
  const save = useSaveScore("checkers");
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<"red" | "black">("red");
  const [winner, setWinner] = useState<"red" | "black" | null>(null);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState("Your turn (red). Tap a piece, then a highlighted square. Captures are forced!");
  const [mustJump, setMustJump] = useState<[number, number] | null>(null); // piece that must keep capturing
  const busyRef = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;

  useEffect(() => {
    sound.play("select");
    announce("Checkers vs the computer. You are red. Tap a piece to select it, then tap a green square to move. If a capture is available you must take it. Reach the far side to crown a king.");
  }, []);

  // Moves the current side may make right now (forced captures when available,
  // or a continuing multi-jump).
  const legalMoves = useCallback(
    (b: Board, color: "red" | "black", jumpFrom: [number, number] | null): Move[] => {
      if (jumpFrom) {
        return pieceMoves(b, jumpFrom[0], jumpFrom[1]).filter((m) => m.capture);
      }
      const all = allMoves(b, color);
      const captures = all.filter((m) => m.capture);
      return captures.length ? captures : all;
    },
    [],
  );

  const finishIfOver = useCallback((b: Board, nextTurn: "red" | "black"): boolean => {
    if (!hasAnyPiece(b, nextTurn) || allMoves(b, nextTurn).length === 0) {
      const w = nextTurn === "red" ? "black" : "red";
      setWinner(w);
      if (w === "red") {
        sound.play("win");
        setWins((wn) => {
          save(wn + 1);
          return wn + 1;
        });
        announce("Checkers over. You win! Tap Play Again for a new game.");
        setMsg("🎉 You win! Tap Play Again.");
      } else {
        sound.play("lose");
        announce("Checkers over. The computer wins. Tap Play Again.");
        setMsg("😔 Computer wins. Tap Play Again.");
      }
      return true;
    }
    return false;
  }, [save]);

  const doMove = useCallback(
    (b: Board, m: Move, color: "red" | "black") => {
      const nb = applyMove(b, m);
      setBoard(nb);
      if (m.capture) {
        sound.play("capture");
        announce(`Capture! ${color} takes a piece.`);
        // Multi-jump: same piece can capture again → same side continues
        const more = pieceMoves(nb, m.to[0], m.to[1]).filter((x) => x.capture);
        if (more.length > 0) {
          setMustJump(m.to);
          setTurn(color);
          setMsg(`${color === "red" ? "You" : "Computer"} must jump again with the same piece!`);
          announce("Jump again with the same piece!");
          return;
        }
      } else {
        sound.play("checkers_move");
      }
      setMustJump(null);
      const next = color === "red" ? "black" : "red";
      setSelected(null);
      if (finishIfOver(nb, next)) return;
      setTurn(next);
      setMsg(next === "red" ? "Your turn (red)." : "Computer is thinking…");
    },
    [finishIfOver],
  );

  // AI turn
  useEffect(() => {
    if (winner || turn !== "black" || mustJump) return;
    busyRef.current = true;
    const t = setTimeout(() => {
      const m = aiPickMove(boardRef.current);
      if (m) doMove(boardRef.current, m, "black");
      busyRef.current = false;
    }, 750);
    return () => clearTimeout(t);
  }, [turn, winner, mustJump, board, doMove]);

  const handleClick = (r: number, c: number) => {
    if (winner || turn !== "red" || busyRef.current) return;
    const piece = board[r][c];
    const moves = legalMoves(board, "red", mustJump);

    if (selected) {
      const [sr, sc] = selected;
      const mv = moves.find((m) => m.from[0] === sr && m.from[1] === sc && m.to[0] === r && m.to[1] === c);
      if (mv) {
        doMove(board, mv, "red");
        return;
      }
      // reselect another own piece
      if (piece && piece.color === "red" && moves.some((m) => m.from[0] === r && m.from[1] === c)) {
        setSelected([r, c]);
        sound.play("select");
        return;
      }
      setSelected(null);
      return;
    }
    if (piece && piece.color === "red" && moves.some((m) => m.from[0] === r && m.from[1] === c)) {
      setSelected([r, c]);
      sound.play("select");
      const n = moves.filter((m) => m.from[0] === r && m.from[1] === c).length;
      announce(`Selected red ${piece.king ? "king" : "piece"} at row ${r + 1} col ${c + 1}. ${n} move${n > 1 ? "s" : ""} available.`);
    }
  };

  const reset = () => {
    setBoard(createInitialBoard());
    setSelected(null);
    setTurn("red");
    setWinner(null);
    setMustJump(null);
    setMsg("Your turn (red). Tap a piece, then a highlighted square. Captures are forced!");
    sound.play("click");
  };

  const selMoves = selected ? legalMoves(board, "red", mustJump).filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1]) : [];

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-violet-500/30 bg-violet-500/10 p-3">
        <h2 className="font-bold flex items-center gap-2">♟️ Checkers vs Computer</h2>
        <p className="text-xs text-slate-400">You are red. Captures are forced, multi-jumps keep your turn, reach the far row to crown a 👑 king.</p>
        <div className="mt-2 flex justify-between text-xs">
          <span className={`px-2 py-1 rounded-full ${turn === "red" && !winner ? "bg-red-500 text-white" : "bg-slate-700 text-slate-400"}`}>🔴 You {turn === "red" && !winner ? "• Turn" : ""}</span>
          <span className={`px-2 py-1 rounded-full ${turn === "black" && !winner ? "bg-slate-700 border border-white text-white" : "bg-slate-700 text-slate-400"}`}>⚫ Computer {turn === "black" && !winner ? "• Turn" : ""}</span>
          <span className="text-emerald-400 font-bold">Wins: {wins}</span>
        </div>
      </div>

      {winner && (
        <div className={`rounded-2xl p-4 text-center text-lg font-bold ${winner === "red" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
          {winner === "red" ? "🎉 You win!" : "😔 Computer wins"}
        </div>
      )}

      <div className="grid grid-cols-8 gap-0 rounded-xl overflow-hidden border-4 border-amber-900 shadow-2xl mx-auto" style={{ maxWidth: "400px" }}>
        {board.map((row, r) =>
          row.map((piece, c) => {
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isValidMove = selMoves.some((m) => m.to[0] === r && m.to[1] === c);
            const isDark = (r + c) % 2 === 1;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                disabled={!!winner}
                className={`aspect-square w-full flex items-center justify-center text-xl relative
                  ${isDark ? "bg-amber-800" : "bg-amber-100"}
                  ${isSelected ? "ring-4 ring-white z-10" : ""}
                  ${isValidMove ? "bg-emerald-400/50" : ""}
                `}
                aria-label={`Row ${r+1} Col ${c+1} ${piece ? `${piece.color} ${piece.king ? "king" : "piece"}` : "empty"}${isValidMove ? ", legal move" : ""}${isSelected ? ", selected" : ""}`}
              >
                {piece && (
                  <span className={`h-6 w-6 rounded-full grid place-items-center border-2 shadow-md text-xs
                    ${piece.color === "red" ? "bg-red-500 border-red-700 text-white" : "bg-slate-800 border-slate-600 text-white"}
                    ${piece.king ? "ring-2 ring-yellow-400" : ""}
                  `}>
                    {piece.king ? "👑" : ""}
                  </span>
                )}
                {isValidMove && !piece && <span className="h-3 w-3 rounded-full bg-emerald-400/80"></span>}
              </button>
            );
          })
        )}
      </div>

      <p className="text-center text-sm text-slate-300" role="status">{msg}</p>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold text-white">
          {winner ? "Play Again ♻️" : "Reset ♻️"}
        </button>
        <button onClick={() => sound.play("checkers_move")} className="rounded-xl bg-violet-600 px-4 py-2 text-xs text-white">🔊 Wood Sound</button>
      </div>
    </div>
  );
}
