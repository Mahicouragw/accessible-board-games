"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Move } from "chess.js";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { useGameGestureHandlers } from "@/lib/gesture/useGameGestures";
import { getAiLevel } from "@/lib/player-prefs";

type Match = {
  id: number;
  game: string;
  status: string;
  vsAi: boolean;
  player1Id: number | null;
  player1Name: string | null;
  player2Id: number | null;
  player2Name: string | null;
  board: number[] | number[][] | { fen: string };
  turn: number;
  winner: number | null;
};

type Stage = "lobby" | "searching" | "waiting" | "playing";

// ---------- Local (offline) match support ----------
// Guests and devices without the cloud database still get fully playable
// games: local vs-AI and local 2-player pass-and-play, implemented in-browser.

type LocalMatch = {
  mode: "ai" | "pvp";
  board: number[] | number[][] | { fen: string };
  turn: 1 | 2;
  winner: number | null; // 0 = draw, null = ongoing
};

function initLocalBoard(game: string): LocalMatch["board"] {
  if (game === "connect-four") return Array.from({ length: 6 }, () => Array(7).fill(0));
  if (game === "chess") return { fen: new Chess().fen() };
  return Array(9).fill(0);
}

function tttWinner(b: number[]): number {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, c, d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  if (b.every((v) => v !== 0)) return 0;
  return -1; // ongoing
}

function bestTttMove(b: number[], me: number): number {
  const opp = me === 1 ? 2 : 1;
  const score = (board: number[], player: number): number => {
    const w = tttWinner(board);
    if (w === me) return 10;
    if (w === opp) return -10;
    if (w === 0) return 0;
    let best = player === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== 0) continue;
      board[i] = player;
      const s = score(board, player === me ? opp : me);
      board[i] = 0;
      best = player === me ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  };
  let best = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== 0) continue;
    b[i] = me;
    const s = score(b, opp);
    b[i] = 0;
    if (s > best) {
      best = s;
      move = i;
    }
  }
  return move;
}

function c4Drop(board: number[][], col: number, player: number): number[][] | null {
  if (col < 0 || col >= board[0].length || board[0][col] !== 0) return null;
  const nb = board.map((r) => [...r]);
  for (let r = nb.length - 1; r >= 0; r--) {
    if (nb[r][col] === 0) {
      nb[r][col] = player;
      return nb;
    }
  }
  return null;
}

function c4Winner(b: number[][]): number {
  const rows = b.length;
  const cols = b[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = b[r][c];
      if (!v) continue;
      if (c + 3 < cols && b[r][c + 1] === v && b[r][c + 2] === v && b[r][c + 3] === v) return v;
      if (r + 3 < rows && b[r + 1][c] === v && b[r + 2][c] === v && b[r + 3][c] === v) return v;
      if (r + 3 < rows && c + 3 < cols && b[r + 1][c + 1] === v && b[r + 2][c + 2] === v && b[r + 3][c + 3] === v) return v;
      if (r + 3 < rows && c - 3 >= 0 && b[r + 1][c - 1] === v && b[r + 2][c - 2] === v && b[r + 3][c - 3] === v) return v;
    }
  }
  if (b[0].every((v) => v !== 0)) return 0;
  return -1;
}

function bestC4Move(board: number[][], me: number): number {
  const opp = me === 1 ? 2 : 1;
  const cols = board[0].length;
  const order = [3, 2, 4, 1, 5, 0, 6];
  // 1. win if possible
  for (const c of order) {
    const nb = c4Drop(board, c, me);
    if (nb && c4Winner(nb) === me) return c;
  }
  // 2. block opponent win
  for (const c of order) {
    const nb = c4Drop(board, c, opp);
    if (nb && c4Winner(nb) === opp) return c;
  }
  // 3. prefer center columns that are playable
  for (const c of order) {
    if (board[0][c] === 0) return c;
  }
  return Math.floor(Math.random() * cols);
}

const PIECE_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function chessAiPick(fen: string): { from: string; to: string; promotion?: string } | null {
  const g = new Chess(fen);
  const moves = g.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    let s = Math.random() * 0.6;
    if (m.captured) s += PIECE_VAL[m.captured] ?? 0;
    if (m.promotion) s += 8;
    if (m.san.includes("+")) s += 0.8;
    const f = "abcdefgh".indexOf(m.to[0]);
    s += (3.5 - Math.abs(3.5 - f)) * 0.06 + (4 - Math.abs(4 - Number(m.to[1]))) * 0.04;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best ? { from: best.from, to: best.to, promotion: best.promotion ?? "q" } : null;
}

