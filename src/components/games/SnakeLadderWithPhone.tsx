"use client";

import { useState, useEffect } from "react";
import SnakeLadder from "./SnakeLadder";
import PhonePlayerSelector, { PhonePlayer } from "../PhonePlayerSelector";
import { sound } from "@/lib/sound";

export default function SnakeLadderWithPhone() {
  const [phonePlayers, setPhonePlayers] = useState<PhonePlayer[]>([]);
  const [currentPhonePlayer, setCurrentPhonePlayer] = useState<PhonePlayer | null>(null);
  const [showPhoneSelector, setShowPhoneSelector] = useState(true);
  const [gameMode, setGameMode] = useState<"single" | "local-multi" | "online">("single");

  useEffect(() => {
    sound.play("select");
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={() => setGameMode("single")}
          className={`rounded-xl px-4 py-2 text-sm font-bold border-2 ${gameMode === "single" ? "bg-violet-600 border-violet-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
        >
          🎮 Single Player
        </button>
        <button
          onClick={() => setGameMode("local-multi")}
          className={`rounded-xl px-4 py-2 text-sm font-bold border-2 ${gameMode === "local-multi" ? "bg-emerald-600 border-emerald-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
        >
          📱 Local Multi (Phone)
        </button>
        <button
          onClick={() => setGameMode("online")}
          className={`rounded-xl px-4 py-2 text-sm font-bold border-2 ${gameMode === "online" ? "bg-sky-600 border-sky-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
        >
          🌐 Online
        </button>
      </div>

      {gameMode !== "single" && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowPhoneSelector(!showPhoneSelector)}
            className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs text-slate-300"
          >
            {showPhoneSelector ? "Hide" : "Show"} Phone Players 📱 {phonePlayers.length > 0 && `(${phonePlayers.length})`}
          </button>
        </div>
      )}

      {showPhoneSelector && gameMode !== "single" && (
        <PhonePlayerSelector
          game="snake-ladder"
          maxPlayers={4}
          onPlayersChange={setPhonePlayers}
          onCurrentPlayerChange={setCurrentPhonePlayer}
        />
      )}

      {gameMode === "local-multi" && phonePlayers.length > 0 && currentPhonePlayer && (
        <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 p-3 text-center">
          <div className="text-sm font-bold text-emerald-400">
            🎯 Current: {currentPhonePlayer.name} ({currentPhonePlayer.color}) {currentPhonePlayer.phone && `📱 ${currentPhonePlayer.phone}`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Switch turns to play Snake & Ladder with friends on same device via phone numbers! Realistic ladder climb & snake bite sounds!
          </div>
        </div>
      )}

      {gameMode === "online" && phonePlayers.length > 0 && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center">
          <div className="text-sm font-bold text-sky-400">🌐 Online Invite via Phone</div>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {phonePlayers.filter(p => p.phone).map(p => (
              <a
                key={p.id}
                href={`sms:${p.phone}?body=Join Snake Ladder! https://accessible-board-games.vercel.app/play/snake-ladder`}
                className="rounded-full bg-sky-500/20 border border-sky-500/50 px-3 py-1 text-xs text-sky-300"
              >
                📱 Invite {p.name} via SMS
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
        <SnakeLadder />
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3">
        <div className="text-xs font-bold text-slate-300 mb-2">🔊 Realistic Sounds for Snake Ladder:</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div>🎲 Dice Roll - Shaking cup</div>
          <div>🪜 Ladder - Ascending harp glissando</div>
          <div>🐍 Snake Bite - Hiss + slide down</div>
          <div>🪵 Token Move - Wooden tap</div>
          <div>🎉 Win - Fanfare</div>
          <div>📱 Switch - Turn + vibration</div>
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <button onClick={() => sound.play("dice")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Dice 🔊</button>
          <button onClick={() => sound.play("ladder")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Ladder 🔊</button>
          <button onClick={() => sound.play("snake")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Snake 🔊</button>
          <button onClick={() => sound.setMusic(!sound.settings.music)} className="rounded-lg bg-violet-600 px-2 py-1 text-xs text-white">Music 🎵 {sound.settings.music ? "On" : "Off"}</button>
        </div>
      </div>
    </div>
  );
}
