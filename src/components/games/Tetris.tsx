"use client";

import { useState, useEffect, useCallback } from "react";
import { sound } from "@/lib/sound";

const ROWS = 15;
const COLS = 10;

type Tetromino = { shape: number[][]; color: string };

const TETROMINOS: Tetromino[] = [
  { shape: [[1,1,1,1]], color: "#06b6d4" }, // I
  { shape: [[1,1],[1,1]], color: "#eab308" }, // O
  { shape: [[0,1,0],[1,1,1]], color: "#a855f7" }, // T
  { shape: [[1,0,0],[1,1,1]], color: "#3b82f6" }, // J
  { shape: [[0,0,1],[1,1,1]], color: "#f97316" }, // L
  { shape: [[1,1,0],[0,1,1]], color: "#22c55e" }, // S
  { shape: [[0,1,1],[1,1,0]], color: "#ef4444" }, // Z
];

export default function Tetris() {
  const [board, setBoard] = useState<(string | null)[][]>(() => Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
  const [current, setCurrent] = useState<{ piece: Tetromino; r: number; c: number }>(() => ({ piece: TETROMINOS[0], r: 0, c: 3 }));
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const spawnPiece = useCallback(() => {
    const piece = TETROMINOS[Math.floor(Math.random() * TETROMINOS.length)];
    setCurrent({ piece, r: 0, c: 3 });
    // Check game over
    if (board[0].some(cell => cell !== null) || board[1].some(cell => cell !== null)) {
      setGameOver(true);
      sound.play("lose");
    }
  }, [board]);

  const isValid = (r: number, c: number, shape: number[][]) => {
    for (let i = 0; i < shape.length; i++) {
      for (let j = 0; j < shape[i].length; j++) {
        if (shape[i][j]) {
          const nr = r + i, nc = c + j;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return false;
        }
      }
    }
    return true;
  };

  const placePiece = () => {
    const newBoard = board.map(row => [...row]);
    current.piece.shape.forEach((row, i) => {
      row.forEach((cell, j) => {
        if (cell) {
          const r = current.r + i, c = current.c + j;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            newBoard[r][c] = current.piece.color;
          }
        }
      });
    });

    // Clear lines
    let cleared = 0;
    const filtered = newBoard.filter(row => {
      if (row.every(cell => cell !== null)) {
        cleared++;
        return false;
      }
      return true;
    });
    while (filtered.length < ROWS) {
      filtered.unshift(Array(COLS).fill(null));
    }

    if (cleared > 0) {
      sound.play("level_up");
      setScore(s => s + cleared * 100);
      setLines(l => l + cleared);
    } else {
      sound.play("move");
    }

    setBoard(filtered);
    spawnPiece();
  };

  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      if (isValid(current.r + 1, current.c, current.piece.shape)) {
        setCurrent(c => ({ ...c, r: c.r + 1 }));
      } else {
        placePiece();
      }
    }, 800);
    return () => clearInterval(id);
  }, [current, board, gameOver]);

  const move = (dr: number, dc: number) => {
    if (gameOver) return;
    if (isValid(current.r + dr, current.c + dc, current.piece.shape)) {
      setCurrent(c => ({ r: c.r + dr, c: c.c + dc, piece: c.piece }));
      sound.play("select");
    }
  };

  const rotate = () => {
    const rotated = current.piece.shape[0].map((_, i) => current.piece.shape.map(row => row[i]).reverse());
    if (isValid(current.r, current.c, rotated)) {
      setCurrent(c => ({ ...c, piece: { ...c.piece, shape: rotated } }));
      sound.play("turn");
    }
  };

  const reset = () => {
    setBoard(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    setScore(0);
    setLines(0);
    setGameOver(false);
    spawnPiece();
    sound.play("click");
  };

  useEffect(() => {
    spawnPiece();
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-violet-500/30 bg-violet-500/10 p-3">
        <h2 className="font-bold">🧱 Tetris — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: 10x15 board, 7 tetrominoes, line clear with level-up sound from website, realistic move sounds</p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border">Score: {score}</span>
          <span className="px-2 py-1 rounded-full bg-sky-500/20 text-sky-400 border">Lines: {lines}</span>
          {gameOver && <span className="px-2 py-1 rounded-full bg-rose-500 text-white">Game Over!</span>}
        </div>
      </div>

      <div className="grid gap-0 rounded-xl overflow-hidden border-4 border-slate-700 bg-slate-900 mx-auto" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, maxWidth: "300px" }}>
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isCurrent = current.piece.shape.some((pr, ri) => pr.some((pc, ci) => pc && current.r + ri === r && current.c + ci === c));
            const color = isCurrent ? current.piece.color : cell;
            return (
              <div
                key={`${r}-${c}`}
                className="aspect-square border border-slate-800/50"
                style={{ backgroundColor: color || "#1e293b" }}
              />
            );
          })
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        <button onClick={() => move(0, -1)} className="rounded-xl bg-slate-700 py-3 text-sm font-bold">← Left</button>
        <button onClick={() => move(1, 0)} className="rounded-xl bg-slate-700 py-3 text-sm font-bold">↓ Down</button>
        <button onClick={() => move(0, 1)} className="rounded-xl bg-slate-700 py-3 text-sm font-bold">Right →</button>
        <button onClick={rotate} className="col-span-3 rounded-xl bg-violet-600 py-2 text-sm font-bold text-white">Rotate ↻ Turn Sound 🔊</button>
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">Reset ♻️</button>
        <button onClick={() => sound.play("level_up")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white">Level Up 🔊</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        Advanced: Unique realistic sounds - level-up.ogg from website, no duplicate
      </div>
    </div>
  );
}
