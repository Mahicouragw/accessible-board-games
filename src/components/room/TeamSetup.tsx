"use client";

// 🏟️ Teams & Captains — for rooms with 4 or 8 players (e.g. Hand Cricket):
// the room HOST assigns each player to Team A / Team B, picks each team's
// COUNTRY (India, Pakistan, …) and CAPTAIN; each captain then picks their
// STRIKER and BOWLER. Stored in room.meta.teams and shared live with everyone.

import { useMemo, useState } from "react";
import type { RoomMember } from "@/db/schema";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";

export const COUNTRIES = [
  "🇮🇳 India",
  "🇵🇰 Pakistan",
  "🇦🇺 Australia",
  "🏴 England",
  "🇿🇦 South Africa",
  "🇱🇰 Sri Lanka",
  "🏝️ West Indies",
  "🇳🇿 New Zealand",
] as const;

export type Team = {
  country: string;
  captainId: number | null;
  strikerId: number | null;
  bowlerId: number | null;
  playerIds: number[];
};

export function defaultTeams(players: RoomMember[]): [Team, Team] {
  const ids = players.map((p) => Number(p.id));
  return [
    { country: "🇮🇳 India", captainId: ids[0] ?? null, strikerId: ids[0] ?? null, bowlerId: ids[1] ?? null, playerIds: ids.filter((_, i) => i % 2 === 0) },
    { country: "🇵🇰 Pakistan", captainId: ids[1] ?? null, strikerId: ids[1] ?? null, bowlerId: ids[0] ?? null, playerIds: ids.filter((_, i) => i % 2 === 1) },
  ];
}

export function teamsFromMeta(meta: any, players: RoomMember[]): [Team, Team] {
  if (Array.isArray(meta?.teams) && meta.teams.length === 2) return meta.teams as [Team, Team];
  return defaultTeams(players);
}

export default function TeamSetup({
  roomId,
  hostId,
  members,
  meta,
  meId,
  myCode,
}: {
  roomId: number;
  hostId: number;
  members: RoomMember[];
  meta: any;
  meId: number | null;
  myCode: string;
}) {
  const players = members.filter((m) => m.role === "player");
  const [teams, setTeams] = useState<[Team, Team]>(() => teamsFromMeta(meta, players));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const isHost = Number(hostId) === Number(meId);
  const myTeamIdx = useMemo(() => teams.findIndex((t) => Number(t.captainId) === Number(meId)), [teams, meId]);
  const isCaptain = myTeamIdx >= 0;

  // keep local copy in sync when the room poll refreshes (if user hasn't edited)
  const syncFromMeta = () => setTeams(teamsFromMeta(meta, players));

  async function save(next: [Team, Team]) {
    setSaving(true);
    setMsg("");
    sound.play("click");
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: myCode, meta: { ...(meta ?? {}), teams: next } }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `failed (${res.status})`);
      setTeams(next);
      setMsg("✅ Teams saved — everyone in the room sees this live.");
      announce("Teams and captains saved.");
      sound.play("select");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? e}`);
      announce(`Could not save teams: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  const setTeam = (i: 0 | 1, patch: Partial<Team>) => {
    const next: [Team, Team] = [i === 0 ? { ...teams[0], ...patch } : teams[0], i === 1 ? { ...teams[1], ...patch } : teams[1]];
    setTeams(next);
  };

  const nameOf = (id: number | null) => players.find((p) => Number(p.id) === Number(id))?.name ?? "—";

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6" aria-label="Teams and captains">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">🏟️ Teams & Captains</h2>
        <div className="flex gap-2">
          <button onClick={syncFromMeta} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            ↺ Reload
          </button>
          {(isHost || isCaptain) && (
            <button
              onClick={() => save(teams)}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "💾 Save teams"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {isHost
          ? "You created this room — assign players to teams, pick each team's country and captain. Captains then choose their striker and bowler."
          : isCaptain
            ? "You are the captain of your team — choose your striker and bowler."
            : "The room host sets the teams, countries and captains."}
      </p>
      {msg && <p className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-xs text-emerald-300" role="status">{msg}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {teams.map((t, i) => (
          <div key={i} className={`rounded-2xl border p-4 ${i === 0 ? "border-sky-700/50 bg-sky-500/5" : "border-rose-700/50 bg-rose-500/5"}`}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-black">Team {i === 0 ? "A" : "B"}</div>
              {Number(t.captainId) === Number(meId) && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">⭐ You are captain</span>
              )}
            </div>

            <label className="mt-3 block text-xs font-semibold text-slate-400">
              🌍 Country
              <select
                value={t.country}
                disabled={!isHost}
                onChange={(e) => setTeam(i as 0 | 1, { country: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white disabled:opacity-60"
                aria-label={`Team ${i === 0 ? "A" : "B"} country`}
              >
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-xs font-semibold text-slate-400">
              👑 Captain
              <select
                value={t.captainId ?? ""}
                disabled={!isHost}
                onChange={(e) => setTeam(i as 0 | 1, { captainId: Number(e.target.value) || null })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white disabled:opacity-60"
                aria-label={`Team ${i === 0 ? "A" : "B"} captain`}
              >
                <option value="">— choose captain —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                ))}
              </select>
            </label>

            {isHost && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-slate-400">👥 Players in this team</div>
                <div className="flex flex-wrap gap-1.5">
                  {players.map((p) => {
                    const inTeam = t.playerIds.includes(Number(p.id));
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          const other = teams[1 - i];
                          const pid = Number(p.id);
                          const nextTeams: [Team, Team] = [teams[0], teams[1]];
                          nextTeams[i] = { ...nextTeams[i], playerIds: inTeam ? nextTeams[i].playerIds.filter((x) => x !== pid) : [...nextTeams[i].playerIds, pid] };
                          nextTeams[1 - i] = { ...other, playerIds: other.playerIds.filter((x) => x !== pid) };
                          setTeams(nextTeams);
                        }}
                        aria-pressed={inTeam}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${inTeam ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50" : "bg-slate-800 text-slate-400 border border-slate-700"}`}
                      >
                        {p.avatar} {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(isCaptain && myTeamIdx === i) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-slate-400">
                  🏏 Striker
                  <select
                    value={t.strikerId ?? ""}
                    onChange={(e) => setTeam(i as 0 | 1, { strikerId: Number(e.target.value) || null })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white"
                    aria-label="Choose striker"
                  >
                    <option value="">—</option>
                    {(t.playerIds.length ? players.filter((p) => t.playerIds.includes(Number(p.id))) : players).map((p) => (
                      <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-400">
                  ⚾ Bowler
                  <select
                    value={t.bowlerId ?? ""}
                    onChange={(e) => setTeam(i as 0 | 1, { bowlerId: Number(e.target.value) || null })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-white"
                    aria-label="Choose bowler"
                  >
                    <option value="">—</option>
                    {(t.playerIds.length ? players.filter((p) => t.playerIds.includes(Number(p.id))) : players).map((p) => (
                      <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-3 text-xs text-slate-400">
              Squad: {t.playerIds.length ? t.playerIds.map(nameOf).join(", ") : "—"} · Striker: {nameOf(t.strikerId)} · Bowler: {nameOf(t.bowlerId)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
