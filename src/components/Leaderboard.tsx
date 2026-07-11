"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";

type Row = { id: number; playerName: string; score: number };

export default function Leaderboard({ game, label }: { game: string; label: string }) {
  const { player } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/scores?game=${encodeURIComponent(game)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setRows(d.leaderboard ?? []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [game]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-lg font-bold">🏆 Leaderboard — {label}</h3>
      {loading ? (
        <p className="mt-4 text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-slate-500">No scores yet. Be the first!</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                player && (r.playerName === (player?.name ?? "Guest")) ? "bg-sky-500/10" : "bg-slate-800/50"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="w-6 text-center font-black text-slate-500">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span className="font-medium">{r.playerName}</span>
              </span>
              <span className="font-black text-emerald-400">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
