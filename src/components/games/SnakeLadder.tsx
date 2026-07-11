"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

// bottom -> top mappings
const LADDERS: Record<number, number> = {
  4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92,
};
const SNAKES: Record<number, number> = {
  27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41,
};

const DICE_FACE = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function cellCoord(n: number): { row: number; col: number } {
  const idx = n - 1;
  const row = Math.floor(idx / 10); // 0 = bottom
  let col = idx % 10;
  if (row % 2 === 1) col = 9 - col; // boustrophedon
  return { row: 9 - row, col }; // flip so row 0 is top for rendering
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SnakeLadder() {
  const save = useSaveScore("snake-ladder");
  const [pos, setPos] = useState<[number, number]>([0, 0]); // [you, ai]
  const [turn, setTurn] = useState(0); // 0 = you, 1 = ai
  const [dice, setDice] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState("Your turn — roll the dice!");
  const cancelled = useRef(false);

  const names = ["You", "AI"];

  const step = useCallback(
    async (player: number, roll: number) => {
      const start = player === 0 ? pos[0] : pos[1];
      let target = start + roll;
      if (target > 100) {
        setMsg(`${names[player]} need exact roll. Turn skipped.`);
        announce(`${names[player]} rolled ${roll}, too high, staying on ${start}`);
        return start;
      }
      // walk step by step
      for (let n = start + 1; n <= target; n++) {
        setPos((p) => (player === 0 ? [n, p[1]] : [p[0], n]));
        sound.play("move");
        await delay(160);
      }
      // ladder or snake
      if (LADDERS[target]) {
        const to = LADDERS[target];
        sound.play("ladder");
        announce(`${names[player]} climbed a ladder from ${target} to ${to}!`);
        setMsg(`${names[player]} climbed a ladder to ${to}! 🪜`);
        await delay(300);
        setPos((p) => (player === 0 ? [to, p[1]] : [p[0], to]));
        target = to;
      } else if (SNAKES[target]) {
        const to = SNAKES[target];
        sound.play("snake");
        announce(`${names[player]} hit a snake from ${target} down to ${to}!`);
        setMsg(`${names[player]} got bitten by a snake down to ${to}! 🐍`);
        await delay(300);
        setPos((p) => (player === 0 ? [to, p[1]] : [p[0], to]));
        target = to;
      }
      return target;
    },
    [pos],
  );

  const rollFor = useCallback(
    async (player: number) => {
      if (busy || winner !== null) return;
      setBusy(true);
      setRolling(true);
      sound.play("dice");
      const roll = 1 + Math.floor(Math.random() * 6);
      await delay(600);
      setDice(roll);
      setRolling(false);
      announce(`${names[player]} rolled ${roll}`);
      const landed = await step(player, roll);
      if (cancelled.current) return;
      if (landed >= 100) {
        setWinner(player);
        if (player === 0) {
          sound.play("win");
          announce("You reached 100 and won the game!");
          setMsg("🎉 You win!");
          setWins((w) => {
            const nw = w + 1;
            save(nw);
            return nw;
          });
        } else {
          sound.play("lose");
          announce("AI reached 100 and won.");
          setMsg("AI wins 😔");
        }
        setBusy(false);
        return;
      }
      const extra = roll === 6;
      const next = extra ? player : player === 0 ? 1 : 0;
      setTurn(next);
      setMsg(
        extra
          ? `${names[player]} rolled a 6 — roll again!`
          : next === 0
            ? "Your turn — roll the dice!"
            : "AI's turn…",
      );
      setBusy(false);
    },
    [busy, winner, step, save],
  );

  // AI auto-roll
  useEffect(() => {
    if (turn === 1 && winner === null && !busy) {
      const t = setTimeout(() => rollFor(1), 700);
      return () => clearTimeout(t);
    }
  }, [turn, winner, busy, rollFor]);

  useEffect(() => {
    cancelled.current = false;
    announce("Snake and Ladder. You versus AI. Roll to move.");
    return () => {
      cancelled.current = true;
    };
  }, []);

  function reset() {
    cancelled.current = false;
    setPos([0, 0]);
    setTurn(0);
    setDice(0);
    setWinner(null);
    setBusy(false);
    setMsg("Your turn — roll the dice!");
    sound.play("click");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <PlayerCard name="You" pos={pos[0]} active={turn === 0} color="text-sky-400" ring="ring-sky-500" />
        <PlayerCard name="AI" pos={pos[1]} active={turn === 1} color="text-rose-400" ring="ring-rose-500" />
      </div>

      <div className="relative rounded-2xl border-4 border-amber-900 bg-amber-50 p-1 shadow-2xl">
        <div className="grid grid-cols-10 gap-px">
          {Array.from({ length: 100 }).map((_, i) => {
            // render top row = 100..91 etc. Determine cell number at this render slot.
            const renderRow = Math.floor(i / 10); // 0 top
            const boardRow = 9 - renderRow; // 0 bottom
            let col = i % 10;
            if (boardRow % 2 === 1) col = 9 - col;
            const num = boardRow * 10 + col + 1;
            const hasLadder = LADDERS[num];
            const hasSnake = SNAKES[num];
            const you = pos[0] === num;
            const ai = pos[1] === num;
            return (
              <div
                key={i}
                className={`relative flex aspect-square flex-col items-center justify-center text-[9px] font-bold ${
                  (renderRow + (i % 10)) % 2 === 0 ? "bg-amber-100" : "bg-amber-200"
                }`}
              >
                <span className="absolute left-0.5 top-0 text-[8px] text-amber-700/70">{num}</span>
                {hasLadder && <span className="text-xs">🪜</span>}
                {hasSnake && <span className="text-xs">🐍</span>}
                <div className="absolute bottom-0.5 flex gap-0.5">
                  {you && <span className="h-2.5 w-2.5 rounded-full bg-sky-500 ring-1 ring-white" />}
                  {ai && <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-white" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <div className={`text-5xl ${rolling ? "animate-diceRoll" : ""}`} aria-hidden>
          {DICE_FACE[dice] || "🎲"}
        </div>
        <p className="flex-1 px-3 text-center text-sm text-slate-300">{msg}</p>
        {winner === null ? (
          <button
            onClick={() => rollFor(0)}
            disabled={busy || turn !== 0}
            aria-label="Roll the dice"
            className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            Roll 🎲
          </button>
        ) : (
          <button
            onClick={reset}
            className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950"
          >
            Play Again
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">Wins: {wins} · Roll a 6 to go again!</p>
    </div>
  );
}

function PlayerCard({
  name,
  pos,
  active,
  color,
  ring,
}: {
  name: string;
  pos: number;
  active: boolean;
  color: string;
  ring: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 ${
        active ? `ring-2 ${ring}` : ""
      }`}
    >
      <div className={`text-sm font-bold ${color}`}>{name}</div>
      <div className="text-xs text-slate-400">Square {pos}</div>
    </div>
  );
}
