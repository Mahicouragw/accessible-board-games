"use client";

// ⚡ Reaction Rush — wait for the whistle, then TAP as fast as you can!
// 5 rounds. Tap too early = false start. At the end your average reaction time
// is announced and compared with the computer's. Real whistle + win/lose sounds.

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

const ROUNDS = 5;

function fairRand(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export default function ReactionRush() {
  const save = useSaveScore("reaction-rush");
  const [phase, setPhase] = useState<"idle" | "waiting" | "go" | "done">("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [msg, setMsg] = useState("Tap Start, then wait for the whistle 🔊 — tap the big button the instant you hear it!");
  const [flash, setFlash] = useState(false);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    announce("Reaction Rush. Five rounds. Wait for the whistle sound, then tap as fast as you can. Tapping too early is a false start. Your average reaction time is announced at the end.");
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function start() {
    sound.play("button");
    setTimes([]);
    setRound(1);
    setPhase("waiting");
    arm();
  }

  function arm() {
    setFlash(false);
    setMsg(`Round ${round}/${ROUNDS} — wait for the whistle… 🤫`);
    announce(`Round ${round} of ${ROUNDS}. Wait for the whistle.`);
    const wait = 1500 + fairRand(2500); // 1.5–4 s
    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      goAt.current = Date.now();
      setPhase("go");
      setFlash(true);
      sound.play("cricket_whistle"); // 🔊 the whistle!
      setMsg("⚡ TAP NOW!");
      announce("Whistle! Tap now!");
    }, wait);
  }

  function tap() {
    if (phase === "idle" || phase === "done") return;
    if (phase === "waiting") {
      // false start
      if (timer.current) clearTimeout(timer.current);
      sound.play("lose");
      setPhase("waiting");
      setMsg(`❌ Too soon — false start on round ${round}! Wait for the whistle…`);
      announce(`Too soon! False start. Round ${round} again — wait for the whistle.`);
      arm();
      return;
    }
    if (phase === "go") {
      const ms = Date.now() - goAt.current;
      sound.play("select");
      const t = [...times, ms];
      setTimes(t);
      setFlash(false);
      if (round >= ROUNDS) {
        finish(t);
      } else {
        setRound((r) => r + 1);
        setPhase("waiting");
        setMsg(`⚡ ${ms} ms! Round ${round + 1}/${ROUNDS}…`);
        announce(`${ms} milliseconds! Round ${round + 1}.`);
        setTimeout(() => mounted.current && arm(), 900);
      }
    }
  }

  function finish(t: number[]) {
    setPhase("done");
    const avg = Math.round(t.reduce((a, b) => a + b, 0) / t.length);
    const ai = 180 + fairRand(270); // computer "reaction" 180–450 ms
    sound.play("win");
    setTimeout(() => mounted.current && sound.play("victory_applause"), 600);
    const m = `🏁 Done! Your times: ${t.join(", ")} ms — average ${avg} ms. 🤖 Computer's average: ${ai} ms. ${avg <= ai ? "You're faster than the computer! 🎉" : "The computer was faster this time — rematch!"}`;
    setMsg(m);
    announce(m);
    const score = Math.max(10, 1000 - avg);
    save(score, { times: t, avgMs: avg, aiMs: ai, rounds: ROUNDS });
  }

  return (
    <section className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6" aria-label="Reaction Rush">
      <h2 className="text-xl font-bold text-sky-300">⚡ Reaction Rush</h2>
      <p className="mt-1 text-sm text-slate-400">
        {ROUNDS} rounds — wait for the whistle 🔊, then tap as fast as you can. Too early = false start!
      </p>

      <div
        aria-live="polite"
        className={`mt-4 rounded-2xl border p-4 text-center text-base font-bold ${
          phase === "go" ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-slate-700 bg-slate-950/70 text-slate-100"
        }`}
      >
        {msg}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <span>Round: <b className="text-white">{round || "—"}/{ROUNDS}</b></span>
        <span>Times: <b className="text-white">{times.length ? times.join(" · ") + " ms" : "—"}</b></span>
      </div>

      {phase === "idle" && (
        <button
          onClick={start}
          className="mt-4 min-h-14 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-lg font-black text-white focus:outline-none focus:ring-4 focus:ring-yellow-400"
        >
          ▶️ Start
        </button>
      )}
      {phase === "done" && (
        <button
          onClick={start}
          className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-600 text-lg font-bold text-white"
        >
          🔄 Play again
        </button>
      )}

      {(phase === "waiting" || phase === "go") && (
        <button
          onClick={tap}
          aria-label={phase === "go" ? "TAP NOW" : "Wait for the whistle — do not tap yet"}
          className={`mt-4 min-h-40 w-full rounded-3xl text-3xl font-black text-white transition focus:outline-none focus:ring-4 focus:ring-yellow-400 ${
            flash ? "bg-amber-500 animate-pulse" : "bg-slate-800 border-2 border-slate-600"
          }`}
        >
          {phase === "go" ? "⚡ TAP!" : "…"}
        </button>
      )}
    </section>
  );
}
