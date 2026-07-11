"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";

export type PhonePlayer = {
  id: number;
  name: string;
  phone?: string;
  avatar: string;
  color: string;
};

const COLORS = [
  { id: "red", name: "Red", hex: "#ef4444", emoji: "🔴" },
  { id: "green", name: "Green", hex: "#22c55e", emoji: "🟢" },
  { id: "yellow", name: "Yellow", hex: "#eab308", emoji: "🟡" },
  { id: "blue", name: "Blue", hex: "#3b82f6", emoji: "🔵" },
];

const AVATARS = ["🦊", "🐼", "🦁", "🐸", "🐵", "🐯", "🦄", "🐙", "🐳", "🦉"];

type Props = {
  game: string;
  maxPlayers?: number;
  onPlayersChange: (players: PhonePlayer[]) => void;
  onCurrentPlayerChange: (player: PhonePlayer) => void;
  currentTurn?: string;
};

export default function PhonePlayerSelector({ game, maxPlayers = 4, onPlayersChange, onCurrentPlayerChange, currentTurn }: Props) {
  const [players, setPlayers] = useState<PhonePlayer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].id);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem(`phone-players-${game}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setPlayers(parsed);
          onPlayersChange(parsed);
          if (parsed[0]) onCurrentPlayerChange(parsed[0]);
        }
      } catch {}
    } else {
      // Add default guest player
      const guest: PhonePlayer = {
        id: 1,
        name: "Guest Player",
        phone: "",
        avatar: "🎮",
        color: "red",
      };
      setPlayers([guest]);
      onPlayersChange([guest]);
      onCurrentPlayerChange(guest);
    }
  }, []);

  useEffect(() => {
    if (players.length > 0) {
      localStorage.setItem(`phone-players-${game}`, JSON.stringify(players));
    }
  }, [players, game]);

  useEffect(() => {
    if (currentTurn) {
      const idx = players.findIndex(p => p.color === currentTurn);
      if (idx >= 0) setCurrentPlayerIndex(idx);
    }
  }, [currentTurn, players]);

  const addPlayer = () => {
    if (!name.trim()) {
      sound.play("lose");
      return;
    }
    if (players.length >= maxPlayers) {
      sound.play("lose");
      return;
    }
    if (players.some(p => p.color === selectedColor)) {
      sound.play("lose");
      alert(`Color ${selectedColor} already taken! Choose another color.`);
      return;
    }

    const newPlayer: PhonePlayer = {
      id: Date.now(),
      name: name.trim().slice(0, 20),
      phone: phone.trim().slice(0, 15),
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      color: selectedColor,
    };

    const updated = [...players, newPlayer];
    setPlayers(updated);
    onPlayersChange(updated);
    setName("");
    setPhone("");
    // Auto select next available color
    const nextColor = COLORS.find(c => !updated.some(p => p.color === c.id));
    if (nextColor) setSelectedColor(nextColor.id);
    sound.play("win");
  };

  const removePlayer = (id: number) => {
    if (players.length <= 1) {
      alert("Need at least 1 player!");
      return;
    }
    const updated = players.filter(p => p.id !== id);
    setPlayers(updated);
    onPlayersChange(updated);
    sound.play("capture");
  };

  const switchPlayer = (index: number) => {
    setCurrentPlayerIndex(index);
    onCurrentPlayerChange(players[index]);
    sound.play("turn");
    // Haptic feedback
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(50);
    }
  };

  const switchToNext = () => {
    const nextIdx = (currentPlayerIndex + 1) % players.length;
    switchPlayer(nextIdx);
  };

  const availableColors = COLORS.filter(c => !players.some(p => p.color === c.id) || c.id === selectedColor);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-4">
        <h3 className="font-bold flex items-center gap-2">
          📱 Players by Phone Number
          <span className="text-xs font-normal text-slate-400">({players.length}/{maxPlayers})</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">Add players by name + phone, choose color, switch turns online</p>

        <div className="mt-3 space-y-2">
          {players.map((p, idx) => {
            const colorInfo = COLORS.find(c => c.id === p.color);
            const isCurrent = idx === currentPlayerIndex;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-xl p-2 border-2 transition-all ${
                  isCurrent ? "border-white bg-slate-700 ring-2 ring-white/20" : "border-slate-700 bg-slate-800"
                }`}
              >
                <div
                  className="h-10 w-10 rounded-full grid place-items-center text-lg"
                  style={{ backgroundColor: colorInfo?.hex + "33", border: `2px solid ${colorInfo?.hex}` }}
                >
                  {p.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-1">
                    {p.name} {isCurrent && "👑"}
                    <span className="text-xs" style={{ color: colorInfo?.hex }}>{colorInfo?.emoji} {p.color}</span>
                  </div>
                  {p.phone && <div className="text-xs text-slate-400">📱 {p.phone}</div>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => switchPlayer(idx)}
                    disabled={isCurrent}
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${isCurrent ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
                  >
                    {isCurrent ? "Playing" : "Switch"}
                  </button>
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="rounded-lg bg-rose-500/20 text-rose-400 px-2 py-1 text-xs hover:bg-rose-500/30"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {players.length < maxPlayers && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3 border border-slate-700">
            <div className="text-xs font-bold text-slate-300 mb-2">➕ Add Player via Phone</div>
            <div className="grid gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player Name (e.g. Priya)"
                maxLength={20}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number (e.g. +91 98765 43210) - optional"
                type="tel"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
              <div>
                <div className="text-xs text-slate-400 mb-1">Choose Color:</div>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => {
                    const taken = players.some(p => p.color === c.id);
                    const selected = selectedColor === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => !taken && setSelectedColor(c.id)}
                        disabled={taken}
                        className={`rounded-full px-3 py-1 text-xs font-bold border-2 transition-all ${
                          selected ? "ring-2 ring-white scale-110" : ""
                        } ${taken ? "opacity-30 cursor-not-allowed bg-slate-700" : "hover:scale-105"}`}
                        style={{
                          backgroundColor: taken ? undefined : c.hex + "33",
                          borderColor: c.hex,
                          color: c.hex,
                        }}
                      >
                        {c.emoji} {c.name} {taken ? "(taken)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={addPlayer}
                disabled={!name.trim() || availableColors.length === 0 && players.length > 0 && !COLORS.some(c => !players.some(p => p.color === c.id))}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Player 📱
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={switchToNext}
            className="flex-1 rounded-xl bg-emerald-500/20 border border-emerald-500/50 px-3 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30"
          >
            🔄 Switch to Next Player
          </button>
          <button
            onClick={() => {
              if (confirm("Clear all phone players?")) {
                setPlayers([]);
                localStorage.removeItem(`phone-players-${game}`);
                const guest: PhonePlayer = { id: 1, name: "Guest Player", phone: "", avatar: "🎮", color: "red" };
                setPlayers([guest]);
                onPlayersChange([guest]);
                onCurrentPlayerChange(guest);
              }
            }}
            className="rounded-xl bg-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-600"
          >
            Clear
          </button>
        </div>

        <div className="mt-3 text-[10px] text-slate-500 text-center">
          💡 Online: Players are saved locally + cloud. Invite via phone number share. Switch turns to play on same device or online.
        </div>
      </div>
    </div>
  );
}
