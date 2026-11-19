"use client";

// 🧠 Memory Match — advanced:
//   • Board size: 4 / 6 / 8 / 10 pairs
//   • Themes: Numbers 1–10, Fruits, Vegetables, Animals, Emojis
//   • Mode: 👁 Pictures or 🔊 SOUND memory — each card hides a sound; flip to
//     hear it and match identical sounds (great for blind/low-vision players)
//   • Opponent: Solo, or 🤖 vs AI (turns alternate; AI remembers what it saw)
//   • Correct → chime, wrong → buzz; win → fanfare; pairs, moves & time tracked
//     for both sides; best score saved to the leaderboard.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveScore } from "@/lib/useSaveScore";
import { sound } from "@/lib/sound";
import type { Sfx } from "@/lib/sfx";
import { announce } from "@/lib/a11y";

type Theme = "numbers" | "fruits" | "vegetables" | "animals" | "emojis";
type Mode = "pictures" | "sounds";
type Opponent = "solo" | "ai";

const THEMES: Record<Theme, { label: string; icon: string; items: string[] }> = {
  numbers: { label: "Numbers 1–10", icon: "🔢", items: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
  fruits: { label: "Fruits", icon: "🍎", items: ["🍎", "🍌", "🍇", "🍊", "🍉", "🍓", "🍑", "🍍", "🥭", "🍒"] },
  vegetables: { label: "Vegetables", icon: "🥕", items: ["🥕", "🥦", "🌽", "🧅", "🥔", "🍅", "🥬", "🧄", "🥒", "🌶️"] },
  animals: { label: "Animals", icon: "🐶", items: ["🐶", "🐱", "🦁", "🐘", "🐒", "🦊", "🐸", "🐵", "🐔", "🐷"] },
  emojis: { label: "Emojis", icon: "🚀", items: ["🚀", "🎈", "⚽", "🎸", "🍕", "🌵", "🎁", "⭐", "🎮", "🔥"] },
};

// 🔊 Sound-memory deck — short real SFX (all ≤2 s) with spoken labels.
const SOUND_DECK: { sfx: Sfx; label: string }[] = [
  { sfx: "cricket_ball", label: "bat crack" },
  { sfx: "cricket_run1", label: "one call" },
  { sfx: "carrom_rebound", label: "wood knock" },
  { sfx: "ludo_capture", label: "chip knock" },
  { sfx: "chess_piece_move", label: "piece thock" },
  { sfx: "chess_capture", label: "piece crash" },
  { sfx: "sneak_hit", label: "punch" },
  { sfx: "cricket_whistle", label: "whistle" },
  { sfx: "dice_roll_wood", label: "dice roll" },
  { sfx: "coin_drop", label: "coin drop" },
];

const PAIR_OPTIONS = [4, 6, 8, 10] as const;

type Card = { id: number; key: string; flipped: boolean; matched: boolean };

function fairRand(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

function build(pairs: number, theme: Theme, mode: Mode): Card[] {
  const items =
    mode === "sounds"
      ? SOUND_DECK.slice(0, pairs).map((s) => s.label)
      : THEMES[theme].items.slice(0, pairs);
  const deck = [...items, ...items]
    .map((key, i) => ({ id: i, key, flipped: false, matched: false }))
    .sort(() => fairRand(1000) / 1000 - 0.5)
    .map((c, i) => ({ ...c, id: i }));
  return deck;
}

export default function Memory() {
  const save = useSaveScore("memory");
  const [pairs, setPairs] = useState<4 | 6 | 8 | 10>(8);
  const [theme, setTheme] = useState<Theme>("emojis");
  const [mode, setMode] = useState<Mode>("pictures");
  const [opponent, setOpponent] = useState<Opponent>("solo");
  const [started, setStarted] = useState(false);

  const [cards, setCards] = useState<Card[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const [won, setWon] = useState(false);
  const [turn, setTurn] = useState<"you" | "ai">("you");
  const [myPairs, setMyPairs] = useState(0);
  const [aiPairs, setAiPairs] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(0);
  const aiMemory = useRef<Map<string, number[]>>(new Map());

  const startGame = useCallback(() => {
    const deck = build(pairs, theme, mode);
    setCards(deck);
    setPicked([]);
    setMoves(0);
    setWon(false);
    setLock(false);
    setTurn("you");
    setMyPairs(0);
    setAiPairs(0);
    setSeconds(0);
    aiMemory.current = new Map();
    startRef.current = Date.now();
    setStarted(true);
    sound.play("card_shuffle");
    announce(
      `Memory match started: ${pairs} pairs, ${mode === "sounds" ? "sound mode — flip a card to hear its sound" : THEMES[theme].label + " theme"}, ${opponent === "ai" ? "against the computer. You go first." : "solo. Flip two cards!"}`,
    );
  }, [pairs, theme, mode, opponent]);

  // timer
  useEffect(() => {
    if (!started || won) return;
    const iv = setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [started, won]);

  const cardFace = (c: Card) =>
    mode === "sounds" ? SOUND_DECK.find((s) => s.label === c.key)?.sfx : undefined;

  function resolvePair(a: number, b: number, by: "you" | "ai") {
    const match = cards[a].key === cards[b].key;
    if (match) {
      sound.play("select"); // ✅ correct!
      announce(`${by === "you" ? "You found" : "Computer found"} a pair — correct! ${pairsLeftAfter()} left.`);
      setCards((cs) => cs.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
      if (by === "you") setMyPairs((p) => p + 1);
      else setAiPairs((p) => p + 1);
    } else {
      sound.play("lose"); // ❌ wrong — buzz
      announce(by === "you" ? "Not a match — wrong!" : "Computer: not a match.");
      setCards((cs) => cs.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
    }
    setPicked([]);
    setLock(false);
    return match;
  }

  const pairsLeftAfter = () => {
    const matched = cards.filter((c) => c.matched).length + 2;
    return Math.max(0, pairs * 2 - matched) / 2;
  };

  function flip(idx: number, by: "you" | "ai" = "you") {
    if (lock || won) return;
    if (turn !== by) return;
    if (cards[idx].flipped || cards[idx].matched) return;
    sound.play("click");
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    // 🔊 sound mode: play the hidden sound + announce its label
    const sfx = mode === "sounds" ? SOUND_DECK.find((s) => s.label === next[idx].key)?.sfx : undefined;
    if (sfx) {
      setTimeout(() => sound.play(sfx), 60);
      announce(`${by === "you" ? "You flipped" : "Computer flipped"} a card — sound: ${next[idx].key}`);
    } else if (by === "you") {
      announce(`You flipped ${next[idx].key}`);
    }
    // AI remembers every card it has seen
    if (by === "ai") {
      const m = aiMemory.current.get(next[idx].key) ?? [];
      m.push(idx);
      aiMemory.current.set(next[idx].key, m);
    }
    const newPicked = [...picked, idx];
    setPicked(newPicked);

    if (newPicked.length === 2) {
      setMoves((m) => m + 1);
      setLock(true);
      const [a, b] = newPicked;
      setTimeout(() => {
        const match = resolvePair(a, b, by);
        if (!match && opponent === "ai") setTurn(by === "you" ? "ai" : "you");
        else if (match && opponent === "ai") setTurn(by); // match → same player goes again
      }, 900);
    }
  }

  // 🤖 AI turn — first card of its pair
  useEffect(() => {
    if (!started || won || opponent !== "ai" || turn !== "ai" || lock || picked.length !== 0) return;
    const hidden = cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.flipped && !c.matched);
    if (hidden.length === 0) return;
    const pickOne = (): number => {
      // 1) known pair from memory
      for (const [key, idxs] of aiMemory.current) {
        const avail = idxs.filter((i) => !cards[i].matched);
        if (avail.length >= 2) return avail[fairRand(avail.length)];
      }
      // 2) a seen single (try to complete it)
      for (const [key, idxs] of aiMemory.current) {
        const avail = idxs.filter((i) => !cards[i].matched && !cards[i].flipped);
        if (avail.length === 1) return avail[0];
      }
      // 3) random hidden
      return hidden[fairRand(hidden.length)].i;
    };
    const t1 = setTimeout(() => flip(pickOne(), "ai"), 700);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, lock, started, won, opponent, cards, picked]);

  // second AI flip after the first resolves
  useEffect(() => {
    if (!started || won || opponent !== "ai" || turn !== "ai" || lock) return;
    if (picked.length !== 1) return;
    const hidden = cards.map((c, idx) => ({ c, i: idx })).filter(({ c, i }) => !c.flipped && !c.matched && i !== picked[0]);
    if (hidden.length === 0) return;
    const pickSecond = (): number => {
      const key = cards[picked[0]].key;
      const m = aiMemory.current.get(key) ?? [];
      const avail = m.filter((i) => i !== picked[0] && !cards[i].matched && !cards[i].flipped);
      if (avail.length > 0) return avail[0];
      return hidden[fairRand(hidden.length)].i;
    };
    const t = setTimeout(() => flip(pickSecond(), "ai"), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, turn, lock, started, won, opponent, cards]);

  // win detection
  useEffect(() => {
    if (started && cards.length && cards.every((c) => c.matched) && !won) {
      setWon(true);
      const score = Math.max(10, pairs * 100 - moves * 5 - seconds);
      sound.play("win");
      const result =
        opponent === "ai"
          ? myPairs === aiPairs
            ? `It's a tie — both found ${myPairs} pairs in ${moves} moves, ${seconds} seconds!`
            : myPairs > aiPairs
              ? `You win! You found ${myPairs} pairs vs computer ${aiPairs}, in ${moves} moves and ${seconds} seconds.`
              : `Computer wins — it found ${aiPairs} pairs vs your ${myPairs} in ${seconds} seconds.`
          : `All ${pairs} pairs matched in ${moves} moves and ${seconds} seconds! Score ${score}. 🎉`;
      announce(result);
      save(score, { pairs, theme, mode, opponent, moves, seconds, myPairs, aiPairs });
    }
  }, [cards, won, started, moves, seconds, pairs, theme, mode, opponent, myPairs, aiPairs, save]);

  const gridCols = pairs <= 4 ? "grid-cols-4" : pairs <= 6 ? "grid-cols-4" : pairs <= 8 ? "grid-cols-4" : "grid-cols-5";

  const pill = (active: boolean) =>
    `rounded-xl border-2 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400 ${
      active ? "border-emerald-400 bg-emerald-600/30 text-emerald-100" : "border-slate-600 bg-slate-800/60 text-slate-300"
    }`;

  return (
    <div className="mx-auto max-w-lg">
      {/* Setup */}
      {!started && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-bold text-emerald-300">🧠 Memory Match</h2>
          <p className="mt-1 text-sm text-slate-400">Flip cards and match all the pairs. Pick your board, theme and mode!</p>

          <div className="mt-4">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">🃏 How many pairs?</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Number of pairs">
              {PAIR_OPTIONS.map((p) => (
                <button key={p} aria-pressed={pairs === p} onClick={() => { sound.play("select"); setPairs(p); }} className={pill(pairs === p)}>
                  {p} pairs ({p * 2} cards)
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">🎨 Theme (picture mode)</div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
              {(Object.keys(THEMES) as Theme[]).map((t) => (
                <button key={t} aria-pressed={theme === t} onClick={() => { sound.play("select"); setTheme(t); }} className={pill(theme === t)}>
                  {THEMES[t].icon} {THEMES[t].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">👁 / 🔊 Mode</div>
            <div className="flex gap-2" role="group" aria-label="Mode">
              <button aria-pressed={mode === "pictures"} onClick={() => { sound.play("select"); setMode("pictures"); }} className={pill(mode === "pictures")}>👁 Pictures</button>
              <button aria-pressed={mode === "sounds"} onClick={() => { sound.play("select"); setMode("sounds"); }} className={pill(mode === "sounds")}>🔊 Sound memory — match by sound!</button>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">🤖 Opponent</div>
            <div className="flex gap-2" role="group" aria-label="Opponent">
              <button aria-pressed={opponent === "solo"} onClick={() => { sound.play("select"); setOpponent("solo"); }} className={pill(opponent === "solo")}>😌 Solo</button>
              <button aria-pressed={opponent === "ai"} onClick={() => { sound.play("select"); setOpponent("ai"); }} className={pill(opponent === "ai")}>🤖 vs AI</button>
            </div>
          </div>

          <button
            onClick={startGame}
            className="mt-5 min-h-14 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-lg font-black text-white focus:outline-none focus:ring-4 focus:ring-yellow-400"
          >
            ▶️ Start — {pairs} pairs · {mode === "sounds" ? "🔊 sounds" : THEMES[theme].label} · {opponent === "ai" ? "🤖 vs AI" : "😌 solo"}
          </button>
        </div>
      )}

      {started && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            <span className="text-slate-400">
              Moves: <b className="text-white">{moves}</b> · ⏱ <b className="text-white">{seconds}s</b>
              {opponent === "ai" && (
                <>
                  {" "}· You <b className="text-emerald-400">{myPairs}</b> — 🤖 <b className="text-violet-400">{aiPairs}</b>
                </>
              )}
            </span>
            <span className="text-xs font-bold text-amber-300" role="status">
              {opponent === "ai" ? (turn === "you" ? "Your turn" : "🤖 Computer's turn…") : ""}
            </span>
            <button
              onClick={startGame}
              className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold transition hover:bg-slate-700"
            >
              New Game
            </button>
          </div>

          {won && (
            <div className="mb-4 rounded-2xl bg-emerald-500/15 p-4 text-center text-base font-bold text-emerald-400" role="status">
              🎉 {opponent === "ai"
                ? (myPairs > aiPairs ? `You win ${myPairs}–${aiPairs}!` : myPairs < aiPairs ? `Computer wins ${aiPairs}–${myPairs}!` : `Tie ${myPairs}–${myPairs}!`)
                : `Solved in ${moves} moves, ${seconds}s!`}{" "}Score saved.
            </div>
          )}

          <div className={`grid ${gridCols} gap-3`}>
            {cards.map((c, i) => {
              const show = c.flipped || c.matched;
              const label = mode === "sounds" ? `🔊 ${c.key}` : c.key;
              return (
                <button
                  key={c.id}
                  onClick={() => flip(i, "you")}
                  disabled={lock || turn === "ai" || won}
                  aria-label={show ? `Card ${i + 1}: ${label}${c.matched ? " (matched)" : ""}` : `Card ${i + 1}, face down — flip to ${mode === "sounds" ? "hear" : "see"}`}
                  className={`grid aspect-square place-items-center rounded-2xl text-2xl transition disabled:cursor-not-allowed ${
                    show
                      ? c.matched
                        ? "bg-emerald-600/40 ring-2 ring-emerald-400"
                        : "bg-slate-700"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 hover:opacity-90"
                  }`}
                >
                  {show ? label : "❓"}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
