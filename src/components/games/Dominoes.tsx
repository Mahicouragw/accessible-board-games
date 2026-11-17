"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type Domino = { a: number; b: number; id: number };
/** Played tile: left/right are the chain ends as displayed. */
type PlayedDomino = { id: number; left: number; right: number };

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

function deal(): { hand: Domino[]; aiHand: Domino[]; boneyard: Domino[]; first: Domino } {
  const set = createDominoSet();
  return {
    hand: set.slice(0, 7),
    aiHand: set.slice(7, 14),
    boneyard: set.slice(14),
    first: set[14] ?? set[0],
  };
}

const pips = (d: Domino) => d.a + d.b;

export default function Dominoes() {
  const [hand, setHand] = useState<Domino[]>([]);
  const [aiHand, setAiHand] = useState<Domino[]>([]);
  const [boneyard, setBoneyard] = useState<Domino[]>([]);
  const [board, setBoard] = useState<PlayedDomino[]>([]);
  const [turn, setTurn] = useState<"you" | "ai">("you");
  const [score, setScore] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [over, setOver] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [passes, setPasses] = useState(0);
  const busyRef = useRef(false);
  const stateRef = useRef({ hand, aiHand, boneyard, board, turn, passes });
  stateRef.current = { hand, aiHand, boneyard, board, turn, passes };

  useEffect(() => {
    const d = deal();
    setHand(d.hand);
    setAiHand(d.aiHand);
    setBoneyard(d.boneyard);
    setBoard([{ id: d.first.id, left: d.first.a, right: d.first.b }]);
    setMsg(`First tile is ${d.first.a}-${d.first.b}. Your turn — play a domino on an end that matches.`);
    announce("Dominoes vs the computer. Tap Left or Right on a domino in your hand to play it on a matching end. If you cannot play, tap Pass. Empty your hand to win.");
    sound.play("card_shuffle");
  }, []);

  const leftEnd = board.length ? board[0].left : null;
  const rightEnd = board.length ? board[board.length - 1].right : null;

  const canPlay = (d: Domino, side: "left" | "right") => {
    const end = side === "left" ? leftEnd : rightEnd;
    return end === null || d.a === end || d.b === end;
  };

  /** Attach domino to an end, orienting it so the matching pip touches the chain. */
  function orient(d: Domino, end: number, side: "left" | "right"): PlayedDomino {
    const inner = d.a === end ? d.a : d.b;
    const outer = d.a === end ? d.b : d.a;
    return side === "left" ? { id: d.id, left: outer, right: inner } : { id: d.id, left: inner, right: outer };
  }

  function endGame(text: string, youWon: boolean) {
    setOver(text);
    setMsg(text);
    announce(text);
    if (youWon) {
      sound.play("win");
      setWins((w) => w + 1);
    } else {
      sound.play("lose");
      setLosses((l) => l + 1);
    }
  }

  function aiTurn() {
    const s = stateRef.current;
    if (s.turn !== "ai") return;
    let { aiHand, boneyard, board } = s;
    const leftEnd = board.length ? board[0].left : null;
    const rightEnd = board.length ? board[board.length - 1].right : null;

    const playable = (d: Domino) =>
      (leftEnd !== null && (d.a === leftEnd || d.b === leftEnd) && { d, side: "left" as const }) ||
      (rightEnd !== null && (d.a === rightEnd || d.b === rightEnd) && { d, side: "right" as const }) ||
      null;

    let play = aiHand.map(playable).find(Boolean) ?? null;
    // draw from the boneyard until playable (or boneyard empty)
    while (!play && boneyard.length) {
      const d = boneyard[0];
      boneyard = boneyard.slice(1);
      aiHand = [...aiHand, d];
      play = playable(d);
    }

    if (play) {
      const { d, side } = play;
      const end = side === "left" ? leftEnd! : rightEnd!;
      const tile = orient(d, end, side);
      board = side === "left" ? [tile, ...board] : [...board, tile];
      aiHand = aiHand.filter((x) => x.id !== d.id);
      sound.play("card_shuffle");
      const text = `Computer plays ${d.a}-${d.b} on the ${side} end.`;
      setMsg(text);
      announce(text);
      setAiHand(aiHand);
      setBoneyard(boneyard);
      setBoard(board);
      setPasses(0);
      if (aiHand.length === 0) {
        endGame("Computer emptied its hand — computer wins this round! 😔", false);
        return;
      }
    } else {
      sound.play("turn");
      setMsg("Computer passes — no playable domino.");
      announce("Computer passes.");
      setPasses(s.passes + 1);
      if (s.passes + 1 >= 2) {
        // both passed → lower remaining pips wins
        const myPips = s.hand.reduce((a, d) => a + pips(d), 0);
        const aiPips = aiHand.reduce((a, d) => a + pips(d), 0);
        if (myPips <= aiPips) endGame(`Blocked game! You have ${myPips} pips vs computer ${aiPips} — you win! 🎉`, true);
        else endGame(`Blocked game! Computer has ${aiPips} pips vs your ${myPips} — computer wins. 😔`, false);
        return;
      }
    }
    setTurn("you");
  }

  function afterYourMove(newHand: Domino[], newBoard: PlayedDomino[]) {
    if (newHand.length === 0) {
      endGame(`Domino! You emptied your hand — you win the round! 🎉 Score ${score}`, true);
      return;
    }
    setPasses(0);
    setTurn("ai");
    busyRef.current = true;
    setTimeout(() => {
      aiTurn();
      busyRef.current = false;
    }, 800);
  }

  const playDomino = (d: Domino, side: "left" | "right") => {
    if (over || turn !== "you" || busyRef.current) return;
    if (!canPlay(d, side)) {
      sound.play("lose");
      announce("That domino does not match either end. Try the other side, another domino, or Pass.");
      return;
    }
    const end = (side === "left" ? leftEnd : rightEnd)!;
    const tile = orient(d, end, side);
    const newBoard = side === "left" ? [tile, ...board] : [...board, tile];
    const newHand = hand.filter((x) => x.id !== d.id);
    setBoard(newBoard);
    setHand(newHand);
    setScore((s) => s + pips(d));
    sound.play("card_shuffle");
    announce(`You play ${d.a}-${d.b} on the ${side} end (${end}).`);
    setMsg(`You played ${d.a}-${d.b} ${side}. Computer is thinking…`);
    afterYourMove(newHand, newBoard);
  };

  const pass = () => {
    if (over || turn !== "you" || busyRef.current) return;
    if (hand.some((d) => canPlay(d, "left") || canPlay(d, "right"))) {
      announce("You still have a playable domino — you cannot pass yet.");
      sound.play("lose");
      return;
    }
    // draw from boneyard if possible
    if (boneyard.length) {
      const d = boneyard[0];
      setBoneyard(boneyard.slice(1));
      setHand([...hand, d]);
      announce(`No match — you draw ${d.a}-${d.b} from the boneyard. Play it or pass again.`);
      sound.play("click");
      return;
    }
    sound.play("turn");
    setMsg("You pass. Computer's turn…");
    announce("You pass.");
    setPasses((p) => p + 1);
    setTurn("ai");
    busyRef.current = true;
    setTimeout(() => {
      aiTurn();
      busyRef.current = false;
    }, 800);
  };

  const reset = () => {
    const d = deal();
    setHand(d.hand);
    setAiHand(d.aiHand);
    setBoneyard(d.boneyard);
    setBoard([{ id: d.first.id, left: d.first.a, right: d.first.b }]);
    setScore(0);
    setTurn("you");
    setOver(null);
    setPasses(0);
    setMsg("New round. Your turn — match an end.");
    sound.play("click");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-3">
        <h2 className="font-bold">🀄 Dominoes vs Computer</h2>
        <p className="text-xs text-slate-400">Double-six set, 7 tiles each. Match an end to play; if you can&apos;t, draw from the boneyard or pass. Empty your hand to win; blocked game → fewest pips wins.</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Score: {score}</span>
          <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border">W: {wins} / L: {losses}</span>
          <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300">Ends: {leftEnd ?? "–"} | {rightEnd ?? "–"}</span>
          <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300">Boneyard: {boneyard.length}</span>
          <span className="px-2 py-1 rounded-full bg-slate-700 text-slate-300">Computer tiles: {aiHand.length}</span>
        </div>
      </div>

      {over && (
        <div className={`rounded-2xl p-4 text-center text-lg font-bold ${over.includes("you win") ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
          {over}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-xs font-bold text-slate-400 mb-2">Board — Ends: {leftEnd} – {rightEnd}</div>
        <div className="flex flex-wrap gap-1 justify-center min-h-[80px] items-center bg-slate-800/50 rounded-xl p-3">
          {board.map((d, idx) => (
            <div key={`${d.id}-${idx}`} className={`w-12 h-8 rounded border-2 bg-white text-slate-900 grid grid-cols-2 text-[10px] font-bold ${idx === 0 ? "border-sky-400" : "border-emerald-400"}`}>
              <span className="grid place-items-center border-r border-slate-300">{d.left}</span>
              <span className="grid place-items-center">{d.right}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-xs font-bold text-slate-400 mb-2">Your Hand ({hand.length}) — play on left or right end</div>
        <div className="grid grid-cols-4 gap-2">
          {hand.map((d) => (
            <div key={d.id} className="rounded-xl bg-slate-800 border border-slate-700 p-2">
              <div className="w-full h-12 rounded bg-white text-slate-900 grid grid-cols-2 font-bold">
                <span className="grid place-items-center border-r border-slate-300 text-lg">{d.a}</span>
                <span className="grid place-items-center text-lg">{d.b}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  onClick={() => playDomino(d, "left")}
                  disabled={over !== null || turn !== "you" || !canPlay(d, "left")}
                  aria-label={`Play ${d.a}-${d.b} on the left end ${leftEnd ?? ""}`}
                  className="rounded bg-sky-500/20 border border-sky-500/50 py-1 text-[10px] font-bold text-sky-300 disabled:opacity-30"
                >
                  ← {leftEnd ?? "–"}
                </button>
                <button
                  onClick={() => playDomino(d, "right")}
                  disabled={over !== null || turn !== "you" || !canPlay(d, "right")}
                  aria-label={`Play ${d.a}-${d.b} on the right end ${rightEnd ?? ""}`}
                  className="rounded bg-emerald-500/20 border border-emerald-500/50 py-1 text-[10px] font-bold text-emerald-300 disabled:opacity-30"
                >
                  {rightEnd ?? "–"} →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-slate-300" role="status">{msg || (turn === "you" ? "Your turn." : "Computer's turn…")}</p>

      <div className="flex gap-2">
        <button
          onClick={pass}
          disabled={over !== null || turn !== "you" || busyRef.current}
          className="rounded-xl bg-amber-600/80 px-6 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Pass ✋
        </button>
        <button onClick={reset} className="flex-1 rounded-xl bg-slate-700 py-2 text-sm font-bold">
          {over ? "Play Again ♻️" : "Reset ♻️"}
        </button>
        <button onClick={() => sound.play("card_shuffle")} className="rounded-xl bg-amber-600 px-4 py-2 text-xs text-white">🔊 Shuffle</button>
      </div>
    </div>
  );
}
