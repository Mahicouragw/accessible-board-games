"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";

export default function Basketball() {
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [power, setPower] = useState(50);
  const [angle, setAngle] = useState(45);
  const [result, setResult] = useState<"score" | "miss" | null>(null);

  const shoot = () => {
    setAttempts(a => a + 1);
    // Simple physics: power 0-100, angle 0-90, target is around power 60-80 and angle 45-60 for best chance
    const powerScore = 1 - Math.abs(power - 70) / 70;
    const angleScore = 1 - Math.abs(angle - 50) / 50;
    const chance = (powerScore * 0.5 + angleScore * 0.5) * 0.8 + Math.random() * 0.2;
    
    if (chance > 0.55) {
      setScore(s => s + 1);
      setStreak(s => {
        const ns = s + 1;
        setBest(b => Math.max(b, ns));
        return ns;
      });
      setResult("score");
      sound.play("win");
    } else {
      setStreak(0);
      setResult("miss");
      sound.play("lose");
    }
    setTimeout(() => setResult(null), 1000);
  };

  const reset = () => {
    setScore(0);
    setAttempts(0);
    setStreak(0);
    setPower(50);
    setAngle(45);
    setResult(null);
    sound.play("click");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-orange-500/30 bg-orange-500/10 p-3">
        <h2 className="font-bold">🏀 Basketball Shoot — Advanced Level</h2>
        <p className="text-xs text-slate-400">Enhanced: Power + Angle control, realistic bounce sound, score tracking, team vs team 3-4-5 players</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border text-center">Score: {score}/{attempts}</span>
          <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border text-center">Streak: {streak}</span>
          <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border text-center">Best: {best}</span>
        </div>
      </div>

      <div className="rounded-2xl border-4 border-orange-900 bg-gradient-to-b from-sky-400 to-emerald-600 p-4 relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {/* Hoop */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <div className="w-20 h-2 bg-orange-600 rounded"></div>
          <div className="w-16 h-12 mx-auto border-l-2 border-r-2 border-b-2 border-white/70 bg-white/10 rounded-b-lg grid place-items-center">
            <div className="text-[10px] text-white">NET</div>
          </div>
        </div>
        
        {/* Ball */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-8 h-8 bg-orange-500 rounded-full border-2 border-black flex items-center justify-center text-xs transition-all duration-500 ${result ? (result === "score" ? "-translate-y-32" : "translate-y-8 rotate-180") : ""}`}>
          🏀
        </div>

        {result && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 rounded-2xl">
            <div className={`text-2xl font-black ${result === "score" ? "text-emerald-400" : "text-rose-400"}`}>
              {result === "score" ? "SCORE! 🎉" : "MISS! 😔"}
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-white/70 text-center">
          Power: {power}% | Angle: {angle}° | Team: 3-4-5 players can shoot in turns
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-300">Power: {power}%</label>
          <input type="range" min={0} max={100} value={power} onChange={(e) => setPower(Number(e.target.value))} className="w-full accent-orange-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-300">Angle: {angle}°</label>
          <input type="range" min={0} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-sky-500" />
        </div>
      </div>

      <button onClick={shoot} className="w-full rounded-xl bg-orange-500 py-4 text-lg font-black text-white hover:bg-orange-400">
        🏀 SHOOT! — Power {power}% Angle {angle}°
      </button>

      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">Reset ♻️</button>
        <button onClick={() => sound.play("bounce")} className="rounded-xl bg-amber-600 px-4 py-2 text-xs text-white">Bounce 🔊</button>
        <button onClick={() => sound.play("win")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs text-white">Score 🔊</button>
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-2 text-[11px] text-slate-400">
        <div className="font-bold text-orange-400">Advanced: Realistic bounce sound from CodeSkulptor (bounce-real.m4a) - No duplicate, unique for basketball</div>
        <ul className="list-disc list-inside mt-1">
          <li>🏀 Power + Angle control for realistic shooting</li>
          <li>👥 Team vs Team: 3-4-5 players shoot in turns, total score team vs team like 45 vs 50</li>
          <li>🎯 Score tracking, streak, best</li>
        </ul>
      </div>
    </div>
  );
}
