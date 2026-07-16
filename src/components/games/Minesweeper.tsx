"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";

const ROWS = 10;
const COLS = 10;
const MINES = 15;

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };

function createBoard(): Cell[][] {
  const board: Cell[][] = Array(ROWS).fill(null).map(() => Array(COLS).fill(null).map(() => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })));
  let minesPlaced = 0;
  while (minesPlaced < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      minesPlaced++;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacent = count;
    }
  }
  return board;
}

export default function Minesweeper() {
  const [board, setBoard] = useState<Cell[][]>(createBoard());
  const [gameOver, setGameOver] = useState<"win" | "lose" | null>(null);
  const [wins, setWins] = useState(0);

  const reveal = (r: number, c: number) => {
    if (gameOver || board[r][c].revealed || board[r][c].flagged) return;
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    
    if (newBoard[r][c].mine) {
      newBoard[r][c].revealed = true;
      setBoard(newBoard);
      setGameOver("lose");
      sound.play("lose");
      sound.play("capture");
      return;
    }

    const flood = (fr: number, fc: number) => {
      if (fr < 0 || fr >= ROWS || fc < 0 || fc >= COLS || newBoard[fr][fc].revealed || newBoard[fr][fc].flagged) return;
      newBoard[fr][fc].revealed = true;
      if (newBoard[fr][fc].adjacent === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            flood(fr + dr, fc + dc);
          }
        }
      }
    };

    flood(r, c);
    setBoard(newBoard);
    sound.play("select");

    const revealedCount = newBoard.flat().filter(cell => cell.revealed).length;
    if (revealedCount === ROWS * COLS - MINES) {
      setGameOver("win");
      sound.play("win");
      setWins(w => w + 1);
    }
  };

  const toggleFlag = (r: number, c: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (gameOver || board[r][c].revealed) return;
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    newBoard[r][c].flagged = !newBoard[r][c].flagged;
    setBoard(newBoard);
    sound.play("click");
  };

  const reset = () => {
    setBoard(createBoard());
    setGameOver(null);
    sound.play("click");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-3">
        <h2 className="font-bold">💣 Minesweeper — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: 10x10 grid, 15 mines, flood reveal, flag with right-click, realistic click sounds from website</p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300">Mines: {MINES}</span>
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border">Wins: {wins}</span>
          {gameOver && <span className={`px-2 py-1 rounded-full font-bold ${gameOver === "win" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{gameOver === "win" ? "You Win!" : "Game Over!"}</span>}
        </div>
      </div>

      <div className="grid gap-0 rounded-xl overflow-hidden border-4 border-slate-700 mx-auto" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, maxWidth: "400px" }}>
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => reveal(r, c)}
              onContextMenu={(e) => toggleFlag(r, c, e)}
              className={`aspect-square flex items-center justify-center text-xs font-bold border border-slate-700
                ${cell.revealed ? (cell.mine ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-200") : "bg-slate-600 hover:bg-slate-500 text-transparent"}
                ${cell.flagged ? "bg-amber-500/50" : ""}
              `}
              aria-label={`Row ${r+1} Col ${c+1} ${cell.revealed ? (cell.mine ? "mine" : cell.adjacent || "empty") : cell.flagged ? "flagged" : "hidden"}`}
            >
              {cell.flagged ? "🚩" : cell.revealed ? (cell.mine ? "💣" : cell.adjacent || "") : ""}
            </button>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">Reset ♻️ New Game</button>
        <button onClick={() => sound.play("click")} className="rounded-xl bg-violet-600 px-4 py-2 text-xs text-white">🔊 Click Sound</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        <div className="font-bold text-amber-400">Advanced: Realistic sounds from website (click-real.ogg) - No duplicate, unique for Minesweeper</div>
        <ul className="list-disc list-inside mt-1">
          <li>💣 Mine reveal with explosion sound (capture.wav)</li>
          <li>🚩 Flag with click, flood reveal for empty cells</li>
          <li>10x10 advanced, right-click to flag</li>
        </ul>
      </div>
    </div>
  );
}