export default function OnlineMatch({
  game,
  initialMatchId,
}: {
  game: "tic-tac-toe" | "connect-four" | "chess";
  initialMatchId?: number;
}) {
  const { player, refresh } = useSession();
  const [stage, setStage] = useState<Stage>("lobby");
  const [match, setMatch] = useState<Match | null>(null);
  const [you, setYou] = useState<1 | 2>(1);
  const youRef = useRef<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Local offline match (guest / no database): fully playable in-browser.
  const [local, setLocal] = useState<LocalMatch | null>(null);
  const localRef = useRef<LocalMatch | null>(null);
  localRef.current = local;

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Track the previous live match state so TalkBack can announce every change
  // (opponent joins, opponent moves -> your turn, game result).
  const prevRef = useRef<{
    turn: number;
    status: string;
    winner: number | null;
    p2: number | null;
  } | null>(null);

  const describeResult = useCallback((m: Match, me: 1 | 2) => {
    if (m.winner === null) return "";
    if (m.winner === 0) return "Game over. It is a draw.";
    return m.winner === me ? "Game over. You won!" : "Game over. You lost this one.";
  }, []);

  // Announce live state transitions; returns nothing.
  const syncTalkback = useCallback(
    (m: Match, me: 1 | 2, via: "poll" | "move" | "join") => {
      const prev = prevRef.current;
      prevRef.current = { turn: m.turn, status: m.status, winner: m.winner, p2: m.player2Id };
      if (!prev) return;

      // Opponent just joined a waiting/invited match.
      if (m.status === "active" && prev.status !== "active") {
        announce(`Opponent found! ${m.player1Name ?? "Player 1"} versus ${m.player2Name ?? "Player 2"}. Game on!`);
        sound.play("turn");
        return;
      }
      // Game finished.
      if (m.status === "finished" && prev.status !== "finished") {
        announce(describeResult(m, me));
        sound.play(m.winner === me ? "win" : m.winner === 0 ? "turn" : "lose");
        return;
      }
      // Turn flipped to me during active play (opponent moved).
      if (m.status === "active" && prev.status === "active" && prev.turn !== m.turn && m.turn === me && via === "poll") {
        announce("Opponent moved. Your turn!");
        sound.play("turn");
      }
    },
    [describeResult],
  );

  const startPoll = useCallback(
    (id: number) => {
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/match/${id}`);
          if (!res.ok) return;
          const data = await res.json();
          const m: Match = data.match;
          setMatch(m);
          syncTalkback(m, youRef.current, "poll");
          if (m.status === "active") setStage("playing");
          if (m.status === "finished") {
            stopPoll();
            refresh();
          }
        } catch {
          /* ignore */
        }
      }, 1400);
    },
    [stopPoll, refresh, syncTalkback],
  );

  useEffect(() => () => stopPoll(), [stopPoll]);

  // Join a specific match from a challenge / invite link.
  useEffect(() => {
    if (!initialMatchId || !player) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/match/${initialMatchId}`);
        if (!res.ok) return;
        const data = await res.json();
        let m: Match = data.match;
        const mine = m.player1Id === (player?.id ?? 0) ? 1 : m.player2Id === (player?.id ?? 0) ? 2 : 0;
        if (mine === 0) return;
        setYou(mine as 1 | 2);
        youRef.current = mine as 1 | 2;
        // If I'm the invited player, accept.
        if (m.status === "invited" && mine === 2) {
          const acc = await fetch(`/api/match/${initialMatchId}/accept`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: player?.code ?? "" }),
          });
          if (acc.ok) m = (await acc.json()).match;
        }
        if (!active) return;
        setMatch(m);
        prevRef.current = { turn: m.turn, status: m.status, winner: m.winner, p2: m.player2Id };
        if (m.status === "active") {
          setStage("playing");
          announce(`Challenge accepted! You play ${m.player1Name ?? "your opponent"}. Game on!`);
        } else {
          setStage("waiting");
          announce(`Invite sent. ${m.player2Name ?? "Your friend"} has been challenged; waiting for them to accept.`);
          startPoll(m.id);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [initialMatchId, player, startPoll]);

  // ---------- local offline games (work for guests and without the cloud DB) ----------

  function startLocal(mode: "ai" | "pvp") {
    stopPoll();
    setMatch(null);
    setYou(1);
    youRef.current = 1;
    prevRef.current = null;
    const lm: LocalMatch = { mode, board: initLocalBoard(game), turn: 1, winner: null };
    setLocal(lm);
    setStage("playing");
    setBusy(false);
    const msg =
      mode === "ai"
        ? `Offline game vs AI started. You move first (❌). ${game === "chess" ? "Tap a piece, then a destination." : "Your turn!"}`
        : "Two players on this device. Player 1 (❌) moves first — pass the device after each move.";
    announce(msg);
    sound.play("select");
  }

  function applyLocalMove(move: number | { from: string; to: string; promotion?: string }): boolean {
    const cur = localRef.current;
    if (!cur || cur.winner !== null) return false;
    const me = cur.turn;
    if (game === "tic-tac-toe") {
      const b = cur.board as number[];
      const i = move as number;
      if (b[i] !== 0) return false;
      const nb = [...b];
      nb[i] = me;
      const w = tttWinner(nb);
      setLocal({ ...cur, board: nb, turn: me === 1 ? 2 : 1, winner: w >= 0 ? w : null });
      return true;
    }
    if (game === "connect-four") {
      const nb = c4Drop(cur.board as number[][], move as number, me);
      if (!nb) return false;
      const w = c4Winner(nb);
      setLocal({ ...cur, board: nb, turn: me === 1 ? 2 : 1, winner: w >= 0 ? w : null });
      return true;
    }
    // chess
    const g = new Chess((cur.board as { fen: string }).fen);
    const m = move as { from: string; to: string; promotion?: string };
    const applied = g.move({ from: m.from, to: m.to, promotion: m.promotion ?? "q" });
    if (!applied) {
      announce("Illegal move — try another square.");
      return false;
    }
    let winner: number | null = null;
    if (g.isGameOver()) {
      if (g.isCheckmate()) winner = g.turn() === "w" ? 2 : 1; // side to move is mated
      else winner = 0; // draw / stalemate / etc.
    }
    setLocal({ ...cur, board: { fen: g.fen() }, turn: me === 1 ? 2 : 1, winner });
    return true;
  }

  function aiLocalReply() {
    const cur = localRef.current;
    if (!cur || cur.winner !== null || cur.mode !== "ai" || cur.turn !== 2) return;
    setBusy(true);
    setTimeout(() => {
      const c = localRef.current;
      if (!c || c.winner !== null || c.turn !== 2) {
        setBusy(false);
        return;
      }
      // Settings → Game settings → AI strength: on "easy" the AI sometimes
      // plays a random legal move instead of its best one.
      const easy = getAiLevel() === "easy" && Math.random() < 0.4;
      if (game === "tic-tac-toe") {
        const b = [...(c.board as number[])];
        let i = bestTttMove(b, 2);
        if (easy) {
          const empties = b.map((v, k) => (v === 0 ? k : -1)).filter((k) => k >= 0);
          if (empties.length) i = empties[Math.floor(Math.random() * empties.length)];
        }
        if (i >= 0) applyLocalMove(i);
      } else if (game === "connect-four") {
        const b2 = c.board as number[][];
        const open = [0, 1, 2, 3, 4, 5, 6].filter((col) => b2[0][col] === 0);
        applyLocalMove(easy && open.length ? open[Math.floor(Math.random() * open.length)] : bestC4Move(b2, 2));
      } else {
        let mv = chessAiPick((c.board as { fen: string }).fen);
        if (easy) {
          const g2 = new Chess((c.board as { fen: string }).fen);
          const all = g2.moves({ verbose: true }) as Move[];
          if (all.length) mv = all[Math.floor(Math.random() * all.length)];
        }
        if (mv) applyLocalMove(mv);
      }
      const after = localRef.current;
      if (after?.winner !== null && after?.winner !== undefined) {
        announce(
          after.winner === 0
            ? "Game over. It's a draw."
            : after.winner === 1
              ? "Game over. You won! 🎉"
              : "Game over. The AI won.",
        );
        sound.play(after.winner === 1 ? "win" : after.winner === 0 ? "turn" : "lose");
      } else {
        announce("AI moved. Your turn!");
        sound.play("turn");
      }
      setBusy(false);
    }, 550);
  }

  async function find(vsAi: boolean) {
    // Guests have no server account — play offline vs AI instead.
    if (!player) {
      announce("Guest mode — starting an offline game against the AI.");
      startLocal("ai");
      return;
    }
    setBusy(true);
    setStage("searching");
    announce(vsAi ? "Starting a game against the AI." : "Finding an online opponent. Please wait.");
    prevRef.current = null;
    try {
      const res = await fetch("/api/match/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", game, vsAi }),
      });
      const data = await res.json();
      const m: Match = data.match;
      if (!m) {
        // Server/DB unavailable (e.g. no DATABASE_URL) — fall back to offline AI
        // so the game is ALWAYS playable.
        const msg = data.error || data.message || "Online matchmaking is unavailable right now.";
        announce(`${msg} Starting an offline game vs the AI instead.`);
        startLocal("ai");
        return;
      }
      const meYou: 1 | 2 = data.you === 2 ? 2 : 1;
      setMatch(m);
      setYou(meYou);
      youRef.current = meYou;
      prevRef.current = { turn: m.turn, status: m.status, winner: m.winner, p2: m.player2Id };
      if (m.status === "active") {
        setStage("playing");
        announce(vsAi ? "Game started! You play first against the AI." : `Matched with ${m.player2Name ?? "an opponent"}. Game on!`);
      } else {
        setStage("waiting");
        announce("You are in the queue. Waiting for an opponent to join.");
        startPoll(m.id);
      }
    } catch {
      announce("Could not reach the game server — starting an offline game vs the AI instead.");
      startLocal("ai");
    } finally {
      if (!localRef.current) setBusy(false);
    }
  }

  async function cancel() {
    stopPoll();
    if (match && stage === "waiting") {
      try {
        await fetch(`/api/match/${match.id}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
    }
    setMatch(null);
    setLocal(null);
    setStage("lobby");
  }

  async function makeMove(move: number | { from: string; to: string; promotion?: string }) {
    // Local offline match?
    if (localRef.current) {
      if (busy || localRef.current.winner !== null) return;
      if (localRef.current.mode === "ai" && localRef.current.turn !== 1) return;
      setBusy(true);
      const ok = applyLocalMove(move);
      setBusy(false);
      if (!ok) return;
      const after = localRef.current;
      if (after?.winner !== null && after?.winner !== undefined) {
        announce(
          after.winner === 0
            ? "Game over. It's a draw. 🤝"
            : after.winner === 1
              ? "Game over. You won! 🎉"
              : "Game over. Player 2 wins!",
        );
        sound.play(after.winner === 1 ? "win" : after.winner === 0 ? "turn" : "lose");
      } else if (after?.mode === "ai") {
        aiLocalReply();
      } else {
        announce(`Player ${after?.turn} — your move.`);
        sound.play("turn");
      }
      return;
    }
    if (!player || !match) return;
    if (match.turn !== you || match.status !== "active" || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/match/${match.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player?.code ?? "", move }),
      });
      const data = await res.json();
      if (data.match) {
        setMatch(data.match);
        const finished = data.match.status === "finished";
        sound.play(finished ? "turn" : "move");
        if (finished) {
          syncTalkback(data.match, you, "move");
          stopPoll();
          refresh();
        } else if (!match.vsAi) {
          announce("Move sent. Waiting for your opponent.");
          startPoll(match.id);
        } else {
          announce("AI replied. Your turn.");
        }
      } else if (data.error) {
        announce(`Move not accepted: ${data.error}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // Invite a specific friend by their Player ID (they get the match request
  // and can accept it — see /api/match/invites + InviteWatcher).
  const [inviteCode, setInviteCode] = useState("");
  async function inviteByCode() {
    if (!player || !inviteCode.trim()) return;
    setBusy(true);
    setStage("searching");
    announce(`Sending invite to ${inviteCode.trim().toUpperCase()}…`);
    try {
      const res = await fetch("/api/match/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: player.code, opponentCode: inviteCode.trim(), game }),
      });
      const data = await res.json();
      if (!res.ok || !data.match) throw new Error(data.error || "Invite failed");
      const m: Match = data.match;
      setMatch(m);
      setYou(1);
      youRef.current = 1;
      prevRef.current = { turn: m.turn, status: m.status, winner: m.winner, p2: m.player2Id };
      setStage("waiting");
      announce(`Invite sent to ${m.player2Name}. The match starts automatically when they accept.`);
      startPoll(m.id);
    } catch (e) {
      announce(e instanceof Error ? e.message : "Could not send invite.");
      setStage("lobby");
    } finally {
      setBusy(false);
    }
  }

  function playAgain() {
    setMatch(null);
    setLocal(null);
    setStage("lobby");
  }

  // ---- Lobby ----
  if (stage === "lobby") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h2 className="text-xl font-bold">Ready to play?</h2>
          <p className="mt-2 text-slate-400">
            Play a live player or challenge the AI.
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => find(false)}
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              🎲 Random match — online players
            </button>
            <div className="flex gap-2">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Friend&apos;s Player ID (6 chars)"
                maxLength={6}
                aria-label="Friend's Player ID to invite"
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono tracking-[0.2em] text-white outline-none focus:border-violet-500"
              />
              <button
                onClick={inviteByCode}
                disabled={busy || !inviteCode.trim() || !player}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                ✉️ Invite
              </button>
            </div>
            <button
              onClick={() => find(true)}
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              🤖 Play vs AI
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startLocal("ai")}
                className="rounded-2xl bg-slate-800 border-2 border-emerald-500/50 px-3 py-3 text-sm font-bold text-emerald-300 transition hover:bg-slate-700"
              >
                🤖 vs AI (offline — always works)
              </button>
              <button
                onClick={() => startLocal("pvp")}
                className="rounded-2xl bg-slate-800 border-2 border-violet-500/50 px-3 py-3 text-sm font-bold text-violet-300 transition hover:bg-slate-700"
              >
                👥 2 Players on this device
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            🎲 Random: you join the queue — when another player also picks Random for this game, your match starts automatically.
            ✉️ Invite: send a match request to a friend&apos;s Player ID; they accept it from the home screen.
            Online needs a login + the cloud database. Offline modes work for everyone, no account needed.
          </p>
        </div>
      </div>
    );
  }

  // ---- Searching / Waiting ----
  if (stage === "searching" || stage === "waiting") {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
          <h2 className="mt-6 text-xl font-bold">
            {match?.status === "invited" ? "Waiting for opponent…" : "Finding an opponent…"}
          </h2>
          <p className="mt-2 text-slate-400">
            {match?.status === "invited"
              ? `Invite sent to ${match.player2Name}. Game starts when they accept.`
              : "You'll start automatically when another player joins."}
          </p>
          <button
            onClick={cancel}
            className="mt-6 rounded-xl border border-slate-700 px-5 py-2 text-slate-300 transition hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---- Playing ----
  if (!match && !local) return null;
  const board = (local ? local.board : match!.board);
  const turn = local ? local.turn : match!.turn;
  const winner = local ? local.winner : match!.winner;
  const finished = local ? local.winner !== null : match!.status === "finished";
  const myTurn = local
    ? (local.mode === "pvp" || local.turn === you) && !finished
    : match!.turn === you && !finished;
  const oppName = local
    ? local.mode === "ai"
      ? "AI Bot 🤖"
      : "Player 2"
    : you === 1
      ? match!.player2Name
      : match!.player1Name;
  const meName = local
    ? local.mode === "ai"
      ? "You"
      : "Player 1"
    : you === 1
      ? match!.player1Name
      : match!.player2Name;

  let resultText = "";
  if (finished) {
    if (winner === 0) resultText = "It's a draw! 🤝";
    else if (local && local.mode === "pvp") resultText = winner === 1 ? "Player 1 wins! 🎉" : "Player 2 wins! 🎉";
    else if (winner === you) resultText = "You win! 🎉";
    else resultText = "You lost 😔";
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <Badge name={`${meName} (You)`} active={myTurn} color="text-sky-400" />
        <span className="text-xs text-slate-500">VS</span>
        <Badge name={oppName ?? "…"} active={!myTurn && !finished} color="text-rose-400" />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        {game === "tic-tac-toe" && (
          <TicTacToeBoard board={board as number[]} onMove={makeMove} disabled={!myTurn || busy} />
        )}
        {game === "connect-four" && (
          <ConnectFourBoard board={board as number[][]} onMove={makeMove} disabled={!myTurn || busy} />
        )}
        {game === "chess" && (
          <ChessMiniBoard
            fen={(board as { fen: string }).fen}
            you={you}
            onMove={makeMove}
            disabled={!myTurn || busy}
            aiOpponent={local ? local.mode === "ai" : !!match?.vsAi}
          />
        )}

        <div className="mt-5 text-center">
          {finished ? (
            <div className="space-y-3">
              <div className="text-2xl font-bold">{resultText}</div>
              <button
                onClick={playAgain}
                className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Play Again
              </button>
            </div>
          ) : (
            <div className="text-slate-400">
              {myTurn
                ? local?.mode === "pvp"
                  ? `Player ${turn} — make a move! (pass the device after your move)`
                  : "Your turn — make a move!"
                : `Waiting for ${oppName}…`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ name, active, color }: { name: string; active: boolean; color: string }) {
  return (
    <div className={`flex flex-col items-center ${active ? "" : "opacity-60"}`}>
      <span className={`font-semibold ${color}`}>{name}</span>
      {active && <span className="mt-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
    </div>
  );
}

function TicTacToeBoard({
  board,
  onMove,
  disabled,
}: {
  board: number[];
  onMove: (i: number) => void;
  disabled: boolean;
}) {
  const mark = (v: number) => (v === 1 ? "❌" : v === 2 ? "⭕" : "");
  return (
    <div className="mx-auto grid aspect-square w-full max-w-xs grid-cols-3 gap-2">
      {board.map((v, i) => (
        <button
          key={i}
          onClick={() => onMove(i)}
          disabled={disabled || v !== 0}
          className="grid place-items-center rounded-2xl bg-slate-800 text-4xl transition enabled:hover:bg-slate-700 disabled:cursor-default"
        >
          {mark(v)}
        </button>
      ))}
    </div>
  );
}

function ConnectFourBoard({
  board,
  onMove,
  disabled,
}: {
  board: number[][];
  onMove: (col: number) => void;
  disabled: boolean;
}) {
  const cols = board[0]?.length ?? 7;
  return (
    <div className="rounded-2xl bg-blue-900 p-2">
      <div className="mb-1 grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <button
            key={c}
            onClick={() => onMove(c)}
            disabled={disabled || board[0][c] !== 0}
            className="py-1 text-center text-xs text-blue-200 transition enabled:hover:text-white disabled:opacity-30"
          >
            ▼
          </button>
        ))}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {board.flatMap((row, r) =>
          row.map((v, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => onMove(c)}
              disabled={disabled || board[0][c] !== 0}
              className="grid aspect-square place-items-center rounded-full bg-blue-950 transition enabled:hover:bg-blue-800"
            >
              <span
                className={`h-[80%] w-[80%] rounded-full ${
                  v === 1 ? "bg-red-500" : v === 2 ? "bg-yellow-400" : "bg-blue-800/40"
                }`}
              />
            </button>
          )),
        )}
      </div>
    </div>
  );
}

