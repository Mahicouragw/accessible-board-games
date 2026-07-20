"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type Move } from "chess.js";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

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

  async function find(vsAi: boolean) {
    if (!player) return;
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
        const msg = data.error || data.message || "Online matchmaking is unavailable right now.";
        announce(msg);
        setStage("lobby");
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
      announce("Could not reach the game server. Check your internet and try again.");
      setStage("lobby");
    } finally {
      setBusy(false);
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
    setStage("lobby");
  }

  async function makeMove(move: number | { from: string; to: string; promotion?: string }) {
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

  function playAgain() {
    setMatch(null);
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
              🌐 Play with Players (Online)
            </button>
            <button
              onClick={() => find(true)}
              disabled={busy}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-4 text-lg font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              🤖 Play vs AI
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Tip: from the Arcade home you can also tap an online player to invite them directly.
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
  if (!match) return null;
  const finished = match.status === "finished";
  const myTurn = match.turn === you && !finished;
  const oppName = you === 1 ? match.player2Name : match.player1Name;
  const meName = you === 1 ? match.player1Name : match.player2Name;

  let resultText = "";
  if (finished) {
    if (match.winner === 0) resultText = "It's a draw! 🤝";
    else if (match.winner === you) resultText = "You win! 🎉";
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
          <TicTacToeBoard board={match.board as number[]} onMove={makeMove} disabled={!myTurn || busy} />
        )}
        {game === "connect-four" && (
          <ConnectFourBoard board={match.board as number[][]} onMove={makeMove} disabled={!myTurn || busy} />
        )}
        {game === "chess" && (
          <ChessMiniBoard
            fen={(match.board as { fen: string }).fen}
            you={you}
            onMove={makeMove}
            disabled={!myTurn || busy}
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
              {myTurn ? "Your turn — make a move!" : `Waiting for ${oppName}…`}
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
}: {
  fen: string;
  you: 1 | 2;
  onMove: (m: { from: string; to: string; promotion?: string }) => void;
  disabled: boolean;
}) {
  const g = new Chess(fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const myColor = you === 1 ? "w" : "b";
  const targets: Square[] = selected
    ? (g.moves({ square: selected, verbose: true }) as Move[]).map((m) => m.to as Square)
    : [];

  useEffect(() => {
    setSelected(null);
  }, [fen]);

  function tap(sq: Square) {
    if (disabled || g.turn() !== myColor) return;
    if (selected && targets.includes(sq)) {
      sound.play("select");
      onMove({ from: selected, to: sq, promotion: "q" });
      setSelected(null);
      announce(`Moved to ${sq}`);
      return;
    }
    const piece = g.get(sq);
    if (piece && piece.color === myColor) {
      setSelected(sq);
      sound.play("select");
    } else {
      setSelected(null);
    }
  }

  const rows = g.board();
  // Orient board: white at bottom for player 1, flipped for player 2.
  const rowOrder = you === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const colOrder = you === 1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div
      className="grid aspect-square w-full overflow-hidden rounded-xl border-4 border-amber-900 shadow-2xl"
      style={{ gridTemplateColumns: "repeat(8, 1fr)" }}
      role="grid"
      aria-label="Chess board"
    >
      {rowOrder.map((r) =>
        colOrder.map((c) => {
          const cell = rows[r][c];
          const sq = (FILES[c] + (8 - r)) as Square;
          const dark = (r + c) % 2 === 1;
          const isSel = selected === sq;
          const isTarget = targets.includes(sq);
          return (
            <button
              key={sq}
              onClick={() => tap(sq)}
              role="gridcell"
              aria-label={
                cell
                  ? `${cell.color === "w" ? "White" : "Black"} ${cell.type} on ${sq}`
                  : `empty ${sq}`
              }
              className={`relative grid place-items-center ${
                dark ? "bg-amber-800" : "bg-amber-100"
              } ${isSel ? "ring-4 ring-inset ring-sky-400" : ""}`}
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
  );
}
