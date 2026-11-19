"use client";

// 🏁 Dice Race — race from square 1 to 100.
// Roll the dice, move forward. 🪜 boost squares jump you ahead, 🐍 slip
// squares send you back. First to reach 100 wins!
// Modes: 🤖 vs AI (computer rolls after you) or 👥 2 players on this device.
// Every roll is announced and a real sound plays (dice, ladder, snake, win).

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

const GOAL = 100;
const BOOSTS: Record<number, number> = { 8: 26, 22: 41, 38: 59, 51: 72, 70: 86, 88: 97 }; // 🪜 ladder up
const SLIPS: Record<number, number> = { 17: 7, 33: 14, 49: 31, 66: 44, 81: 63, 95: 78 }; // 🐍 snake down

function fairDice(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % 6) + 1;
}

type Racer = { name: string; pos: number; color: string };

export default function DiceRace() {
  const save = useSaveScore("dice-race");
  const [mode, setMode] = useState<"ai" | "local2">("ai");
  const [started, setStarted] = useState(false);
  const [racers, setRacers] = useState<Racer[]>([]);
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Pick a mode, then start the race!");
  const [over, setOver] = useState(false);
  const [rolls, setRolls] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    announce("Dice Race. Roll the dice and race from square 1 to 100. Ladders boost you, snakes slip you back. First to 100 wins! Choose vs AI or 2 players on this device.");
    return () => {
      mounted.current = false;
    };
  }, []);

  function start() {
    const rs: Racer[] =
      mode === "ai"
        ? [
            { name: "You", pos: 1, color: "bg-emerald-500" },
            { name: "🤖 Computer", pos: 1, color: "bg-violet-500" },
          ]
        : [
            { name: "Player 1", pos: 1, color: "bg-emerald-500" },
            { name: "Player 2", pos: 1, color: "bg-sky-500" },
          ];
    setRacers(rs);
    setTurn(0);
    setRolls(0);
    setOver(false);
    setBusy(false);
    setStarted(true);
    const m = `🏁 Race started! ${rs[0].name} rolls first. Tap Roll!`;
    setMsg(m);
    announce(m);
  }

  function moveRacer(r: Racer, die: number): { r: Racer; text: string } {
    let pos = r.pos + die;
    let text = `${r.name} rolled ${die} → square ${pos}.`;
    if (BOOSTS[pos]) {
      pos = BOOSTS[pos];
      text += ` 🪜 Ladder! Climbs to ${pos}!`;
    } else if (SLIPS[pos]) {
      pos = SLIPS[pos];
      text += ` 🐍 Snake! Slips back to ${pos}.`;
    }
    if (pos >= GOAL) {
      pos = GOAL;
      text += ` 🏁 Reaches ${GOAL} — ${r.name} WINS THE RACE!`;
    }
    return { r: { ...r, pos }, text };
  }

  async function roll() {
    if (busy || over || !started) return;
    setBusy(true);
    sound.play("dice_roll_wood"); // 🎲 real wooden dice (1.9 s)
    await new Promise((r) => setTimeout(r, 900));
    if (!mounted.current) return;
    const die = fairDice();
    setRolls((n) => n + 1);
    const cur = racers[turn];
    const { r: moved, text } = moveRacer(cur, die);
    const next = racers.map((x, i) => (i === turn ? moved : x));
    setRacers(next);
    if (moved.pos >= GOAL) {
      setOver(true);
      sound.play("win");
      setTimeout(() => mounted.current && sound.play("victory_applause"), 600);
      const finalMsg = `${text} 🏆 ${cur.name} wins in ${rolls + 1} rolls!`;
      setMsg(finalMsg);
      announce(finalMsg);
      const score = Math.max(10, 300 - (rolls + 1) * 5);
      save(score, { rolls: rolls + 1, mode });
      setBusy(false);
      return;
    }
    if (BOOSTS[cur.pos + die]) setTimeout(() => mounted.current && sound.play("ladder"), 500);
    else if (SLIPS[cur.pos + die]) setTimeout(() => mounted.current && sound.play("snake_hit"), 500);
    setMsg(text);
    announce(text);
    const nextTurn = (turn + 1) % racers.length;
    setTurn(nextTurn);
    setBusy(false);
    // 🤖 AI rolls automatically
    if (mode === "ai" && nextTurn === 1) {
      setTimeout(() => {
        if (mounted.current && !over) rollAi();
      }, 1200);
    }
  }

  async function rollAi() {
    if (over) return;
    setBusy(true);
    sound.play("dice_roll_wood");
    await new Promise((r) => setTimeout(r, 900));
    if (!mounted.current) return;
    const die = fairDice();
    setRolls((n) => n + 1);
    const cur = racers[1];
    const { r: moved, text } = moveRacer(cur, die);
    const next = racers.map((x, i) => (i === 1 ? moved : x));
    setRacers(next);
    if (moved.pos >= GOAL) {
      setOver(true);
      sound.play("lose");
      const finalMsg = `${text} 🤖 Computer wins the race in ${rolls + 1} rolls!`;
      setMsg(finalMsg);
      announce(finalMsg);
      setBusy(false);
      return;
    }
    if (BOOSTS[cur.pos + die]) setTimeout(() => mounted.current && sound.play("ladder"), 500);
    else if (SLIPS[cur.pos + die]) setTimeout(() => mounted.current && sound.play("snake_hit"), 500);
    setMsg(text + " Your turn — tap Roll!");
    announce(text + " Your turn — tap Roll!");
    setTurn(0);
    setBusy(false);
  }

  // 10x10 track, square 1 bottom-left … 100 top-right
  const cells = Array.from({ length: 100 }, (_, i) => i + 1);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6" aria-label="Dice Race">
      <h2 className="text-xl font-bold text-amber-300">🏁 Dice Race — first to 100</h2>
      <p className="mt-1 text-sm text-slate-400">
        Roll the dice and race up the track. 🪜 ladders boost you (8→26, 22→41, 38→59, 51→72, 70→86, 88→97), 🐍 snakes slip you back (17, 33, 49, 66, 81, 95).
      </p>

      {!started && (
        <div className="mt-4">
          <div className="flex gap-2" role="group" aria-label="Mode">
            <button
              aria-pressed={mode === "ai"}
              onClick={() => setMode("ai")}
              className={`min-h-12 flex-1 rounded-xl border-2 px-3 text-sm font-bold ${mode === "ai" ? "border-emerald-400 bg-emerald-600/30 text-emerald-100" : "border-slate-600 bg-slate-800/60 text-slate-300"}`}
            >
              🤖 vs AI
            </button>
            <button
              aria-pressed={mode === "local2"}
              onClick={() => setMode("local2")}
              className={`min-h-12 flex-1 rounded-xl border-2 px-3 text-sm font-bold ${mode === "local2" ? "border-sky-400 bg-sky-600/30 text-sky-100" : "border-slate-600 bg-slate-800/60 text-slate-300"}`}
            >
              👥 2 players, this device
            </button>
          </div>
          <button
            onClick={start}
            className="mt-4 min-h-14 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-lg font-black text-white focus:outline-none focus:ring-4 focus:ring-yellow-400"
          >
            ▶️ Start race
          </button>
        </div>
      )}

      {started && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {racers.map((r, i) => (
              <div key={r.name} className={`rounded-xl px-3 py-2 text-sm font-bold text-white ${r.color} ${i === turn && !over ? "ring-4 ring-yellow-400" : ""}`}>
                {r.name}: square {r.pos} {i === turn && !over ? "▶" : ""}
              </div>
            ))}
            <span className="text-xs text-slate-400">Rolls: {rolls}</span>
          </div>

          <div aria-live="polite" className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-center text-sm font-semibold text-slate-100">
            {msg}
          </div>

          {!over && (
            <button
              onClick={roll}
              disabled={busy || (mode === "ai" && turn !== 0)}
              className="mt-4 min-h-16 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-2xl font-black text-white focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-40"
            >
              🎲 Roll the dice{turn === 1 && mode === "ai" ? " (computer is rolling…)" : ""}
            </button>
          )}
          {over && (
            <button
              onClick={() => { setStarted(false); setMsg("Pick a mode, then start the race!"); }}
              className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-600 text-lg font-bold text-white"
            >
              🔄 Race again
            </button>
          )}

          {/* Track */}
          <div className="mt-5 grid grid-cols-10 gap-1" role="img" aria-label={`Race track: ${racers.map((r) => `${r.name} on square ${r.pos}`).join(", ")}`}>
            {cells.map((n) => {
              const boost = BOOSTS[n];
              const slip = SLIPS[n];
              const here = racers.filter((r) => r.pos === n);
              return (
                <div
                  key={n}
                  className={`grid aspect-square place-items-center rounded text-[10px] font-bold ${
                    boost ? "bg-emerald-700/70 text-emerald-100" : slip ? "bg-rose-800/70 text-rose-100" : "bg-slate-800 text-slate-400"
                  } ${n === GOAL ? "ring-2 ring-amber-400" : ""}`}
                  title={`${n}${boost ? ` → ladder to ${boost}` : slip ? ` → snake to ${slip}` : ""}`}
                >
                  {here.length > 0 ? <span>{here.map((h) => (h.name.includes("Computer") || h.name.includes("2") ? "🤖" : "🏃"))}</span> : boost ? "🪜" : slip ? "🐍" : n}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
