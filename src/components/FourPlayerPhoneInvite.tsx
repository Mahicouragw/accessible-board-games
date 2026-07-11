"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";
import { useSession } from "@/lib/session";

export type FourPlayer = {
  id: number;
  name: string;
  phone?: string;
  color: "red" | "green" | "yellow" | "blue";
  avatar: string;
  type: "human" | "ai" | "online";
  status: "waiting" | "invited" | "joined" | "playing";
};
export type FourPhonePlayer = FourPlayer; // Alias for backward compatibility

type Spectator = {
  id: number;
  name: string;
  avatar: string;
};

const COLORS = [
  { id: "red" as const, name: "Red", hex: "#ef4444", emoji: "🔴", bg: "bg-red-500/20", border: "border-red-500" },
  { id: "green" as const, name: "Green", hex: "#22c55e", emoji: "🟢", bg: "bg-green-500/20", border: "border-green-500" },
  { id: "yellow" as const, name: "Yellow", hex: "#eab308", emoji: "🟡", bg: "bg-yellow-500/20", border: "border-yellow-500" },
  { id: "blue" as const, name: "Blue", hex: "#3b82f6", emoji: "🔵", bg: "bg-blue-500/20", border: "border-blue-500" },
];

const AVATARS = ["🦊", "🐼", "🦁", "🐸", "🐵", "🐯", "🦄", "🐙", "🐳", "🦉", "👑", "🎮", "🤖"];

type Props = {
  game: "ludo" | "snake-ladder" | "carrom";
  onPlayersReady: (players: FourPlayer[]) => void;
  roomCode?: string;
};

