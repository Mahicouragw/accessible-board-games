"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { getGame } from "@/lib/games";
import OnlineMatch from "@/components/games/OnlineMatch";
import RockPaperScissors from "@/components/games/RockPaperScissors";
import Memory from "@/components/games/Memory";
import Game2048 from "@/components/games/Game2048";
import Snake from "@/components/games/Snake";
import Ludo from "@/components/games/Ludo";
import SnakeLadder from "@/components/games/SnakeLadder";
import Carrom from "@/components/games/Carrom";
import Leaderboard from "@/components/Leaderboard";

export default function PlayPage({ params }: { params: { game: string } }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <div className="animate-pulse text-4xl">🎮</div>
        </div>
      }
    >
      <PlayPageInner params={params} />
    </Suspense>
  );
}

function PlayPageInner({ params }: { params: { game: string } }) {
  const { game } = params;
  const { player, loading } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchParam = searchParams.get("match");
  const initialMatchId = matchParam ? Number(matchParam) : undefined;
  const info = getGame(game);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse text-4xl">🎮</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-slate-400">You need to log in to play.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-slate-400">Game not found.</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950">
            Back to Arcade
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          ← Arcade
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{info.emoji}</span>
          {info.name}
        </h1>
        <span className="font-mono text-xs text-emerald-400">ID: {player?.code ?? "GUEST"}</span>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {game === "tic-tac-toe" && (
            <OnlineMatch game="tic-tac-toe" initialMatchId={initialMatchId} />
          )}
          {game === "connect-four" && (
            <OnlineMatch game="connect-four" initialMatchId={initialMatchId} />
          )}
          {game === "chess" && <OnlineMatch game="chess" initialMatchId={initialMatchId} />}
          {game === "rock-paper-scissors" && <RockPaperScissors />}
          {game === "memory" && <Memory />}
          {game === "2048" && <Game2048 />}
          {game === "snake" && <Snake />}
          {game === "ludo" && <Ludo />}
          {game === "snake-ladder" && <SnakeLadder />}
          {game === "carrom" && <Carrom />}
        </div>
        <aside className="space-y-4">
          {!info.online && <Leaderboard game={game} label={info.scoreLabel} />}
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-bold">Your Stats</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Wins" value={player?.wins ?? 0} />
              <Stat label="Losses" value={player?.losses ?? 0} />
              <Stat label="Draws" value={player?.draws ?? 0} />
              <Stat label="XP" value={player?.xp ?? 0} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-3 text-center">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
    </div>
  );
}
