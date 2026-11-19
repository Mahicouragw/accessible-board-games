"use client";

// 🔊 Sound Simon — listen to the sound sequence, then repeat it by tapping the
// pads. Each round adds one more sound. 4 pads, each with its own real sound.
// Fully playable by ear — perfect for blind/low-vision players: every pad is
// also announced by name. Reach round 8 for the victory fanfare!

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import type { Sfx } from "@/lib/sfx";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

const PADS: { sfx: Sfx; label: string; color: string; active: string }[] = [
  { sfx: "cricket_ball", label: "Bat crack", color: "bg-emerald-600", active: "bg-emerald-300" },
  { sfx: "coin_drop", label: "Coin", color: "bg-amber-600", active: "bg-amber-300" },
  { sfx: "carrom_rebound", label: "Wood knock", color: "bg-sky-700", active: "bg-sky-300" },
  { sfx: "cricket_whistle", label: "Whistle", color: "bg-rose-700", active: "bg-rose-300" },
];

const WIN_ROUND = 8;

function fairRand(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export default function SoundSimon() {
  const save = useSaveScore("sound-simon");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false); // demo playback
  const [inputIdx, setInputIdx] = useState(0);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("Tap Start — watch (and listen to) the sounds, then repeat them!");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    announce("Sound Simon. A sequence of sounds plays — each pad has its own sound. Repeat the sequence by tapping the pads. Each round adds one sound. Reach round 8 to win!");
    return () => {
      mounted.current = false;
    };
  }, []);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function playPad(i: number, dur = 450) {
    setActivePad(i);
    sound.play(PADS[i].sfx);
    setTimeout(() => mounted.current && setActivePad(null), dur);
  }

  async function demo(seq: number[]) {
    setPlaying(true);
    setMsg(`👂 Listen… round ${seq.length}`);
    announce(`Listen. Round ${seq.length}. ${seq.length} sound${seq.length > 1 ? "s" : ""}.`);
    await delay(900);
    for (const i of seq) {
      if (!mounted.current) return;
      playPad(i, 500);
      announce(PADS[i].label);
      await delay(750);
    }
    if (!mounted.current) return;
    setPlaying(false);
    setInputIdx(0);
    setMsg("🎯 Your turn — repeat the sequence!");
    announce("Your turn. Repeat the sequence.");
  }

  async function start() {
    sound.play("button");
    const seq = [fairRand(4)];
    setSequence(seq);
    setRound(1);
    setOver(false);
    setBest(1);
    await demo(seq);
  }

  async function nextRound() {
    const seq = [...sequence, fairRand(4)];
    setSequence(seq);
    setRound(seq.length);
    if (seq.length > best) setBest(seq.length);
    if (seq.length >= WIN_ROUND) {
      setOver(true);
      sound.play("win");
      setTimeout(() => mounted.current && sound.play("victory_fanfare"), 500);
      const m = `🏆 You repeated all ${WIN_ROUND} rounds — YOU WIN Sound Simon!`;
      setMsg(m);
      announce(m);
      save(WIN_ROUND * 100, { rounds: WIN_ROUND });
      return;
    }
    await demo(seq);
  }

  function tap(i: number) {
    if (playing || over) return;
    playPad(i, 300);
    if (i === sequence[inputIdx]) {
      sound.play("select");
      const next = inputIdx + 1;
      setInputIdx(next);
      if (next === sequence.length) {
        sound.play("coin_drop");
        const m = `✅ Correct! Round ${round} complete — get ready for round ${round + 1}…`;
        setMsg(m);
        announce(m);
        setTimeout(() => mounted.current && nextRound(), 900);
      }
    } else {
      sound.play("lose");
      setOver(true);
      const m = `❌ Wrong sound! You reached round ${round} (best ${Math.max(best, round)}). Tap Start to try again.`;
      setMsg(m);
      announce(m);
      const score = Math.max(10, round * 50);
      save(score, { roundsReached: round });
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6" aria-label="Sound Simon">
      <h2 className="text-xl font-bold text-violet-300">🔊 Sound Simon</h2>
      <p className="mt-1 text-sm text-slate-400">
        Listen to the sequence of sounds, then repeat it. Each round adds one sound. Reach round {WIN_ROUND} to win!
      </p>

      <div aria-live="polite" className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-center text-sm font-semibold text-slate-100">
        {msg}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">Round: <b className="text-white">{round || "—"}</b></span>
        <span className="text-slate-400">Best: <b className="text-amber-300">{best || "—"}</b></span>
        {round === 0 && !over && (
          <button
            onClick={start}
            className="min-h-12 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 text-base font-black text-white focus:outline-none focus:ring-4 focus:ring-yellow-400"
          >
            ▶️ Start
          </button>
        )}
        {over && (
          <button
            onClick={start}
            className="min-h-12 rounded-xl bg-emerald-600 px-6 text-base font-bold text-white"
          >
            🔄 Play again
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {PADS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => tap(i)}
            disabled={playing || over || round === 0}
            aria-label={`Pad ${i + 1}: ${p.label} sound`}
            className={`grid min-h-28 place-items-center rounded-2xl border-2 text-lg font-black text-white transition focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-60 ${
              activePad === i ? p.active : p.color
            } border-slate-700`}
          >
            <span aria-hidden>{activePad === i ? "🔆" : "🔊"}</span>
            <span className="text-sm">{p.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
