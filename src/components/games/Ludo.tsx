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

type Props = {
  humanColors?: Color[]; // Which colors are human-controlled (for 4-player phone mode)
  onMove?: (color: Color, tokenIdx: number, roll: number) => void;
};

export default function Ludo({ humanColors = ["red"], onMove }: Props) {
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
  const [msg, setMsg] = useState("Your turn — roll the dice! Choose a color to play, move token with TalkBack!");
  const [movable, setMovable] = useState<number[]>([]);
  const [wins, setWins] = useState(0);
  const cancelled = useRef(false);

  const isHumanTurn = humanColors.includes(turn);

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
      onMove?.(color, idx, roll);
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
        sound.play("ludo_token");
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
        if (humanColors.includes(color)) {
          sound.play("win");
          announce(`${color} got all tokens home. ${color} wins!`);
          setMsg(`🎉 ${color} wins Ludo!`);
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
      if (humanColors.includes(nextColor)) {
        setMsg(extra ? `Bonus roll — ${nextColor} go again! Choose token to move!` : `${nextColor}'s turn — roll the dice! TalkBack: double tap roll, then choose token button`);
      } else {
        setMsg(`${nextColor}'s turn… AI thinking…`);
      }
    },
    [tokens, save, humanColors, onMove],
  );

  const roll = useCallback(
    async (color: Color) => {
      if (phase !== "roll") return;
      setPhase("busy");
      setRolling(true);
      sound.play("ludo_dice");
      const r = 1 + Math.floor(Math.random() * 6);
      await delay(600);
      setDice(r);
      setRolling(false);
      announce(`${color} rolled ${r}`);
      const mv = getMovable(tokens, color, r);
      if (mv.length === 0) {
        setMsg(`${color} rolled ${r} — no moves. Turn passes.`);
        await delay(700);
        if (cancelled.current) return;
        const next = COLORS[(COLORS.indexOf(color) + 1) % 4];
        setTurn(next);
        setDice(0);
        setPhase("roll");
        setMsg(humanColors.includes(next) ? `${next}'s turn — roll the dice!` : `${next}'s turn…`);
        return;
      }
      if (humanColors.includes(color)) {
        setMovable(mv);
        setPhase("select");
        setMsg(`${color} rolled ${r} — Pick a token to move! ${mv.length} movable token${mv.length > 1 ? "s" : ""}. TalkBack: Use token buttons below!`);
        if (mv.length === 1) {
          // For accessibility, don't auto-move, let user choose via button for TalkBack
          // await delay(250);
          // applyMove(color, mv[0], r);
        }
      } else {
        // AI choose best
        const best = chooseAi(tokens, color, mv, r);
        await delay(400);
        applyMove(color, best, r);
      }
    },
    [phase, tokens, getMovable, applyMove, humanColors],
  );

  // AI turn driver
  useEffect(() => {
    if (!humanColors.includes(turn) && phase === "roll") {
      const t = setTimeout(() => roll(turn), 700);
      return () => clearTimeout(t);
    }
  }, [turn, phase, roll, humanColors]);

  useEffect(() => {
    cancelled.current = false;
    announce(`Ludo. Red, Green, Yellow, Blue. Current turn ${turn}. Roll the dice to begin. TalkBack accessible with token buttons.`);
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
    setMsg("Your turn — roll the dice! Choose a color to play, move token with TalkBack!");
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
              turn === c ? "border-white ring-2 ring-white/60 scale-105" : "border-slate-800"
            } ${humanColors.includes(c) ? "ring-1 ring-emerald-500/50" : ""}`}
            style={{ background: `${HEX[c]}22` }}
          >
            <div className="text-xs font-bold capitalize flex items-center justify-center gap-1" style={{ color: HEX[c] }}>
              {c === "red" ? "🔴" : c === "green" ? "🟢" : c === "yellow" ? "🟡" : "🔵"} {c} {humanColors.includes(c) ? "You" : "AI"}
            </div>
            <div className="text-[10px] text-slate-400">
              {tokens[c].filter((p) => p === FINISH).length}/4 home {turn === c ? "• Turn" : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto overflow-auto">
        <div
          className="relative mx-auto rounded-xl bg-white shadow-2xl"
          style={{ width: boardPx, height: boardPx }}
          role="img"
          aria-label={`Ludo board, current turn ${turn}, ${humanColors.join(", ")} are human players, TalkBack accessible`}
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
              const canMove = humanColors.includes(color) && turn === color && phase === "select" && movable.includes(idx);
              return (
                <button
                  key={`${color}${idx}`}
                  onClick={() => canMove && applyMove(color, idx, dice)}
                  disabled={!canMove}
                  aria-label={`${color} token ${idx + 1} ${p < 0 ? "in base yard" : p === FINISH ? "finished home" : `on board at step ${p}`} ${canMove ? ", tap to move, TalkBack double tap" : isHumanTurn ? "not movable, need 6 to leave base" : ""} ${humanColors.includes(color) ? "your token" : color + " AI token"}`}
                  className={`absolute grid place-items-center rounded-full border-2 border-white shadow-md transition-all duration-150 ${
                    canMove ? "animate-tokenPop ring-4 ring-white/80 scale-110" : ""
                  } ${humanColors.includes(color) ? "ring-1 ring-emerald-400/50" : ""}`}
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
                  {canMove && <span className="absolute -top-1 -right-1 text-[8px] bg-white text-black rounded-full px-1">Move!</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Accessible Token Move Buttons for TalkBack - Large, clear buttons */}
      {phase === "select" && isHumanTurn && movable.length > 0 && (
        <div className="mt-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3">
          <div className="font-bold text-emerald-400 text-sm">🎯 TalkBack Accessible — Choose Token to Move (You rolled {dice}):</div>
          <div className="text-xs text-slate-400 mt-1">Current turn: {turn} — {movable.length} token{movable.length > 1 ? "s" : ""} can move — Tap button below to move (easy for TalkBack):</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {movable.map(tokenIdx => {
              const pos = tokens[turn][tokenIdx];
              return (
                <button
                  key={tokenIdx}
                  onClick={() => applyMove(turn, tokenIdx, dice)}
                  className="rounded-xl bg-emerald-600 border-2 border-emerald-400 py-3 px-4 text-sm font-bold text-white hover:bg-emerald-500 flex flex-col items-center gap-1 min-h-[60px]"
                  aria-label={`Move ${turn} token ${tokenIdx + 1} from ${pos < 0 ? "base" : `position ${pos}`} to ${pos < 0 ? 0 : pos + dice}, TalkBack double tap to move`}
                >
                  <span className="text-lg">{turn === "red" ? "🔴" : turn === "green" ? "🟢" : turn === "yellow" ? "🟡" : "🔵"} Token {tokenIdx + 1}</span>
                  <span className="text-[10px]">{pos < 0 ? "In base, needs 6" : `At ${pos} → ${pos + dice}`}</span>
                  <span className="text-[10px] bg-white text-emerald-700 px-2 py-0.5 rounded-full">Tap to Move!</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-slate-500 text-center">TalkBack: Swipe to token buttons, double tap to move. Leather token (moving pieces enhanced for accessible)</div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <div
          className={`grid h-12 w-12 place-items-center rounded-xl bg-white text-3xl text-slate-900 ${
            rolling ? "animate-diceRoll" : ""
          }`}
          aria-hidden
        >
          {dice ? ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][dice] : "🎲"}
        </div>
        <p className="flex-1 px-3 text-center text-sm text-slate-300" aria-live="polite">{msg}</p>
        {phase === "over" ? (
          <button onClick={reset} className="rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950">
            Play Again
          </button>
        ) : (
          <button
            onClick={() => roll(turn)}
            disabled={!isHumanTurn || phase !== "roll"}
            aria-label={`Roll the dice for ${turn}, TalkBack double tap`}
            className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40 min-h-[48px] min-w-[80px]"
          >
            Roll 🎲
          </button>
        )}
      </div>

      {/* 4 Players Info */}
      <div className="mt-3 rounded-xl bg-slate-800/50 border border-slate-700 p-2">
        <div className="text-xs font-bold text-violet-400">👥 4 Players — Each Chooses One Colour — Realistic Sounds:</div>
        <div className="grid grid-cols-2 gap-1 mt-1 text-[11px] text-slate-400">
          <div>🔴 Red: {humanColors.includes("red") ? "You (Human)" : "AI"}</div>
          <div>🟢 Green: {humanColors.includes("green") ? "You (Human)" : "AI"}</div>
          <div>🟡 Yellow: {humanColors.includes("yellow") ? "You (Human)" : "AI"}</div>
          <div>🔵 Blue: {humanColors.includes("blue") ? "You (Human)" : "AI"}</div>
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => sound.play("ludo_dice")} className="rounded-lg bg-slate-700 px-2 py-1 text-[10px]">Dice 🔊</button>
          <button onClick={() => sound.play("ludo_token")} className="rounded-lg bg-slate-700 px-2 py-1 text-[10px]">Token 🔊</button>
          <button onClick={() => sound.play("win")} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] text-white">Win 🎉</button>
          <button onClick={() => sound.setMusic(!sound.settings.music)} className="rounded-lg bg-violet-600 px-2 py-1 text-[10px] text-white">Music {sound.settings.music ? "On" : "Off"} 🎵</button>
        </div>
        <div className="mt-1 text-[10px] text-slate-500">TalkBack: All token buttons have aria-label with position, move status, colour. Leather token moving enhanced.</div>
      </div>

      <p className="mt-2 text-center text-xs text-slate-500">Wins: {wins} · Roll 6 to leave base & get bonus turn · Human colours: {humanColors.join(", ")} · Accessible with TalkBack</p>
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
    const ai = absMain(color, newP);
    if (ai !== null && !SAFE.has(ai)) {
      for (const other of COLORS) {
        if (other === color) continue;
        if (tokens[other].some((op) => absMain(other, op) === ai)) score += 100;
      }
    }
    if (p < 0) score += 40;
    if (newP === FINISH) score += 60;
    score += newP;
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
