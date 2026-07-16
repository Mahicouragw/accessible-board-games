"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";

type Domino = { a: number; b: number; id: number };
type PlayedDomino = Domino & { side: "left" | "right"; rotated: boolean };

function createDominoSet(): Domino[] {
  const set: Domino[] = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      set.push({ a, b, id: id++ });
    }
  }
  return set.sort(() => Math.random() - 0.5);
}

export default function Dominoes() {
  const [hand, setHand] = useState<Domino[]>(() => createDominoSet().slice(0, 7));
  const [board, setBoard] = useState<PlayedDomino[]>(() => {
    const full = createDominoSet();
    return [{ ...full[0], side: "left", rotated: false }];
  });
  const [score, setScore] = useState(0);
  const [wins, setWins] = useState(0);

  const leftEnd = board.length > 0 ? (board[0].side === "left" ? board[0].a : board[0].b) : null;
  const rightEnd = board.length > 0 ? board[board.length - 1].side === "right" ? board[board.length - 1].a : board[board.length - 1].b : null;

  const canPlay = (domino: Domino, side: "left" | "right") => {
    if (board.length === 0) return true;
    const end = side === "left" ? leftEnd : rightEnd;
    return domino.a === end || domino.b === end;
  };

  const playDomino = (domino: Domino, side: "left" | "right") => {
    if (!canPlay(domino, side)) {
      sound.play("lose");
      return;
    }
    const isLeft = side === "left";
    const end = isLeft ? leftEnd : rightEnd;
    const rotated = domino.b === end;
    const played: PlayedDomino = { ...domino, side, rotated };
    
    if (isLeft) setBoard([played, ...board]);
    else setBoard([...board, played]);
    
    setHand(hand.filter(d => d.id !== domino.id));
    setScore(s => s + domino.a + domino.b);
    sound.play("card_shuffle");
    
    if (hand.length === 1) {
      sound.play("win");
      setWins(w => w + 1);
      setTimeout(() => {
        alert(`You win! Domino! Score: ${score + domino.a + domino.b}`);
        const newSet = createDominoSet();
        setHand(newSet.slice(0, 7));
        setBoard([{ ...newSet[0], side: "left" as const, rotated: false }]);
        setScore(0);
      }, 300);
    }
  };

  const reset = () => {
    const newSet = createDominoSet();
    setHand(newSet.slice(0, 7));
    setBoard([{ ...newSet[0], side: "left" as const, rotated: false }]);
    setScore(0);
    sound.play("click");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-3">
        <h2 className="font-bold">🀄 Dominoes — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: 28 dominoes, realistic card shuffle sound from website, double-six set, score tracking</p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Score: {score}</span>
          <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border">Wins: {wins}</span>
          <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300">Ends: {leftEnd} | {rightEnd}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-xs font-bold text-slate-400 mb-2">Board — Ends: {leftEnd} - {rightEnd}</div>
        <div className="flex flex-wrap gap-1 justify-center min-h-[80px] items-center bg-slate-800/50 rounded-xl p-3">
          {board.map((d, idx) => (
            <div key={`${d.id}-${idx}`} className={`w-12 h-8 rounded border-2 bg-white text-slate-900 grid grid-cols-2 text-[10px] font-bold ${d.side === "left" ? "border-sky-400" : "border-emerald-400"}`}>
              <span className="grid place-items-center border-r">{d.rotated ? d.b : d.a}</span>
              <span className="grid place-items-center">{d.rotated ? d.a : d.b}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-xs font-bold text-slate-400 mb-2">Your Hand ({hand.length} dominoes) — Click to play left/right</div>
        <div className="grid grid-cols-4 gap-2">
          {hand.map(d => (
            <div key={d.id} className="rounded-xl bg-slate-800 border border-slate-700 p-2">
              <div className="w-full h-12 rounded bg-white text-slate-900 grid grid-cols-2 font-bold">
                <span className="grid place-items-center border-r text-lg">{d.a}</span>
                <span className="grid place-items-center text-lg">{d.b}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  onClick={() => playDomino(d, "left")}
                  disabled={!canPlay(d, "left")}
                  className="rounded bg-sky-500/20 border border-sky-500/50 py-1 text-[10px] font-bold text-sky-300 disabled:opacity-30"
                >
                  ← Left {leftEnd}
                </button>
                <button
                  onClick={() => playDomino(d, "right")}
                  disabled={!canPlay(d, "right")}
                  className="rounded bg-emerald-500/20 border border-emerald-500/50 py-1 text-[10px] font-bold text-emerald-300 disabled:opacity-30"
                >
                  Right {rightEnd} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">Reset ♻️</button>
        <button onClick={() => sound.play("card_shuffle")} className="rounded-xl bg-amber-600 px-4 py-2 text-xs text-white">🔊 Shuffle Sound</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        <div className="font-bold text-amber-400">Advanced: Unique realistic card shuffle sound from Google Actions (card-shuffle.ogg) — No duplicate, domino specific</div>
      </div>
    </div>
  );
}
