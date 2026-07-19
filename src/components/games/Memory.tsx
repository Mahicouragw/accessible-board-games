"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveScore } from "@/lib/useSaveScore";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

const ICONS = ["🍎", "🚀", "🎈", "🐱", "🌵", "⚽", "🎸", "🍕"];

type Card = { id: number; icon: string; flipped: boolean; matched: boolean };

function build(): Card[] {
  const deck = [...ICONS, ...ICONS]
    .map((icon, i) => ({ id: i, icon, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5)
    .map((c, i) => ({ ...c, id: i }));
  return deck;
}

export default function Memory() {
  const save = useSaveScore("memory");
  const [cards, setCards] = useState<Card[]>(build);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [lock, setLock] = useState(false);

  const reset = useCallback(() => {
    setCards(build());
    setPicked([]);
    setMoves(0);
    setWon(false);
    setLock(false);
  }, []);

  function flip(idx: number) {
    if (lock || cards[idx].flipped || cards[idx].matched) return;
    sound.play("click");
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    const newPicked = [...picked, idx];
    setPicked(newPicked);

    if (newPicked.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = newPicked;
      if (next[a].icon === next[b].icon) {
        setTimeout(() => {
          setCards((cs) =>
            cs.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)),
          );
          setPicked([]);
          setLock(false);
          sound.play("coin_drop");
          announce(`${next[a].icon} matched!`);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((cs) =>
            cs.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)),
          );
          setPicked([]);
          setLock(false);
        }, 800);
      }
    }
  }

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && !won) {
      setWon(true);
      const score = Math.max(10, 500 - moves * 10);
      sound.play("win");
      announce(`All pairs matched in ${moves} moves! You win, score ${score}. 🎉`);
      save(score, { moves });
    }
  }, [cards, won, moves, save]);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="text-slate-400">
          Moves: <b className="text-white">{moves}</b>
        </span>
        <button
          onClick={reset}
          className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold transition hover:bg-slate-700"
        >
          New Game
        </button>
      </div>

      {won && (
        <div className="mb-4 rounded-2xl bg-emerald-500/15 p-4 text-center text-lg font-bold text-emerald-400">
          🎉 Solved in {moves} moves! Score saved.
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => {
          const show = c.flipped || c.matched;
          return (
            <button
              key={c.id}
              onClick={() => flip(i)}
              className={`grid aspect-square place-items-center rounded-2xl text-3xl transition ${
                show
                  ? c.matched
                    ? "bg-emerald-600/30"
                    : "bg-slate-700"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              }`}
            >
              {show ? c.icon : "❓"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
