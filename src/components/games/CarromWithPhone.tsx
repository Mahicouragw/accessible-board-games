"use client";

import { useState, useEffect } from "react";
import Carrom from "./Carrom";
import FourPlayerPhoneInvite, { FourPhonePlayer } from "../FourPlayerPhoneInvite";
import PhonePlayerSelector, { PhonePlayer } from "../PhonePlayerSelector";
import { sound } from "@/lib/sound";

export default function CarromWithPhone() {
  const [phonePlayers, setPhonePlayers] = useState<PhonePlayer[]>([]);
  const [fourPlayers, setFourPlayers] = useState<FourPhonePlayer[]>([]);
  const [currentPhonePlayer, setCurrentPhonePlayer] = useState<PhonePlayer | null>(null);
  const [showFourPlayer, setShowFourPlayer] = useState(true);
  const [gameMode, setGameMode] = useState<"single" | "four-phone" | "online">("single");

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
          🎮 Single vs AI
        </button>
        <button
          onClick={() => setGameMode("four-phone")}
          className={`rounded-xl px-4 py-2 text-sm font-bold border-2 ${gameMode === "four-phone" ? "bg-amber-600 border-amber-400 text-white" : "bg-slate-800 border-slate-700 text-amber-400"} animate-pulse`}
        >
          📱 4 Phones + 4 Colours + Invite
        </button>
        <button
          onClick={() => setGameMode("online")}
          className={`rounded-xl px-4 py-2 text-sm font-bold border-2 ${gameMode === "online" ? "bg-sky-600 border-sky-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}
        >
          🌐 Online
        </button>
      </div>

      {gameMode === "four-phone" && (
        <FourPlayerPhoneInvite
          game="carrom"
          onPlayersReady={(players) => {
            setFourPlayers(players);
            const converted: PhonePlayer[] = players.map(p => ({
              id: p.id,
              name: p.name,
              phone: p.phone,
              avatar: p.avatar,
              color: p.color,
            }));
            setPhonePlayers(converted);
            if (converted.length > 0) setCurrentPhonePlayer(converted[0]);
          }}
        />
      )}

      {gameMode === "online" && fourPlayers.length > 0 && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center">
          <div className="text-sm font-bold text-sky-400">🌐 Online Carrom — Invite via Phone</div>
          <div className="mt-2 flex flex-wrap gap-2 justify-center">
            {fourPlayers.filter(p => p.phone).map(p => (
              <a
                key={p.id}
                href={`sms:${p.phone}?body=Join Carrom Board! Room: ${p.color} - https://accessible-board-games.vercel.app/play/carrom`}
                className="rounded-full bg-sky-500/20 border border-sky-500/50 px-3 py-1 text-xs text-sky-300"
              >
                📱 Invite {p.name} ({p.color}) via SMS
              </a>
            ))}
          </div>
        </div>
      )}

      {gameMode === "four-phone" && fourPlayers.length === 4 && (
        <div className="rounded-2xl border-2 border-white bg-gradient-to-r from-amber-900/50 to-red-900/50 p-3 text-center">
          <div className="font-black text-white">🎉  4-Player Carrom Ready! Each Chooses One Colour!</div>
          <div className="mt-1 flex justify-center gap-2 flex-wrap">
            {fourPlayers.map(p => (
              <span key={p.id} className="text-xs px-2 py-1 rounded-full bg-slate-800 border text-white">
                {p.name} {p.phone.slice(-4)} - {p.color} {p.status === "joined" ? "✓" : p.status === "invited" ? "📤" : "⏳"}
              </span>
            ))}
          </div>
          <div className="text-xs text-amber-300 mt-1">4 phone numbers, 4 colours (Red, Green, Yellow, Blue) — Carrom striker for each, switch turns, realistic strike sounds!</div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
        <Carrom />
      </div>

      <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-3">
        <div className="text-xs font-bold text-slate-300 mb-2">🔊 Realistic Sounds for Carrom + 4-Phone Multiplayer:</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div>🎯 Striker - Wooden flick + slide</div>
          <div>💥 Pocket - Capture pop</div>
          <div>📱 Phone Invite - SMS/WhatsApp</div>
          <div>🔄 Colour Choose - Red/Green/Yellow/Blue</div>
          <div>🎉 Win - Fanfare</div>
          <div>👥 4 Players - Each phone picks colour, joins, switches</div>
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          <button onClick={() => sound.play("carrom_strike")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Strike 🔊</button>
          <button onClick={() => sound.play("pocket")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Pocket 🔊</button>
          <button onClick={() => sound.play("win")} className="rounded-lg bg-slate-700 px-2 py-1 text-xs">Win 🔊</button>
          <button onClick={() => sound.setMusic(!sound.settings.music)} className="rounded-lg bg-violet-600 px-2 py-1 text-xs text-white">Music 🎵 {sound.settings.music ? "On" : "Off"}</button>
        </div>
      </div>
    </div>
  );
}
