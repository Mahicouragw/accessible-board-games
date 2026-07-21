"use client";

// 🏏 Hand Cricket — the classic school-game (idea inspired by KM Sanjay's
// Hand Cricket apps; all code original to this arcade):
//   Batting: pick 1–6. The computer picks a random 1–6 to bowl.
//     • Different numbers → your number is scored as runs.
//     • Same number → you're OUT!
//   Then swap: you bowl, the computer bats, and it chases your score.
// Built TalkBack-first: every ball is announced the exact moment it happens,
// and every sound effect fires in sync with the event (bat crack on contact,
// crowd roar on boundaries, wicket rattle on OUT).

import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useSaveScore } from "@/lib/useSaveScore";

type Phase = "toss-choice" | "toss-play" | "bat-bowl-choice" | "batting" | "bowling" | "over";
type LogEntry = { n: number; you: number; ai: number; text: string; out: boolean };

// Provably fair 1–6 using crypto randomness (no predictable Math.random).
function fairPick(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 6) + 1;
}

export default function HandCricket() {
  const save = useSaveScore("hand-cricket");

  const [phase, setPhase] = useState<Phase>("toss-choice");
  const [busy, setBusy] = useState(false);
  const [tossPick, setTossPick] = useState<"odd" | "even" | null>(null);
  const [aiBattingFirst, setAiBattingFirst] = useState(false);

  const [myRuns, setMyRuns] = useState(0);
  const [myBalls, setMyBalls] = useState(0);
  const [myFours, setMyFours] = useState(0);
  const [mySixes, setMySixes] = useState(0);
  const [myOut, setMyOut] = useState(false);

  const [aiRuns, setAiRuns] = useState(0);
  const [aiBalls, setAiBalls] = useState(0);
  const [aiOut, setAiOut] = useState(false);

  const [target, setTarget] = useState<number | null>(null);
  const [ballMsg, setBallMsg] = useState("Tap a number to play!");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [winner, setWinner] = useState<"you" | "computer" | "draw" | null>(null);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [draws, setDraws] = useState(0);
  const [best, setBest] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    announce(
      "Hand Cricket. Classic one-to-six hand cricket against the computer. First the toss: choose odd or even. Every ball is announced, and sounds play exactly with the action.",
    );
    return () => {
      mounted.current = false;
    };
  }, []);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const pushLog = (entry: LogEntry) =>
    setLog((prev) => [{ ...entry, n: prev.length + 1 }, ...prev].slice(0, 25));

  // ---------------------------- TOSS ----------------------------
  function chooseOddEven(choice: "odd" | "even") {
    sound.play("button");
    setTossPick(choice);
    setPhase("toss-play");
    announce(`You chose ${choice}. Now tap any number from one to six for the toss.`);
  }

  async function playToss(n: number) {
    if (busy) return;
    sound.play("button");
    setBusy(true);
    setBallMsg("🪙 Toss is spinning…");
    await delay(550); // coin-spin suspense, then reveal + sound + announce together
    if (!mounted.current) return;
    const ai = fairPick();
    const sum = n + ai;
    const winner = (sum % 2 === 0 ? "even" : "odd") === tossPick ? "you" : "computer";
    const won = winner === "you";
    sound.play(won ? "level_up" : "turn"); // toss result sting in sync with reveal
    const msg = `Toss: you played ${n}, computer played ${ai}. Sum ${sum} — ${sum % 2 === 0 ? "even" : "odd"}! ${won ? "You win the toss!" : "Computer wins the toss."} ${won ? "Choose batting or bowling." : "Computer is deciding…"}`;
    setBallMsg(msg);
    announce(msg);
    if (won) {
      setPhase("bat-bowl-choice");
    } else {
      await delay(900); // let the toss result be heard, then AI decision
      if (!mounted.current) return;
      const aiChoice = fairPick() % 2 === 0 ? "bat" : "bowl";
      setAiBattingFirst(aiChoice === "bat");
      const tell = `Computer chooses to ${aiChoice} first. ${aiChoice === "bowl" ? "You bat first — tap a number to play your shot!" : "You bowl first — tap a number to bowl!"}`;
      sound.play("turn");
      setBallMsg(tell);
      announce(tell);
      setPhase(aiChoice === "bat" ? "bowling" : "batting");
    }
    setBusy(false);
  }

  function chooseBatBowl(choice: "bat" | "bowl") {
    sound.play("button");
    setAiBattingFirst(choice === "bowl");
    const msg = choice === "bat" ? "You chose to bat first. Tap a number from one to six to play your shot!" : "You chose to bowl first. Tap a number from one to six to bowl at the computer!";
    setBallMsg(msg);
    announce(msg);
    setPhase(choice === "bat" ? "batting" : "bowling");
  }

  // ---------------------------- BALL RESOLUTION ----------------------------
  // Sounds fire exactly at reveal: bat crack on runs (crowd roar half a beat
  // later on 4s & 6s, like the ball reaching the rope), wicket rattle on OUT.
  function ballSounds(runs: number, out: boolean) {
    if (out) {
      sound.play("cricket_wicket");
      return;
    }
    sound.play("cricket_bat");
    if (runs === 4 || runs === 6) {
      setTimeout(() => mounted.current && sound.play("cricket_boundary"), 380);
    }
  }

  async function playBall(n: number) {
    if (busy || phase === "over") return;
    sound.play("button"); // instant tap feedback
    setBusy(true);
    setBallMsg(phase === "batting" ? "🏏 The bowler is running in…" : "⚾ You run in to bowl…");
    await delay(500); // bowler's run-up; reveal lands WITH the sound
    if (!mounted.current) return;
    const ai = fairPick();
    if (phase === "batting") resolveMyShot(n, ai);
    else resolveMyBowl(n, ai);
  }

  function resolveMyShot(you: number, ai: number) {
    const out = you === ai;
    const balls = myBalls + 1;
    setMyBalls(balls);
    ballSounds(you, out);
    if (out) {
      setMyOut(true);
      const text = `MATCH! Both played ${you} — you are OUT ball number ${balls}!`;
      pushLog({ n: balls, you, ai, text, out: true });
      announce(`${text} Your innings ends on ${myRuns} runs.`);
      setBallMsg(`❌ ${text} Your innings: ${myRuns} runs.`);
      endMyInnings(myRuns);
      return;
    }
    const runs = myRuns + you;
    const fours = myFours + (you === 4 ? 1 : 0);
    const sixes = mySixes + (you === 6 ? 1 : 0);
    setMyRuns(runs);
    if (you === 4) setMyFours(fours);
    if (you === 6) setMySixes(sixes);
    const flavor = you === 6 ? "MASSIVE SIX! 🎉" : you === 4 ? "FOUR! Cracking shot! 🎉" : `${you} run${you > 1 ? "s" : ""}.`;
    const chase = target !== null ? ` Need ${Math.max(0, target - runs)} more to win.` : "";
    const text = `You played ${you}, computer bowled ${ai}. ${flavor} Total ${runs} from ${balls} balls.${chase}`;
    pushLog({ n: balls, you, ai, text, out: false });
    announce(text);
    setBallMsg(`🏏 ${flavor} Total: ${runs}.${chase}`);
    // Chase complete?
    if (target !== null && runs >= target) return finishMatch("you", `${runs} runs — target ${target} chased with ${balls} balls!`);
    setBusy(false);
  }

  function resolveMyBowl(you: number, ai: number) {
    const out = you === ai;
    const balls = aiBalls + 1;
    setAiBalls(balls);
    if (out) {
      ballSounds(0, true);
      setAiOut(true);
      const text = `You bowled ${you} and the computer also played ${ai} — MATCH! The computer is OUT ball number ${balls}!`;
      pushLog({ n: balls, you, ai, text, out: true });
      announce(`${text} Computer made ${aiRuns} runs.`);
      setBallMsg(`💥 ${text} Computer: ${aiRuns} runs.`);
      if (target === null) {
        // AI batted first → it was all out → my chase begins
        const t = aiRuns + 1;
        setTarget(t);
        const msg = `Computer all out for ${aiRuns}. You need ${t} to win. Your turn to bat — tap a number!`;
        setPhase("batting");
        setBallMsg(msg);
        announce(msg);
        setBusy(false);
        return;
      }
      // AI was chasing and got out
      if (aiRuns === target - 1) return finishMatch("draw", `both innings end on ${aiRuns} — a tie!`);
      return finishMatch("you", `computer all out for ${aiRuns}, ${target - 1 - aiRuns} short of the target!`);
    }
    ballSounds(ai, false);
    const runs = aiRuns + ai;
    setAiRuns(runs);
    const flavor = ai === 6 ? "Computer smashes a SIX! 😬" : ai === 4 ? "Computer finds a FOUR." : `Computer takes ${ai}.`;
    const chase = target !== null ? ` Computer needs ${Math.max(0, target - runs)} more.` : "";
    const text = `You bowled ${you}, computer played ${ai}. ${flavor} Computer total ${runs} from ${balls} balls.${chase}`;
    pushLog({ n: balls, you, ai, text, out: false });
    announce(text);
    setBallMsg(`⚾ ${flavor} Computer: ${runs}.${chase}`);
    if (target !== null && runs >= target) return finishMatch("computer", `computer chased ${target} in ${balls} balls`);
    setBusy(false);
  }

  function endMyInnings(runs: number) {
    if (target === null) {
      // I batted first → set the target
      const t = runs + 1;
      setTarget(t);
      const msg = `Innings break! You scored ${runs} runs. The computer needs ${t} to win. Now you bowl — tap a number!`;
      sound.play("turn");
      setPhase("bowling");
      setBallMsg(msg);
      announce(msg);
      setBusy(false);
      return;
    }
    // I was chasing and got out
    if (runs === target - 1) return finishMatch("draw", `both innings finish on ${runs} — a tie!`);
    finishMatch("computer", `you were bowled out for ${runs}, ${target - 1 - runs} runs short`);
  }

  // ---------------------------- MATCH END ----------------------------
  function finishMatch(result: "you" | "computer" | "draw", detail: string) {
    setWinner(result);
    setPhase("over");
    setBusy(false);
    if (result === "you") {
      sound.play("win");
      setWins((w) => w + 1);
      announce(`You WIN! ${detail} Well played! Tap Play again for a rematch.`);
      setBallMsg(`🏆 YOU WIN! ${detail}`);
    } else if (result === "computer") {
      sound.play("lose");
      setLosses((l) => l + 1);
      announce(`Computer wins — ${detail}. Better luck next time! Tap Play again for a rematch.`);
      setBallMsg(`😔 Computer wins — ${detail}.`);
    } else {
      sound.play("turn");
      setDraws((d) => d + 1);
      announce(`Match tied — ${detail}. Tap Play again to break the tie!`);
      setBallMsg(`🤝 It's a tie — ${detail}.`);
    }
    // Record the player's innings (runs is the leaderboard metric)
    if (myRuns > 0 || myBalls > 0) {
      if (myRuns > best) setBest(myRuns);
      save(myRuns, { balls: myBalls, fours: myFours, sixes: mySixes, result });
    }
  }

  function resetMatch() {
    sound.play("click");
    setPhase("toss-choice");
    setTossPick(null);
    setMyRuns(0); setMyBalls(0); setMyFours(0); setMySixes(0); setMyOut(false);
    setAiRuns(0); setAiBalls(0); setAiOut(false);
    setTarget(null);
    setWinner(null);
    setLog([]);
    setBallMsg("New match! Choose odd or even for the toss.");
    announce("New match. Choose odd or even for the toss.");
  }

  // ---------------------------- UI ----------------------------
  const numberPad = (
    <div className="mt-4" role="group" aria-label="Numbers one to six">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            disabled={busy || phase === "over" || phase === "toss-choice" || phase === "bat-bowl-choice"}
            aria-label={phase === "toss-play" ? `Play ${n} for the toss` : phase === "bowling" ? `Bowl ${n}` : `Play ${n} runs`}
            onClick={() => (phase === "toss-play" ? playToss(n) : playBall(n))}
            className="min-h-16 rounded-2xl border-2 border-emerald-500/60 bg-emerald-600/20 text-3xl font-black text-emerald-200 transition hover:bg-emerald-600/40 focus:outline-none focus:ring-4 focus:ring-yellow-400 disabled:opacity-40"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6" aria-label="Hand Cricket">
      <h2 className="text-xl font-bold text-emerald-300">🏏 Hand Cricket — You vs Computer</h2>
      <p className="mt-1 text-sm text-slate-400">
        Pick 1–6. If your number matches the computer's, the batter is OUT! Sounds and TalkBack announce every ball.
      </p>

      {/* Scoreboard */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center" role="status" aria-label="Scoreboard">
        <div className="rounded-2xl bg-slate-800/70 p-3">
          <div className="text-xs uppercase text-slate-400">You {target !== null && aiBattingFirst ? "(chasing)" : ""}</div>
          <div className="text-2xl font-black text-white">{myRuns}</div>
          <div className="text-xs text-slate-400">{myBalls} balls • 4s {myFours} • 6s {mySixes}{myOut ? " • OUT" : ""}</div>
        </div>
        <div className="rounded-2xl bg-slate-800/70 p-3">
          <div className="text-xs uppercase text-slate-400">Computer</div>
          <div className="text-2xl font-black text-white">{aiRuns}</div>
          <div className="text-xs text-slate-400">{aiBalls} balls{aiOut ? " • OUT" : ""}</div>
        </div>
      </div>
      {target !== null && (
        <p className="mt-2 text-center text-sm font-semibold text-amber-300" role="status">
          🎯 Target: {target} runs
        </p>
      )}

      {/* Live ball message */}
      <div aria-live="polite" className="mt-4 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-center text-base font-semibold text-slate-100">
        {ballMsg}
      </div>

      {/* Toss controls */}
      {phase === "toss-choice" && (
        <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Toss — choose odd or even">
          <button onClick={() => chooseOddEven("odd")} className="min-h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400/60 text-lg font-bold text-amber-200 focus:outline-none focus:ring-4 focus:ring-yellow-400">🪙 Odd</button>
          <button onClick={() => chooseOddEven("even")} className="min-h-14 rounded-2xl bg-sky-500/20 border-2 border-sky-400/60 text-lg font-bold text-sky-200 focus:outline-none focus:ring-4 focus:ring-yellow-400">🪙 Even</button>
        </div>
      )}
      {phase === "bat-bowl-choice" && (
        <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Choose batting or bowling">
          <button onClick={() => chooseBatBowl("bat")} className="min-h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/60 text-lg font-bold text-emerald-200 focus:outline-none focus:ring-4 focus:ring-yellow-400">🏏 Bat first</button>
          <button onClick={() => chooseBatBowl("bowl")} className="min-h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-400/60 text-lg font-bold text-rose-200 focus:outline-none focus:ring-4 focus:ring-yellow-400">⚾ Bowl first</button>
        </div>
      )}

      {numberPad}

      {phase === "over" && (
        <div className="mt-4 text-center">
          <button onClick={resetMatch} className="min-h-14 rounded-2xl bg-emerald-600 px-8 text-lg font-bold text-white focus:outline-none focus:ring-4 focus:ring-yellow-400" aria-label="Play again — new match">
            🔄 Play again
          </button>
          <p className="mt-3 text-sm text-slate-400">
            Wins {wins} • Losses {losses} • Ties {draws} • Best innings {best}
          </p>
        </div>
      )}
      {(wins + losses + draws > 0) && phase !== "over" && (
        <p className="mt-3 text-center text-xs text-slate-500">Session: {wins}W • {losses}L • {draws}T • Best {best}</p>
      )}

      {/* Ball-by-ball log */}
      {log.length > 0 && (
        <ol className="mt-5 max-h-48 space-y-1 overflow-auto rounded-2xl bg-slate-950/60 p-3 text-sm" aria-label="Ball by ball log" role="log">
          {log.map((e) => (
            <li key={e.n} className={e.out ? "text-rose-300 font-semibold" : "text-slate-300"}>
              Ball {e.n}: {e.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
