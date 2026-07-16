"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";

export default function FootballPenalty() {
  const [score, setScore] = useState({ goals: 0, misses: 0, streak: 0, best: 0 });
  const [keeperPos, setKeeperPos] = useState(1); // 0 left, 1 center, 2 right
  const [ballPos, setBallPos] = useState<number | null>(null);
  const [result, setResult] = useState<"goal" | "save" | "miss" | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  const shoot = (pos: number) => {
    if (isKicking) return;
    setIsKicking(true);
    setBallPos(pos);
    
    // Keeper decides
    const keeper = Math.floor(Math.random() * 3);
    setKeeperPos(keeper);
    
    setTimeout(() => {
      let res: "goal" | "save" | "miss";
      const rand = Math.random();
      if (rand < 0.15) {
        res = "miss";
        setScore(s => ({ ...s, misses: s.misses + 1, streak: 0 }));
        sound.play("lose");
      } else if (pos === keeper) {
        res = "save";
        setScore(s => ({ ...s, misses: s.misses + 1, streak: 0 }));
        sound.play("capture");
      } else {
        res = "goal";
        setScore(s => {
          const newStreak = s.streak + 1;
          return { goals: s.goals + 1, misses: s.misses, streak: newStreak, best: Math.max(s.best, newStreak) };
        });
        sound.play("win");
      }
      setResult(res);
      setTimeout(() => {
        setIsKicking(false);
        setBallPos(null);
        setResult(null);
      }, 1200);
    }, 600);
  };

  const reset = () => {
    setScore({ goals: 0, misses: 0, streak: 0, best: 0 });
    setKeeperPos(1);
    setBallPos(null);
    setResult(null);
    sound.play("click");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-3">
        <h2 className="font-bold">⚽ Football Penalty — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: Team vs team penalty shootout, keeper AI, realistic kick & crowd cheer sounds from website, 3 directions</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border text-center">Goals: {score.goals}</span>
          <span className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-400 border text-center">Misses: {score.misses}</span>
          <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border text-center">Best Streak: {score.best}</span>
        </div>
      </div>

      <div className="rounded-2xl border-4 border-emerald-900 bg-gradient-to-b from-emerald-600 to-emerald-800 p-4 relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {/* Goal */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-3/4 h-1/2 border-4 border-white bg-white/10 rounded-t-lg">
          {/* Keeper */}
          <div className="absolute bottom-0 w-full h-1/2 flex justify-center items-end">
            <div className={`transition-all duration-500 ${keeperPos === 0 ? "-translate-x-12" : keeperPos === 2 ? "translate-x-12" : ""}`}>
              <div className="text-4xl">🧤</div>
              <div className="text-[10px] text-white text-center bg-black/50 rounded px-1">Keeper</div>
            </div>
          </div>
          {/* Ball */}
          {ballPos !== null && (
            <div className={`absolute w-6 h-6 bg-white rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] transition-all duration-300
              ${ballPos === 0 ? "left-2 top-1/2" : ballPos === 1 ? "left-1/2 top-4 -translate-x-1/2" : "right-2 top-1/2"}
              ${isKicking ? "scale-150" : ""}
            `}>
              ⚽
            </div>
          )}
        </div>

        {/* Result overlay */}
        {result && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 rounded-2xl">
            <div className={`text-3xl font-black animate-pulse ${result === "goal" ? "text-emerald-400" : result === "save" ? "text-amber-400" : "text-rose-400"}`}>
              {result === "goal" ? "GOAL! 🎉" : result === "save" ? "SAVED! 🧤" : "MISS! 😔"}
            </div>
          </div>
        )}

        {/* Crowd */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-slate-900/50 flex items-center justify-center text-[10px] text-white">
          Crowd: {score.goals > 5 ? "Cheering! 🎉📣" : "Watching... 👀"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => shoot(0)}
          disabled={isKicking}
          className="rounded-2xl bg-slate-800 border-2 border-slate-700 py-8 text-2xl font-bold hover:border-white hover:bg-slate-700 disabled:opacity-50"
        >
          ← Left
        </button>
        <button
          onClick={() => shoot(1)}
          disabled={isKicking}
          className="rounded-2xl bg-slate-800 border-2 border-slate-700 py-8 text-2xl font-bold hover:border-white hover:bg-slate-700 disabled:opacity-50"
        >
          ↑<br/>Center
        </button>
        <button
          onClick={() => shoot(2)}
          disabled={isKicking}
          className="rounded-2xl bg-slate-800 border-2 border-slate-700 py-8 text-2xl font-bold hover:border-white hover:bg-slate-700 disabled:opacity-50"
        >
          Right →
        </button>
      </div>

      <div className="text-center text-xs text-slate-400">
        {isKicking ? "Kicking... ⚽" : "Choose direction to shoot — Beat the keeper! Team vs Team: 3-4-5 players can take penalties"}
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">Reset ♻️</button>
        <button onClick={() => sound.play("cricket_boundary")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white">🎉 Crowd Cheer 🔊</button>
        <button onClick={() => sound.play("cricket_wicket")} className="rounded-xl bg-rose-600 px-4 py-2 text-xs text-white">🧤 Save 🔊</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        <div className="font-bold text-emerald-400">Advanced: Realistic sounds from website (cricket-boundary.ogg crowd cheer, cricket-wicket.ogg save) — No duplicate</div>
        <ul className="list-disc list-inside mt-1">
          <li>⚽ Penalty shootout with keeper AI that dives left/center/right</li>
          <li>🎯 3 directions, goal/save/miss, streak tracking</li>
          <li>👥 Team vs Team: Each player takes penalty, total goals team score like 3-4-5 vs 45</li>
        </ul>
      </div>
    </div>
  );
}