const PIECE_NAMES: Record<string, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};

// Friendly AI chatter (spoken in the game voice between moves).
const AI_CHATTER = [
  "Nice move!",
  "Wow, you are playing nice!",
  "Hmm, interesting. My turn.",
  "Watch out — I'm thinking!",
  "Good one. Let's see this!",
  "You're tricky!",
];

const GLYPH: Record<string, string> = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕", wk: "♔",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛", bk: "♚",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function ChessMiniBoard({
  fen,
  you,
  onMove,
  disabled,
  aiOpponent,
}: {
  fen: string;
  you: 1 | 2;
  onMove: (m: { from: string; to: string; promotion?: string }) => void;
  disabled: boolean;
  aiOpponent: boolean;
}) {
  const g = new Chess(fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [cursor, setCursor] = useState<Square>("e4"); // gesture/keyboard scan position
  const [pieceType, setPieceType] = useState<string | null>(null); // easy-move panel
  const myColor = you === 1 ? "w" : "b";
  const targets: Square[] = selected
    ? (g.moves({ square: selected, verbose: true }) as Move[]).map((m) => m.to as Square)
    : [];

  useEffect(() => {
    setSelected(null);
    setPieceType(null);
  }, [fen]);

  // Announce every move (yours and the opponent's/AI's), captures, check and
  // checkmate — spoken in the game voice + shown as a caption, no system
  // TalkBack needed.
  const prevFen = useRef<string | null>(null);
  useEffect(() => {
    if (prevFen.current === fen) return;
    const first = prevFen.current === null;
    prevFen.current = fen;
    if (first) return;
    const gg = new Chess(fen);
    const hist = gg.history({ verbose: true }) as Move[];
    const last = hist[hist.length - 1];
    if (last) {
      const who = last.color === myColor ? "You" : aiOpponent ? "AI" : "Opponent";
      const pieceName = PIECE_NAMES[last.piece] ?? last.piece;
      const cap = last.captured
        ? `, capturing the ${last.color === "w" ? "black" : "white"} ${PIECE_NAMES[last.captured] ?? "piece"}!`
        : "";
      announce(
        `${who} moved ${last.color === "w" ? "white" : "black"} ${pieceName} from ${last.from.toUpperCase()} to ${last.to.toUpperCase()}${cap}.`,
      );
      // ChessMiniBoard is chess-only: real wood capture / piece-move recordings.
      sound.play(last.captured ? "chess_capture" : "chess_piece_move");
      if (last.color !== myColor && aiOpponent && Math.random() < 0.45) {
        const line = AI_CHATTER[Math.floor(Math.random() * AI_CHATTER.length)];
        setTimeout(() => announce(line), 1000);
      }
    }
    if (gg.isCheckmate()) {
      const iWon = gg.turn() !== myColor; // side to move is checkmated
      announce(iWon ? "Checkmate! You win! 🏆" : "Checkmate! The AI wins. Can you escape next time? 😔");
      sound.play(iWon ? "win" : "lose");
    } else if (gg.isCheck()) {
      announce(gg.turn() === myColor ? "Check! Your king is under attack!" : "Check! You attacked the king!");
      sound.play("turn");
    } else if (gg.isStalemate() || gg.isDraw()) {
      announce("Game over — it's a draw. 🤝");
      sound.play("turn");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  function describeSquare(sq: Square): string {
    const piece = g.get(sq);
    const base = piece
      ? `${piece.color === "w" ? "White" : "Black"} ${PIECE_NAMES[piece.type] ?? piece.type} on ${sq}`
      : `Empty ${sq}`;
    const marks: string[] = [];
    if (selected === sq) marks.push("selected");
    if (targets.includes(sq)) marks.push("legal destination");
    return marks.length ? `${base}, ${marks.join(", ")}` : base;
  }

  function tap(sq: Square) {
    if (disabled || g.turn() !== myColor) return;
    if (selected && targets.includes(sq)) {
      sound.play("select");
      onMove({ from: selected, to: sq, promotion: "q" });
      setSelected(null);
      return;
    }
    const piece = g.get(sq);
    if (piece && piece.color === myColor) {
      setSelected(sq);
      sound.play("select");
      const moves = (g.moves({ square: sq, verbose: true }) as Move[]).map((m) => m.to as Square);
      announce(
        `Selected ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type] ?? piece.type} on ${sq}. ` +
          (moves.length
            ? `Legal destinations: ${moves.join(", ")}. Tap a destination to move.`
            : "No legal moves for this piece."),
      );
    } else {
      setSelected(null);
      if (piece) announce(describeSquare(sq));
    }
  }

  function scanCursor(dFile: number, dRank: number) {
    const file = cursor.charCodeAt(0) - 97; // a..h → 0..7
    const rank = Number(cursor[1]); // 1..8
    const nf = Math.min(7, Math.max(0, file + dFile));
    const nr = Math.min(8, Math.max(1, rank + dRank));
    const sq = (String.fromCharCode(97 + nf) + nr) as Square;
    setCursor(sq);
    sound.play("click");
    announce(describeSquare(sq));
  }

  // Game-specific gestures for chess: swipes scan the board square-by-square
  // (accessible alternative to precise tapping), long-press announces the
  // square under the finger. Tap select/move is handled by the square buttons
  // themselves in BOTH TalkBack and non-TalkBack modes. All of these only
  // affect the chessboard — never the world.
  useGameGestureHandlers("chess", {
    "swipe-left": () => scanCursor(-1, 0),
    "swipe-right": () => scanCursor(1, 0),
    "swipe-up": () => scanCursor(0, -1),
    "swipe-down": () => scanCursor(0, 1),
    "long-press": () => announce(describeSquare(cursor)),
  });

  const rows = g.board();
  // Orient board: white at bottom for player 1, flipped for player 2.
  const rowOrder = you === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const colOrder = you === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div>
    <div
      data-gesture-lock="all"
      className="grid aspect-square w-full overflow-hidden rounded-xl border-4 border-amber-900 shadow-2xl"
      style={{ gridTemplateColumns: "repeat(8, 1fr)" }}
      role="grid"
      aria-label="Chess board. Tap a piece to select, tap a legal square to move. Swipe to scan squares, long-press for details."
    >
      {rowOrder.map((r) =>
        colOrder.map((c) => {
          const cell = rows[r][c];
          const sq = (FILES[c] + (8 - r)) as Square;
          const dark = (r + c) % 2 === 1;
          const isSel = selected === sq;
          const isTarget = targets.includes(sq);
          const isCursor = cursor === sq;
          return (
            <button
              key={sq}
              onClick={() => tap(sq)}
              role="gridcell"
              aria-label={`${describeSquare(sq)}${isCursor ? ", scan cursor here" : ""}`}
              className={`relative grid place-items-center ${
                dark ? "bg-amber-800" : "bg-amber-100"
              } ${isSel ? "ring-4 ring-inset ring-sky-400" : ""} ${
                isCursor && !isSel ? "ring-2 ring-inset ring-emerald-400" : ""
              }`}
            >
              {isTarget && (
                <span
                  className={`absolute rounded-full ${
                    cell ? "inset-1 border-4 border-sky-500/70" : "h-1/3 w-1/3 bg-sky-500/60"
                  }`}
                />
              )}
              {cell && (
                <span
                  className={`relative z-10 text-[clamp(1.4rem,7vw,2.4rem)] leading-none ${
                    cell.color === "w" ? "text-white" : "text-slate-900"
                  }`}
                  style={{ textShadow: cell.color === "w" ? "0 1px 2px rgba(0,0,0,.6)" : "none" }}
                >
                  {GLYPH[cell.color + cell.type]}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>

      {/* Easy move panel: piece buttons (Pawn/Knight/...) → destination options
          like "E2 → E4" — designed for game TalkBack, no precise square tapping. */}
      {!disabled && g.turn() === myColor && (() => {
        const mine = (g.moves({ verbose: true }) as Move[]).filter((m) => m.color === myColor);
        const byType: Record<string, Move[]> = {};
        for (const m of mine) {
          (byType[m.piece] = byType[m.piece] ?? []).push(m);
        }
        const types = Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length);
        if (!types.length) return null;
        return (
          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
            <div className="mb-2 text-xs font-bold text-slate-300">
              🎯 Easy moves — {pieceType ? `pick a destination for your ${PIECE_NAMES[pieceType]}` : "pick a piece, then a destination (from → to)"}
            </div>
            {pieceType === null ? (
              <div className="grid grid-cols-3 gap-2">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setPieceType(t);
                      sound.play("select");
                      const opts = byType[t].map((m) => `${m.from.toUpperCase()} to ${m.to.toUpperCase()}`).join(", ");
                      announce(`${byType[t].length} ${PIECE_NAMES[t]} moves: ${opts}`);
                    }}
                    aria-label={`${PIECE_NAMES[t]}, ${byType[t].length} moves available`}
                    className="rounded-xl bg-slate-800 px-2 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                  >
                    <span className="text-xl">{GLYPH[myColor + t]}</span>
                    <span className="block text-[11px] capitalize">{PIECE_NAMES[t]} ×{byType[t].length}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setPieceType(null)}
                  className="mb-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  ← All pieces
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {byType[pieceType].map((m) => (
                    <button
                      key={m.from + m.to + (m.promotion ?? "")}
                      onClick={() => {
                        setPieceType(null);
                        sound.play("select");
                        onMove({ from: m.from, to: m.to, promotion: "q" });
                      }}
                      aria-label={`${m.captured ? "Capture" : "Move"} ${PIECE_NAMES[pieceType]} from ${m.from.toUpperCase()} to ${m.to.toUpperCase()}${m.captured ? `, capturing ${PIECE_NAMES[m.captured]}` : ""}`}
                      className={`rounded-xl px-3 py-3 text-sm font-bold transition ${
                        m.captured
                          ? "bg-rose-600 text-white hover:bg-rose-500"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {m.from.toUpperCase()} → {m.to.toUpperCase()}
                      {m.captured && (
                        <span className="block text-[10px]">capture {PIECE_NAMES[m.captured] ?? ""}!</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
