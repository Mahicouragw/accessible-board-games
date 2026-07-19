"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveScore } from "@/lib/useSaveScore";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

const SIZE = 15;
type P = { x: number; y: number };

function rndFood(snake: P[]): P {
  let f: P;
  do {
    f = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
  } while (snake.some((s) => s.x === f.x && s.y === f.y));
  return f;
}

export default function Snake() {
  const save = useSaveScore("snake");
  const [snake, setSnake] = useState<P[]>([{ x: 7, y: 7 }]);
  const [food, setFood] = useState<P>({ x: 3, y: 3 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const dir = useRef<P>({ x: 1, y: 0 });
  const nextDir = useRef<P>({ x: 1, y: 0 });

  const reset = useCallback(() => {
    setSnake([{ x: 7, y: 7 }]);
    setFood(rndFood([{ x: 7, y: 7 }]));
    setScore(0);
    setOver(false);
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    setRunning(true);
  }, []);

  const turn = useCallback((x: number, y: number) => {
    // prevent reversing
    if (dir.current.x === -x && dir.current.y === -y) return;
    nextDir.current = { x, y };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const m: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (m[e.key]) {
        e.preventDefault();
        turn(m[e.key][0], m[e.key][1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [turn]);

  useEffect(() => {
    if (!running || over) return;
    const interval = setInterval(() => {
      setSnake((prev) => {
        dir.current = nextDir.current;
        const head = {
          x: prev[0].x + dir.current.x,
          y: prev[0].y + dir.current.y,
        };
        if (
          head.x < 0 ||
          head.x >= SIZE ||
          head.y < 0 ||
          head.y >= SIZE ||
          prev.some((s) => s.x === head.x && s.y === head.y)
        ) {
          setOver(true);
          setRunning(false);
          return prev;
        }
        const ate = head.x === food.x && head.y === food.y;
        const newSnake = [head, ...prev];
        if (ate) {
          sound.play("coin_drop");
          setScore((s) => {
            const ns = s + 10;
            setBest((b) => Math.max(b, ns));
            return ns;
          });
          setFood(rndFood(newSnake));
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, 130);
    return () => clearInterval(interval);
  }, [running, over, food]);

  useEffect(() => {
    if (over && score > 0) {
      sound.play("lose");
      announce(`Game over — final score ${score}. Say restart to play again.`);
      save(score);
    }
  }, [over, score, save]);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-3">
          <div className="rounded-xl bg-slate-800 px-4 py-2 text-center">
            <div className="text-xs uppercase text-slate-500">Score</div>
            <div className="text-lg font-black text-lime-400">{score}</div>
          </div>
          <div className="rounded-xl bg-slate-800 px-4 py-2 text-center">
            <div className="text-xs uppercase text-slate-500">Best</div>
            <div className="text-lg font-black text-white">{best}</div>
          </div>
        </div>
        <button
          onClick={reset}
          className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-lime-400"
        >
          {running ? "Restart" : "Start"}
        </button>
      </div>

      <div className="relative rounded-2xl bg-slate-900 p-2">
        <div
          className="grid gap-px overflow-hidden rounded-xl bg-slate-950"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
        >
          {Array.from({ length: SIZE * SIZE }).map((_, i) => {
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = snake.some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className={`aspect-square ${
                  isHead
                    ? "rounded-sm bg-lime-300"
                    : isBody
                      ? "rounded-sm bg-lime-500"
                      : isFood
                        ? "rounded-full bg-red-500"
                        : "bg-slate-900"
                }`}
              />
            );
          })}
        </div>

        {(!running || over) && (
          <div className="absolute inset-0 grid place-items-center rounded-2xl bg-slate-950/80">
            <div className="text-center">
              {over ? (
                <>
                  <div className="text-2xl font-bold">Game Over</div>
                  <div className="mt-1 text-slate-400">Score: {score}</div>
                </>
              ) : (
                <div className="text-xl font-bold">Ready?</div>
              )}
              <button
                onClick={reset}
                className="mt-4 rounded-xl bg-lime-500 px-6 py-2 font-bold text-slate-950"
              >
                {over ? "Play Again" : "Start Game"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
        <div />
        <Ctrl onClick={() => turn(0, -1)}>▲</Ctrl>
        <div />
        <Ctrl onClick={() => turn(-1, 0)}>◀</Ctrl>
        <Ctrl onClick={() => turn(0, 1)}>▼</Ctrl>
        <Ctrl onClick={() => turn(1, 0)}>▶</Ctrl>
      </div>
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
