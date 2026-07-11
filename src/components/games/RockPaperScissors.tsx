"use client";

import { useState } from "react";
import { useSaveScore } from "@/lib/useSaveScore";

const CHOICES = [
  { key: "rock", emoji: "✊", label: "Rock" },
  { key: "paper", emoji: "✋", label: "Paper" },
  { key: "scissors", emoji: "✌️", label: "Scissors" },
] as const;

type Choice = (typeof CHOICES)[number]["key"];

function beats(a: Choice, b: Choice) {
  return (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  );
}

export default function RockPaperScissors() {
  const save = useSaveScore("rock-paper-scissors");
  const [you, setYou] = useState<Choice | null>(null);
  const [ai, setAi] = useState<Choice | null>(null);
  const [result, setResult] = useState("");
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  function play(choice: Choice) {
    const aiChoice = CHOICES[Math.floor(Math.random() * 3)].key;
    setYou(choice);
    setAi(aiChoice);
    if (choice === aiChoice) {
      setResult("Draw!");
    } else if (beats(choice, aiChoice)) {
      setResult("You win! 🎉");
      setWins((w) => w + 1);
      setStreak((s) => {
        const ns = s + 1;
        if (ns > best) {
          setBest(ns);
          save(ns);
        }
        return ns;
      });
    } else {
      setResult("You lose 😔");
      setLosses((l) => l + 1);
      setStreak(0);
    }
  }

  const emoji = (c: Choice | null) => CHOICES.find((x) => x.key === c)?.emoji ?? "❔";

  return (
    <div className="mx-auto max-w-md">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Info label="Streak" value={streak} />
        <Info label="Best" value={best} />
        <Info label="W / L" value={`${wins}/${losses}`} />
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-8">
        <div className="flex items-center justify-around text-6xl">
          <div className="text-center">
            <div>{emoji(you)}</div>
            <div className="mt-2 text-sm text-slate-400">You</div>
          </div>
          <div className="text-2xl text-slate-600">VS</div>
          <div className="text-center">
            <div>{emoji(ai)}</div>
            <div className="mt-2 text-sm text-slate-400">AI</div>
          </div>
        </div>

        <div className="mt-6 h-8 text-center text-xl font-bold text-emerald-400">
          {result}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              onClick={() => play(c.key)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-slate-800 py-4 text-4xl transition hover:bg-slate-700"
            >
              {c.emoji}
              <span className="text-xs text-slate-400">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
      <div className="text-xl font-black text-amber-400">{value}</div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
    </div>
  );
}
