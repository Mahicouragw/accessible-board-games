"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveScore } from "@/lib/useSaveScore";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type Grid = number[][];

function empty(): Grid {
  return Array.from({ length: 4 }, () => Array(4).fill(0));
}
function addRandom(g: Grid): Grid {
  const cells: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => v === 0 && cells.push([r, c])));
  if (!cells.length) return g;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const ng = g.map((row) => [...row]);
  ng[r][c] = Math.random() < 0.9 ? 2 : 4;
  return ng;
}
function init(): Grid {
  return addRandom(addRandom(empty()));
}
function slide(row: number[]): { row: number[]; gained: number } {
  const nums = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < 4) nums.push(0);
  return { row: nums, gained };
}
function transpose(g: Grid): Grid {
  return g[0].map((_, c) => g.map((row) => row[c]));
}
function equal(a: Grid, b: Grid) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function canMove(g: Grid): boolean {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (g[r][c] === 0) return true;
      if (c < 3 && g[r][c] === g[r][c + 1]) return true;
      if (r < 3 && g[r][c] === g[r + 1][c]) return true;
    }
  return false;
}

const COLORS: Record<number, string> = {
  0: "bg-slate-800",
  2: "bg-slate-600 text-white",
  4: "bg-slate-500 text-white",
  8: "bg-orange-400 text-white",
  16: "bg-orange-500 text-white",
  32: "bg-red-400 text-white",
  64: "bg-red-500 text-white",
  128: "bg-yellow-400 text-slate-900",
  256: "bg-yellow-500 text-slate-900",
  512: "bg-emerald-400 text-slate-900",
  1024: "bg-emerald-500 text-white",
  2048: "bg-violet-500 text-white",
};

export default function Game2048() {
  const save = useSaveScore("2048");
  const [grid, setGrid] = useState<Grid>(init);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);

  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      setGrid((g) => {
        if (over) return g;
        let work = g.map((row) => [...row]);
        const rotate = dir === "up" || dir === "down";
        if (rotate) work = transpose(work);
        const reverse = dir === "right" || dir === "down";
        let gained = 0;
        work = work.map((row) => {
          const r = reverse ? [...row].reverse() : row;
          const { row: nr, gained: g2 } = slide(r);
          gained += g2;
          return reverse ? nr.reverse() : nr;
        });
        if (rotate) work = transpose(work);
        if (equal(work, g)) return g;
        const withNew = addRandom(work);
        setScore((s) => {
          const ns = s + gained;
          setBest((b) => Math.max(b, ns));
          return ns;
        });
        if (!canMove(withNew)) setOver(true);
        return withNew;
      });
    },
    [over],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        move(map[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);

  useEffect(() => {
    if (over && score > 0) save(score);
  }, [over, score, save]);

  // Sound + screen-reader feedback: tile-merge blips and the end-of-game
  // fanfare (win when a 2048+ tile exists, lose otherwise).
  const prevScore = useRef(0);
  useEffect(() => {
    if (score > prevScore.current) {
      sound.play("select");
      prevScore.current = score;
    }
  }, [score]);
  useEffect(() => {
    if (!over) return;
    const won = grid.some((row) => row.some((v) => v >= 2048));
    sound.play(won ? "win" : "lose");
    announce(
      won
        ? `You made 2048! Final score ${score}. 🎉`
        : `No moves left — game over with score ${score}.`,
    );
  }, [over, grid, score]);

  function reset() {
    setGrid(init());
    setScore(0);
    setOver(false);
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-3">
          <Box label="Score" value={score} />
          <Box label="Best" value={best} />
        </div>
        <button
          onClick={reset}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-400"
        >
          New Game
        </button>
      </div>

      <div className="relative rounded-2xl bg-slate-900 p-3">
        <div className="grid grid-cols-4 gap-3">
          {grid.flat().map((v, i) => (
            <div
              key={i}
              className={`grid aspect-square place-items-center rounded-xl text-2xl font-black ${
                COLORS[v] ?? "bg-violet-600 text-white"
              }`}
            >
              {v !== 0 ? v : ""}
            </div>
          ))}
        </div>
        {over && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/80">
            <div className="text-center">
              <div className="text-2xl font-bold">Game Over</div>
              <div className="mt-1 text-slate-400">Score: {score}</div>
              <button
                onClick={reset}
                className="mt-4 rounded-xl bg-violet-500 px-6 py-2 font-bold text-white"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
        <div />
        <Ctrl onClick={() => move("up")}>▲</Ctrl>
        <div />
        <Ctrl onClick={() => move("left")}>◀</Ctrl>
        <Ctrl onClick={() => move("down")}>▼</Ctrl>
        <Ctrl onClick={() => move("right")}>▶</Ctrl>
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">
        Use arrow keys or the on-screen buttons.
      </p>
    </div>
  );
}

function Box({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-800 px-4 py-2 text-center">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-lg font-black text-white">{value}</div>
    </div>
  );
}
function Ctrl({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center rounded-xl bg-slate-800 py-3 text-xl transition hover:bg-slate-700"
    >
      {children}
    </button>
  );
}
