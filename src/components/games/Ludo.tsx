"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

// 52-cell main loop as [row,col] on a 15x15 grid, clockwise from Red start.
const PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

type Color = "red" | "green" | "yellow" | "blue";
const COLORS: Color[] = ["red", "green", "yellow", "blue"];
const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
const HOME: Record<Color, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};
const YARD: Record<Color, [number, number][]> = {
  red: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};
const HEX: Record<Color, string> = {
  red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#3b82f6",
};
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const FINISH = 56;
const CELL = 34; // px

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// position (-1 base, 0..50 main, 51..56 home) -> [row,col] grid
function coord(color: Color, p: number, tokenIdx: number): [number, number] {
  if (p < 0) return YARD[color][tokenIdx];
  if (p <= 50) return PATH[(START[color] + p) % 52];
  return HOME[color][p - 51];
}
function absMain(color: Color, p: number): number | null {
  if (p < 0 || p > 50) return null;
  return (START[color] + p) % 52;
}

type Tokens = Record<Color, number[]>;

export default function Ludo() {
  const save = useSaveScore("ludo");
  const [tokens, setTokens] = useState<Tokens>({
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1],
  });
  const [turn, setTurn] = useState<Color>("red");
  const [dice, setDice] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState<"roll" | "select" | "busy" | "over">("roll");
  const [msg, setMsg] = useState("Your turn — roll the dice!");
  const [movable, setMovable] = useState<number[]>([]);
  const [wins, setWins] = useState(0);
  const cancelled = useRef(false);

  const human: Color = "red";

  const getMovable = useCallback((tk: Tokens, color: Color, roll: number): number[] => {
    const res: number[] = [];
    tk[color].forEach((p, i) => {
      if (p === FINISH) return;
      if (p < 0) {
        if (roll === 6) res.push(i);
      } else if (p + roll <= FINISH) {
        res.push(i);
      }
    });
    return res;
  }, []);

  const applyMove = useCallback(
    async (color: Color, idx: number, roll: number) => {
      setPhase("busy");
      // snapshot working copy
      let working: Tokens = {
        red: [...tokens.red],
        green: [...tokens.green],
        yellow: [...tokens.yellow],
        blue: [...tokens.blue],
      };
      const start = working[color][idx];
      let captured = false;
      let reachedHome = false;

      if (start < 0) {
        working[color][idx] = 0;
        setTokens({ ...working });
        sound.play("move");
        await delay(200);
      } else {
        for (let s = 1; s <= roll; s++) {
          working = {
            red: [...working.red],
            green: [...working.green],
            yellow: [...working.yellow],
            blue: [...working.blue],
          };
          working[color][idx] = start + s;
          setTokens(working);
          sound.play("move");
          await delay(150);
        }
      }
      if (cancelled.current) return;

      const finalP = working[color][idx];
      if (finalP === FINISH) reachedHome = true;

      // capture check
      const ai = absMain(color, finalP);
      if (ai !== null && !SAFE.has(ai)) {
        for (const other of COLORS) {
          if (other === color) continue;
          working[other].forEach((op, oi) => {
            if (absMain(other, op) === ai) {
              working = { ...working, [other]: [...working[other]] };
              working[other][oi] = -1;
              captured = true;
            }
          });
        }
        if (captured) {
          setTokens({ ...working });
          sound.play("capture");
          announce(`${color} captured an opponent's token!`);
          await delay(250);
        }
      }

      // win check
      if (working[color].every((p) => p === FINISH)) {
        setPhase("over");
        if (color === human) {
          sound.play("win");
          announce("You got all tokens home. You win!");
          setMsg("🎉 You win Ludo!");
          setWins((w) => {
            const nw = w + 1;
            save(nw);
            return nw;
          });
        } else {
          sound.play("lose");
          announce(`${color} won the game.`);
          setMsg(`${color} wins 😔`);
        }
        return;
      }

      const extra = roll === 6 || captured || reachedHome;
      const nextColor = extra ? color : COLORS[(COLORS.indexOf(color) + 1) % 4];
      setTurn(nextColor);
      setDice(0);
      setPhase("roll");
      setMovable([]);
      if (nextColor === human) {
        setMsg(extra ? "Bonus roll — go again!" : "Your turn — roll the dice!");
      } else {
        setMsg(`${nextColor}'s turn…`);
      }
    },
    [tokens, save],
  );

  const roll = useCallback(
    async (color: Color) => {
      if (phase !== "roll") return;
      setPhase("busy");
      setRolling(true);
      sound.play("dice");
      const r = 1 + Math.floor(Math.random() * 6);
      await delay(600);
      setDice(r);
      setRolling(false);
      announce(`${color} rolled ${r}`);
      const mv = getMovable(tokens, color, r);
      if (mv.length === 0) {
        setMsg(`${color} rolled ${r} — no moves.`);
        await delay(700);
        if (cancelled.current) return;
        const next = COLORS[(COLORS.indexOf(color) + 1) % 4];
        setTurn(next);
        setDice(0);
        setPhase("roll");
        setMsg(next === human ? "Your turn — roll the dice!" : `${next}'s turn…`);
        return;
      }
      if (color === human) {
        setMovable(mv);
        setPhase("select");
        setMsg("Pick a token to move.");
        if (mv.length === 1) {
          // auto-move if only one option
          await delay(250);
          applyMove(color, mv[0], r);
        }
      } else {
        // AI choose best
        const best = chooseAi(tokens, color, mv, r);
        await delay(400);
        applyMove(color, best, r);
      }
    },
    [phase, tokens, getMovable, applyMove],
  );

  // AI turn driver
  useEffect(() => {
    if (turn !== human && phase === "roll") {
      const t = setTimeout(() => roll(turn), 700);
      return () => clearTimeout(t);
    }
  }, [turn, phase, roll]);

  useEffect(() => {
    cancelled.current = false;
    announce("Ludo. You are red. Roll the dice to begin.");
    return () => {
      cancelled.current = true;
    };
  }, []);

  function reset() {
    cancelled.current = false;
    setTokens({
      red: [-1, -1, -1, -1],
      green: [-1, -1, -1, -1],
      yellow: [-1, -1, -1, -1],
      blue: [-1, -1, -1, -1],
    });
    setTurn("red");
    setDice(0);
    setPhase("roll");
    setMovable([]);
    setMsg("Your turn — roll the dice!");
    sound.play("click");
  }

  const boardPx = CELL * 15;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 grid grid-cols-4 gap-2">
        {COLORS.map((c) => (
          <div
            key={c}
            className={`rounded-xl border px-2 py-1.5 text-center ${
              turn === c ? "border-white ring-2 ring-white/60" : "border-slate-800"
            }`}
            style={{ background: `${HEX[c]}22` }}
          >
            <div className="text-xs font-bold capitalize" style={{ color: HEX[c] }}>
              {c === human ? "You" : c}
            </div>
            <div className="text-[10px] text-slate-400">
              {tokens[c].filter((p) => p === FINISH).length}/4 home
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto overflow-auto">
        <div
          className="relative mx-auto rounded-xl bg-white shadow-2xl"
          style={{ width: boardPx, height: boardPx }}
          role="img"
          aria-label="Ludo board"
        >
          {/* Quadrant yards */}
          <Yard color="red" top={0} left={0} />
          <Yard color="green" top={0} left={9 * CELL} />
          <Yard color="blue" top={9 * CELL} left={0} />
          <Yard color="yellow" top={9 * CELL} left={9 * CELL} />

          {/* Path cells */}
          {PATH.map(([r, c], i) => {
            const startColor = (Object.keys(START) as Color[]).find((k) => START[k] === i);
            const bg = startColor ? HEX[startColor] : SAFE.has(i) ? "#e2e8f0" : "#f8fafc";
            return (
              <div
                key={`p${i}`}
                className="absolute border border-slate-300"
                style={{ top: r * CELL, left: c * CELL, width: CELL, height: CELL, background: bg }}
              />
            );
          })}
          {/* Home stretches */}
          {COLORS.map((color) =>
            HOME[color].slice(0, 5).map(([r, c], i) => (
              <div
                key={`h${color}${i}`}
                className="absolute border border-slate-300"
                style={{ top: r * CELL, left: c * CELL, width: CELL, height: CELL, background: `${HEX[color]}aa` }}
              />
            )),
          )}
          {/* Center */}
          <div
            className="absolute grid place-items-center border border-slate-300 text-2xl"
            style={{ top: 6 * CELL, left: 6 * CELL, width: 3 * CELL, height: 3 * CELL, background: "#334155" }}
          >
            🏠
          </div>

          {/* Tokens */}
          {COLORS.map((color) =>
            tokens[color].map((p, idx) => {
              const [r, c] = coord(color, p, idx);
              const canMove = color === human && phase === "select" && movable.includes(idx);
              return (
                <button
                  key={`${color}${idx}`}
                  onClick={() => canMove && applyMove(color, idx, dice)}
                  disabled={!canMove}
                  aria-label={`${color === human ? "your" : color} token ${idx + 1}${
                    p < 0 ? " in base" : p === FINISH ? " home" : ` at step ${p}`
                  }${canMove ? ", tap to move" : ""}`}
                  className={`absolute grid place-items-center rounded-full border-2 border-white shadow-md transition-all duration-150 ${
                    canMove ? "animate-tokenPop ring-4 ring-white/80" : ""
                  }`}
                  style={{
                    top: r * CELL + CELL * 0.1,
                    left: c * CELL + CELL * 0.1,
                    width: CELL * 0.8,
                    height: CELL * 0.8,
                    background: HEX[color],
                    zIndex: canMove ? 20 : 10,
                    cursor: canMove ? "pointer" : "default",
                  }}
                >
                  <span className="h-1/3 w-1/3 rounded-full bg-white/70" />
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl bg-white text-3xl text-slate-900 ${
            rolling ? "animate-diceRoll" : ""
          }`}
          aria-hidden
        >
          {dice ? ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][dice] : "🎲"}
        </div>
        <p className="flex-1 px-3 text-center text-sm text-slate-300">{msg}</p>
        {phase === "over" ? (
          <button onClick={reset} className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950">
            Play Again
          </button>
        ) : (
          <button
            onClick={() => roll(human)}
            disabled={turn !== human || phase !== "roll"}
            aria-label="Roll the dice"
            className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            Roll
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Wins: {wins} · Roll 6 to leave base & get a bonus turn.</p>
    </div>
  );
}

function chooseAi(tokens: Tokens, color: Color, movable: number[], roll: number): number {
  let best = movable[0];
  let bestScore = -Infinity;
  for (const idx of movable) {
    const p = tokens[color][idx];
    let score = 0;
    const newP = p < 0 ? 0 : p + roll;
    // capture bonus
    const ai = absMain(color, newP);
    if (ai !== null && !SAFE.has(ai)) {
      for (const other of COLORS) {
        if (other === color) continue;
        if (tokens[other].some((op) => absMain(other, op) === ai)) score += 100;
      }
    }
    if (p < 0) score += 40; // leave base
    if (newP === FINISH) score += 60; // reach home
    score += newP; // advance
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return best;
}

function Yard({ color, top, left }: { color: Color; top: number; left: number }) {
  return (
    <div
      className="absolute rounded-lg"
      style={{ top, left, width: 6 * CELL, height: 6 * CELL, background: `${HEX[color]}` }}
    >
      <div className="absolute inset-3 rounded-md bg-white" />
    </div>
  );
}
