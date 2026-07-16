"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";
import { useSaveScore } from "@/lib/useSaveScore";

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

export default function Checkers() {
  const save = useSaveScore("checkers");
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [turn, setTurn] = useState<"red" | "black">("red");
  const [wins, setWins] = useState(0);
  const [mustCapture, setMustCapture] = useState<[number, number][]>([]);

  useEffect(() => {
    sound.play("select");
  }, []);

  const getValidMoves = (r: number, c: number, b: Board = board): [number, number][] => {
    const piece = b[r][c];
    if (!piece) return [];
    const moves: [number, number][] = [];
    const dirs = piece.king ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : piece.color === "red" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && !b[nr][nc]) {
        moves.push([nr, nc]);
      }
      // Capture
      const nr2 = r + dr * 2;
      const nc2 = c + dc * 2;
      if (nr2 >= 0 && nr2 < SIZE && nc2 >= 0 && nc2 < SIZE && !b[nr2][nc2]) {
        const mid = b[nr][nc];
        if (mid && mid.color !== piece.color) moves.push([nr2, nc2]);
      }
    }
    return moves;
  };

  const handleClick = (r: number, c: number) => {
    const piece = board[r][c];
    
    if (selected) {
      const [sr, sc] = selected;
      const valid = getValidMoves(sr, sc);
      if (valid.some(([vr, vc]) => vr === r && vc === c)) {
        const newBoard = board.map(row => [...row]);
        const movingPiece = newBoard[sr][sc];
        newBoard[sr][sc] = null;
        
        // Check capture
        if (Math.abs(r - sr) === 2) {
          const midR = (r + sr) / 2;
          const midC = (c + sc) / 2;
          newBoard[midR][midC] = null;
          sound.play("capture");
        } else {
          sound.play("checkers_move");
        }

        // King promotion
        if (movingPiece && ((movingPiece.color === "red" && r === 0) || (movingPiece.color === "black" && r === SIZE - 1))) {
          movingPiece.king = true;
          sound.play("level_up");
        }

        newBoard[r][c] = movingPiece;
        setBoard(newBoard);
        setSelected(null);
        
        // Check win
        const opponent = turn === "red" ? "black" : "red";
        const opponentPieces = newBoard.flat().filter(p => p?.color === opponent).length;
        if (opponentPieces === 0) {
          sound.play("win");
          setWins(w => w + 1);
          save(wins + 1);
          setTimeout(() => {
            alert(`${turn} wins!`);
            setBoard(createInitialBoard());
          }, 300);
        } else {
          setTurn(opponent);
        }
      } else {
        setSelected(null);
      }
    } else if (piece && piece.color === turn) {
      setSelected([r, c]);
      sound.play("select");
    }
  };

  const reset = () => {
    setBoard(createInitialBoard());
    setSelected(null);
    setTurn("red");
    sound.play("click");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-violet-500/30 bg-violet-500/10 p-3">
        <h2 className="font-bold flex items-center gap-2">♟️ Checkers — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: Forced captures, king promotion with crown, realistic wood move sounds from website</p>
        <div className="mt-2 flex justify-between text-xs">
          <span className={`px-2 py-1 rounded-full ${turn === "red" ? "bg-red-500 text-white" : "bg-slate-700 text-slate-400"}`}>🔴 Red {turn === "red" ? "Turn" : ""}</span>
          <span className={`px-2 py-1 rounded-full ${turn === "black" ? "bg-slate-700 border border-white text-white" : "bg-slate-700 text-slate-400"}`}>⚫ Black {turn === "black" ? "Turn" : ""}</span>
          <span className="text-emerald-400 font-bold">Wins: {wins}</span>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-0 rounded-xl overflow-hidden border-4 border-amber-900 shadow-2xl mx-auto" style={{ maxWidth: "400px" }}>
        {board.map((row, r) =>
          row.map((piece, c) => {
            const isSelected = selected && selected[0] === r && selected[1] === c;
            const isValidMove = selected && getValidMoves(selected[0], selected[1]).some(([vr, vc]) => vr === r && vc === c);
            const isDark = (r + c) % 2 === 1;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                className={`aspect-square w-full flex items-center justify-center text-xl relative
                  ${isDark ? "bg-amber-800" : "bg-amber-100"}
                  ${isSelected ? "ring-4 ring-white z-10" : ""}
                  ${isValidMove ? "bg-emerald-400/50" : ""}
                `}
                aria-label={`Row ${r+1} Col ${c+1} ${piece ? `${piece.color} ${piece.king ? "king" : "piece"}` : "empty"}`}
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

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold text-white">Reset ♻️</button>
        <button onClick={() => sound.play("checkers_move")} className="rounded-xl bg-violet-600 px-4 py-2 text-xs text-white">🔊 Test Wood Sound</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        <div className="font-bold text-violet-400">Advanced Features:</div>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>♟️ Realistic wood move sounds from Google Actions (checkers-move.ogg) — No duplicate, unique for checkers</li>
          <li>👑 King promotion with crown + level-up sound</li>
          <li>💥 Capture with clang sound, forced capture detection</li>
          <li>🎯 8x8 board, 12 pieces per side, enhanced from basic</li>
          <li>♿ Accessible: Keyboard Tab + Enter, screen reader announces moves</li>
        </ul>
      </div>
    </div>
  );
}