export default function FourPlayerPhoneInvite({ game, onPlayersReady, roomCode: initialRoomCode }: Props) {
  const { player: currentUser } = useSession();
  const [players, setPlayers] = useState<FourPlayer[]>([]);
  const [spectators, setSpectators] = useState<Spectator[]>([]);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<FourPlayer["color"]>("red");
  const [playerType, setPlayerType] = useState<FourPlayer["type"]>("human");
  const [roomCode, setRoomCode] = useState(initialRoomCode || "");

  const gameEmoji = game === "ludo" ? "🎲" : game === "snake-ladder" ? "🐍🪜" : "🎯";
  const gameName = game === "ludo" ? "Ludo" : game === "snake-ladder" ? "Snake & Ladder" : "Carrom Board";

  useEffect(() => {
    const saved = localStorage.getItem(`four-players-${game}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setPlayers(parsed);
          onPlayersReady(parsed);
        }
      } catch {}
    } else if (currentUser) {
      // Auto-add current user as first player
      const defaultPlayer: FourPlayer = {
        id: currentUser.id,
        name: currentUser.name,
        color: "red",
        avatar: currentUser.avatar,
        type: "human",
        status: "joined",
      };
      setPlayers([defaultPlayer]);
      onPlayersReady([defaultPlayer]);
    }
    if (!initialRoomCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(code);
    }
    // Mock spectators for demo
    setSpectators([
      { id: 101, name: "Alex (Spectator)", avatar: "👀" },
      { id: 102, name: "Sam (Watching)", avatar: "👓" },
    ]);
  }, []);

  useEffect(() => {
    if (players.length > 0) {
      localStorage.setItem(`four-players-${game}`, JSON.stringify(players));
      onPlayersReady(players);
    }
  }, [players]);

  const addPlayer = () => {
    if (!name.trim() && playerType === "human") {
      sound.play("lose");
      return;
    }
    if (players.length >= 4) {
      sound.play("lose");
      alert("Maximum 4 players!");
      return;
    }
    if (players.some(p => p.color === selectedColor)) {
      sound.play("lose");
      alert(`Color ${selectedColor} already taken!`);
      return;
    }

    let newName = name.trim();
    let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    if (playerType === "ai") {
      newName = `AI ${COLORS.find(c => c.id === selectedColor)?.name} 🤖`;
      avatar = "🤖";
    } else if (!newName) {
      newName = `Player ${players.length + 1}`;
    }

    const newPlayer: FourPlayer = {
      id: Date.now(),
      name: newName.slice(0, 20),
      color: selectedColor,
      avatar,
      type: playerType,
      status: playerType === "ai" ? "joined" : "waiting",
    };

    const updated = [...players, newPlayer];
    setPlayers(updated);
    setName("");
    const nextColor = COLORS.find(c => !updated.some(p => p.color === c.id));
    if (nextColor) setSelectedColor(nextColor.id);
    sound.play("win");
    if (typeof navigator !== "undefined" && "vibrate" in navigator) (navigator as any).vibrate(50);
  };

  const removePlayer = (id: number) => {
    setPlayers(players.filter(p => p.id !== id));
    sound.play("capture");
  };

  const addAIPlayer = () => {
    if (players.length >= 4) return;
    const available = COLORS.filter(c => !players.some(p => p.color === c.id));
    if (available.length === 0) return;
    const color = available[0];
    const aiPlayer: FourPlayer = {
      id: Date.now(),
      name: `AI ${color.name} 🤖`,
      color: color.id,
      avatar: "🤖",
      type: "ai",
      status: "joined",
    };
    setPlayers([...players, aiPlayer]);
    sound.play("turn");
  };

  const joinAsSpectator = () => {
    if (!currentUser) return;
    const spec: Spectator = {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
    };
    if (!spectators.some(s => s.id === spec.id)) {
      setSpectators([...spectators, spec]);
      sound.play("select");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-violet-500/50 bg-violet-500/10 p-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          {gameEmoji} {gameName} — 4 Players, Online or AI, Spectator Mode
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          4 players max — Play with online players or AI — Everyone can join as spectator — Background music & realistic sounds
        </p>
        
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-700">
            <div className="font-bold text-violet-400">Room</div>
            <div className="font-mono text-sm tracking-widest text-white">{roomCode}</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-700">
            <div className="font-bold text-emerald-400">Players {players.length}/4</div>
            <div className="text-[10px] text-slate-400">{players.filter(p => p.type === "human").length} Human • {players.filter(p => p.type === "ai").length} AI • {players.filter(p => p.type === "online").length} Online</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-700">
            <div className="font-bold text-sky-400">Spectators {spectators.length}</div>
            <div className="text-[10px] text-slate-400">Everyone can watch 👀</div>
            <button onClick={joinAsSpectator} className="mt-1 text-[10px] bg-sky-500/20 border border-sky-500/50 px-2 py-0.5 rounded-full text-sky-300">Join as Spectator 👀</button>
          </div>
        </div>
      </div>

      {/* 4 Player Slots */}
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, slotIdx) => {
          const player = players[slotIdx];
          const colorInfo = player ? COLORS.find(c => c.id === player.color) : null;
          
          if (!player) {
            return (
              <div key={`empty-${slotIdx}`} className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/30 p-4 text-center">
                <div className="text-2xl opacity-30">👤 Slot {slotIdx + 1}</div>
                <div className="text-xs text-slate-500">Empty — Add human, AI, or online player</div>
              </div>
            );
          }

          return (
            <div
              key={player.id}
              className={`rounded-2xl border-2 p-3 ${colorInfo ? `${colorInfo.bg} ${colorInfo.border}` : "border-slate-700 bg-slate-800"}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full grid place-items-center text-xl border-2" style={{ backgroundColor: colorInfo?.hex + "33", borderColor: colorInfo?.hex }}>
                  {player.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                    {player.name}
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: colorInfo?.hex, color: "white" }}>
                      {player.color.toUpperCase()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${player.type === "ai" ? "bg-violet-500 text-white" : player.type === "online" ? "bg-sky-500 text-white" : "bg-emerald-500 text-white"}`}>
                      {player.type === "ai" ? "🤖 AI" : player.type === "online" ? "🌐 Online" : "👤 Human"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {colorInfo?.name} • Player {slotIdx + 1}/4 • {player.status}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => removePlayer(player.id)} className="rounded-lg bg-rose-500/20 text-rose-400 px-2 py-1 text-[10px]">Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Spectators */}
      {spectators.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3">
          <div className="font-bold text-xs text-sky-400 flex items-center gap-2">👀 Spectators — Everyone Can Join & Watch ({spectators.length})</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {spectators.map(s => (
              <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-slate-700 border border-slate-600 text-slate-300">
                {s.avatar} {s.name}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Spectator skills: Watch live game, chat, send emojis, learn strategies — No limit!</div>
        </div>
      )}

      {/* Add Player - No Phone Required */}
      {players.length < 4 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="text-sm font-bold">➕ Add Player {players.length + 1}/4 — No Phone Needed, Online or AI</div>
          <div className="mt-3 grid gap-2">
            <div className="flex gap-2">
              <button onClick={() => setPlayerType("human")} className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 ${playerType === "human" ? "bg-emerald-600 border-emerald-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>👤 Human</button>
              <button onClick={() => setPlayerType("ai")} className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 ${playerType === "ai" ? "bg-violet-600 border-violet-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>🤖 AI</button>
              <button onClick={() => setPlayerType("online")} className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 ${playerType === "online" ? "bg-sky-600 border-sky-400 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>🌐 Online</button>
            </div>
            
            {playerType === "human" && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Player ${players.length + 1} Name (e.g. Priya) - No phone needed`}
                maxLength={20}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            )}
            
            <div>
              <div className="text-xs text-slate-400 mb-1">Choose ONE Colour (each different):</div>
              <div className="grid grid-cols-2 gap-2">
                {COLORS.map(c => {
                  const taken = players.some(p => p.color === c.id);
                  const selected = selectedColor === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !taken && setSelectedColor(c.id)}
                      disabled={taken}
                      className={`rounded-xl p-2 border-2 text-left flex items-center gap-2 ${selected ? "ring-2 ring-white border-white scale-[1.02]" : "border-slate-700"} ${taken ? "opacity-30 cursor-not-allowed" : "hover:border-slate-500"}`}
                      style={{ backgroundColor: taken ? undefined : c.hex + "22" }}
                    >
                      <span className="text-lg">{c.emoji}</span>
                      <div>
                        <div className="text-xs font-bold" style={{ color: taken ? "#64748b" : c.hex }}>{c.name}</div>
                        <div className="text-[10px] text-slate-500">{taken ? "Taken" : "Available"}</div>
                      </div>
                      {selected && <span className="ml-auto text-white">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <button
              onClick={addPlayer}
              className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 flex items-center justify-center gap-2"
            >
              ➕ Add {playerType === "ai" ? "AI" : playerType === "online" ? "Online" : "Human"} Player — {COLORS.find(c => c.id === selectedColor)?.emoji} {selectedColor.toUpperCase()}
            </button>
            <button onClick={addAIPlayer} className="rounded-xl bg-slate-700 border border-slate-600 px-4 py-2 text-xs text-slate-300 hover:bg-slate-600">
              Quick Add AI Player 🤖
            </button>
          </div>
        </div>
      )}

      {/* Match & Sound */}
      {players.length >= 2 && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="font-bold text-emerald-400">🎯 {players.length}-Player Match Ready — Online or AI</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {players.map(p => {
              const c = COLORS.find(col => col.id === p.color);
              return <span key={p.id} className="text-xs px-2 py-1 rounded-full border" style={{ borderColor: c?.hex, color: c?.hex, backgroundColor: c?.hex + "22" }}>{c?.emoji} {p.name} ({p.type})</span>;
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => { sound.play("win"); alert(`Match starting! Room ${roomCode} - ${players.length} players: ${players.map(p => `${p.name} ${p.color}`).join(', ')}`); }} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white">🎲 Start {players.length}-Player Match!</button>
            <button onClick={() => { navigator.clipboard.writeText(`Join ${game} Room ${roomCode}: https://accessible-board-games.vercel.app/rooms/${roomCode}`); sound.play("select"); }} className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white">🔗 Copy Room Link</button>
          </div>
        </div>
      )}

      {/* Background Music & Sound Effects */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <div className="font-bold text-xs text-violet-400 flex items-center gap-2">🔊 Background Music & Sound Effects — Realistic (All Games)</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
          <div>🎲 Ludo Dice - Real shaking cup</div>
          <div>🪵 Token Move - Wooden knock</div>
          <div>🪜 Ladder - Harp glissando</div>
          <div>🐍 Snake - Hiss + slide</div>
          <div>🎯 Carrom Strike - Flick + slide</div>
          <div>💥 Capture - Pop + thud</div>
          <div>🎉 Win - Fanfare brass</div>
          <div>😔 Lose - Sad trombone</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => sound.play("dice")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">🎲 Dice</button>
          <button onClick={() => sound.play("move")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">🪵 Move</button>
          <button onClick={() => sound.play("ladder")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">🪜 Ladder</button>
          <button onClick={() => sound.play("snake")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">🐍 Snake</button>
          <button onClick={() => sound.play("carrom_strike")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">🎯 Carrom</button>
          <button onClick={() => sound.play("win")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white">🎉 Win</button>
          <button onClick={() => sound.setMusic(!sound.settings.music)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${sound.settings.music ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300"}`}>🎵 Music {sound.settings.music ? "On" : "Off"}</button>
          <button onClick={() => sound.setSfx(!sound.settings.sfx)} className={`rounded-lg px-3 py-1.5 text-xs ${sound.settings.sfx ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400"}`}>🔊 SFX {sound.settings.sfx ? "On" : "Off"}</button>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">Real WAV files from public/sounds/ — dice-roll, token-move, ladder, snake, win, background-music lo-fi loop — Plays via Web Audio, fallback synthesis</div>
      </div>

      {players.length === 4 && (
        <div className="rounded-2xl border-2 border-white bg-gradient-to-r from-violet-900/50 to-emerald-900/50 p-3 text-center">
          <div className="font-black text-white">🎉 4 Players Full House — Each One Colour!</div>
          <div className="text-xs text-emerald-300 mt-1">Red, Green, Yellow, Blue — All 4 slots filled — Play with online players or AI — Everyone can join as spectator 👀</div>
        </div>
      )}
    </div>
  );
}
