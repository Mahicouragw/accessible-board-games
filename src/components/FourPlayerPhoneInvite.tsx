"use client";

import { useState, useEffect } from "react";
import { sound } from "@/lib/sound";

export type FourPhonePlayer = {
  id: number;
  name: string;
  phone: string;
  color: "red" | "green" | "yellow" | "blue";
  avatar: string;
  status: "waiting" | "invited" | "joined" | "playing";
};

const COLORS = [
  { id: "red" as const, name: "Red", hex: "#ef4444", emoji: "🔴", bg: "bg-red-500/20", border: "border-red-500" },
  { id: "green" as const, name: "Green", hex: "#22c55e", emoji: "🟢", bg: "bg-green-500/20", border: "border-green-500" },
  { id: "yellow" as const, name: "Yellow", hex: "#eab308", emoji: "🟡", bg: "bg-yellow-500/20", border: "border-yellow-500" },
  { id: "blue" as const, name: "Blue", hex: "#3b82f6", emoji: "🔵", bg: "bg-blue-500/20", border: "border-blue-500" },
];

const AVATARS = ["🦊", "🐼", "🦁", "🐸", "🐵", "🐯", "🦄", "🐙", "🐳", "🦉", "👑", "🎮"];

type Props = {
  game: "ludo" | "snake-ladder" | "carrom";
  onPlayersReady: (players: FourPhonePlayer[]) => void;
  roomCode?: string;
};

export default function FourPlayerPhoneInvite({ game, onPlayersReady, roomCode: initialRoomCode }: Props) {
  const [players, setPlayers] = useState<FourPhonePlayer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedColor, setSelectedColor] = useState<FourPhonePlayer["color"]>("red");
  const [roomCode, setRoomCode] = useState(initialRoomCode || "");
  const [inviteSent, setInviteSent] = useState<number[]>([]);

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
    }
    // Generate room code if not exists
    if (!initialRoomCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(code);
    }
  }, []);

  useEffect(() => {
    if (players.length > 0) {
      localStorage.setItem(`four-players-${game}`, JSON.stringify(players));
      onPlayersReady(players);
    }
  }, [players]);

  const addPlayer = () => {
    if (!name.trim()) {
      sound.play("lose");
      alert("Enter player name!");
      return;
    }
    if (!phone.trim()) {
      sound.play("lose");
      alert("Enter phone number! (Required for 4-player invite)");
      return;
    }
    if (players.length >= 4) {
      sound.play("lose");
      alert("Maximum 4 players for Ludo/Snake Ladder/Carrom!");
      return;
    }
    if (players.some(p => p.color === selectedColor)) {
      sound.play("lose");
      alert(`Color ${selectedColor} already taken by another player! Choose different color.`);
      return;
    }
    if (players.some(p => p.phone === phone.trim())) {
      sound.play("lose");
      alert("This phone number already added!");
      return;
    }

    const newPlayer: FourPhonePlayer = {
      id: Date.now(),
      name: name.trim().slice(0, 20),
      phone: phone.trim().slice(0, 20),
      color: selectedColor,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      status: "waiting",
    };

    const updated = [...players, newPlayer];
    setPlayers(updated);
    setName("");
    setPhone("");
    const nextColor = COLORS.find(c => !updated.some(p => p.color === c.id));
    if (nextColor) setSelectedColor(nextColor.id);
    sound.play("win");
    // Haptic
    if (typeof navigator !== "undefined" && "vibrate" in navigator) (navigator as any).vibrate(50);
  };

  const removePlayer = (id: number) => {
    setPlayers(players.filter(p => p.id !== id));
    sound.play("capture");
  };

  const updatePlayerStatus = (id: number, status: FourPhonePlayer["status"]) => {
    setPlayers(players.map(p => p.id === id ? { ...p, status } : p));
  };

  const generateInviteLink = (player: FourPhonePlayer) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://accessible-board-games.vercel.app";
    return `${baseUrl}/rooms/${roomCode}?game=${game}&color=${player.color}&join=${player.phone}&name=${encodeURIComponent(player.name)}`;
  };

  const sendInvite = (player: FourPhonePlayer) => {
    const link = generateInviteLink(player);
    const message = `🎮 ${gameName} Invitation! 🎲\n\nHi ${player.name}! You are invited to play ${gameName} as ${COLORS.find(c => c.id === player.color)?.name} ${COLORS.find(c => c.id === player.color)?.emoji}\n\nRoom Code: ${roomCode}\nColor: ${player.color}\nGame: ${gameName}\n\nJoin Link: ${link}\n\nChoose your colour and join! Switch turns online or local.\n\nPlay at: https://accessible-board-games.vercel.app\n\n- Accessible Board Games ♿`;
    
    // Mark as invited
    updatePlayerStatus(player.id, "invited");
    setInviteSent([...inviteSent, player.id]);
    sound.play("turn");

    // Try SMS
    const smsLink = `sms:${player.phone}?body=${encodeURIComponent(message)}`;
    // Try WhatsApp
    const whatsappLink = `https://wa.me/${player.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    
    return { smsLink, whatsappLink, message, link };
  };

  const sendMatchRequest = () => {
    if (players.length < 2) {
      alert("Add at least 2 players to send match request!");
      return;
    }
    const matchMessage = `🎮 ${gameName} MATCH REQUEST! 🎲\n\nRoom: ${roomCode}\nGame: ${gameName}\nPlayers:\n${players.map((p, i) => `${i+1}. ${p.name} ${COLORS.find(c => c.id === p.color)?.emoji} ${p.color} - ${p.phone} - ${p.status}`).join('\n')}\n\nAll players choose colour and join:\nhttps://accessible-board-games.vercel.app/rooms/${roomCode}?game=${game}\n\nLet's play! 🎯\n\nAccessible Board Games`;

    players.forEach(p => {
      if (p.phone) {
        updatePlayerStatus(p.id, "invited");
      }
    });
    setInviteSent(players.map(p => p.id));
    sound.play("win");

    // For demo, copy to clipboard and show
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(matchMessage);
      alert(`Match request for 4 players created!\nRoom: ${roomCode}\n\nMessage copied to clipboard:\n\n${matchMessage}\n\nNow share via WhatsApp/SMS to each phone number!`);
    } else {
      alert(matchMessage);
    }
  };

  const availableColors = COLORS.filter(c => !players.some(p => p.color === c.id));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-violet-500/50 bg-violet-500/10 p-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          {gameEmoji} {gameName} — 4 Phone Numbers, 4 Colours, Invite & Join
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Add 4 players (FOUR phone numbers) — each chooses one colour (Red/Green/Yellow/Blue) — Send invitation link / match request — They join and play — Switch turns online/local
        </p>
        
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-700">
            <div className="font-bold text-violet-400">Room Code</div>
            <div className="font-mono text-lg tracking-widest text-white">{roomCode}</div>
            <div className="text-[10px] text-slate-500">Share this code for joining</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-2 border border-slate-700">
            <div className="font-bold text-emerald-400">Players: {players.length}/4</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {players.filter(p => p.status === "joined").length} Joined • {players.filter(p => p.status === "invited").length} Invited • {players.filter(p => p.status === "waiting").length} Waiting
            </div>
            <div className="mt-1 flex gap-1">
              {COLORS.map(c => {
                const taken = players.some(p => p.color === c.id);
                return (
                  <div key={c.id} className={`h-3 w-3 rounded-full border ${taken ? "opacity-100" : "opacity-20"}`} style={{ backgroundColor: c.hex, borderColor: c.hex }} title={`${c.name} ${taken ? "taken" : "available"}`} />
                );
              })}
            </div>
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
                <div className="text-3xl opacity-20">👤</div>
                <div className="text-xs text-slate-500 mt-1">Player Slot {slotIdx + 1} Empty</div>
                <div className="text-[10px] text-slate-600">Add phone number below</div>
              </div>
            );
          }

          return (
            <div
              key={player.id}
              className={`rounded-2xl border-2 p-3 transition-all ${colorInfo ? `${colorInfo.bg} ${colorInfo.border}` : "border-slate-700 bg-slate-800"}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full grid place-items-center text-xl border-2" style={{ backgroundColor: colorInfo?.hex + "33", borderColor: colorInfo?.hex }}>
                    {player.avatar}
                  </div>
                  <div className="absolute -bottom-1 -right-1 text-xs rounded-full bg-slate-900 border border-slate-700 px-1">
                    {colorInfo?.emoji}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {player.name}
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: colorInfo?.hex, color: "white" }}>
                      {player.color.toUpperCase()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      player.status === "joined" ? "bg-emerald-500 text-white" :
                      player.status === "invited" ? "bg-amber-500 text-black" :
                      "bg-slate-600 text-slate-300"
                    }`}>
                      {player.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1">
                    📱 {player.phone}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {colorInfo?.name} • Player {slotIdx + 1}/4
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {player.status === "waiting" && (
                    <>
                      <button
                        onClick={() => {
                          const { smsLink } = sendInvite(player);
                          window.open(smsLink, "_blank");
                        }}
                        className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-400"
                      >
                        📱 SMS Invite
                      </button>
                      <button
                        onClick={() => {
                          const { whatsappLink } = sendInvite(player);
                          window.open(whatsappLink, "_blank");
                        }}
                        className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-400"
                      >
                        💬 WhatsApp
                      </button>
                    </>
                  )}
                  {player.status === "invited" && (
                    <button
                      onClick={() => updatePlayerStatus(player.id, "joined")}
                      className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white"
                    >
                      ✓ Joined
                    </button>
                  )}
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="rounded-lg bg-rose-500/20 text-rose-400 px-2 py-1 text-[10px] hover:bg-rose-500/30"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {player.status === "invited" && (
                <div className="mt-2 rounded-lg bg-slate-900/50 border border-slate-700 p-2">
                  <div className="text-[10px] font-bold text-slate-400">Invitation Link (Send to {player.phone}):</div>
                  <div className="mt-1 text-[10px] font-mono bg-slate-800 p-2 rounded border break-all select-all">
                    {generateInviteLink(player)}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generateInviteLink(player));
                        sound.play("select");
                        alert("Link copied!");
                      }}
                      className="rounded bg-slate-700 px-2 py-1 text-[10px] text-white"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => updatePlayerStatus(player.id, "joined")}
                      className="rounded bg-emerald-600 px-2 py-1 text-[10px] text-white"
                    >
                      Mark Joined ✓
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Player Form */}
      {players.length < 4 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="text-sm font-bold text-slate-200">➕ Add Player {players.length + 1}/4 — Phone + Colour</div>
          <div className="mt-3 grid gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Player ${players.length + 1} Name (e.g. Priya)`}
              maxLength={20}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={`Phone Number ${players.length + 1} (e.g. +91 98765 43210) — Required`}
              type="tel"
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            />
            <div>
              <div className="text-xs text-slate-400 mb-1">Choose ONE Colour (each player different):</div>
              <div className="grid grid-cols-2 gap-2">
                {COLORS.map(c => {
                  const taken = players.some(p => p.color === c.id);
                  const selected = selectedColor === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => !taken && setSelectedColor(c.id)}
                      disabled={taken}
                      className={`rounded-xl p-2 border-2 text-left transition-all flex items-center gap-2 ${
                        selected ? "ring-2 ring-white scale-[1.02] border-white" : "border-slate-700"
                      } ${taken ? "opacity-30 cursor-not-allowed" : "hover:border-slate-500"}`}
                      style={{ backgroundColor: taken ? undefined : c.hex + "22" }}
                    >
                      <span className="text-lg">{c.emoji}</span>
                      <div>
                        <div className="text-xs font-bold" style={{ color: taken ? "#64748b" : c.hex }}>{c.name}</div>
                        <div className="text-[10px] text-slate-500">{taken ? "Taken by " + players.find(p => p.color === c.id)?.name : "Available"}</div>
                      </div>
                      {selected && <span className="ml-auto text-white">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={addPlayer}
              disabled={!name.trim() || !phone.trim() || players.some(p => p.color === selectedColor)}
              className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>➕</span> Add Player {players.length + 1} — {COLORS.find(c => c.id === selectedColor)?.emoji} {selectedColor.toUpperCase()} — 📱 {phone ? phone.slice(-4) : "No Phone"}
            </button>
            <div className="text-[10px] text-slate-500 text-center">
              Each of 4 players chooses ONE colour: Red, Green, Yellow, Blue — No duplicate colours — Phone required for invitation
            </div>
          </div>
        </div>
      )}

      {/* Match Request / Invite All */}
      {players.length >= 2 && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="font-bold text-emerald-400 flex items-center gap-2">
            🎯 4-Player Match Ready — Send Invitation Links
          </div>
          <div className="mt-2 text-xs text-slate-300">
            Room: <span className="font-mono font-bold text-white tracking-widest">{roomCode}</span> • Game: {gameName} • Players: {players.length}/4
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="flex gap-1 flex-wrap">
              {players.map(p => {
                const c = COLORS.find(col => col.id === p.color);
                return <span key={p.id} className="text-xs px-2 py-1 rounded-full border" style={{ borderColor: c?.hex, color: c?.hex, backgroundColor: c?.hex + "22" }}>{c?.emoji} {p.name} ({p.color})</span>;
              })}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={sendMatchRequest}
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400"
            >
              📤 Send Match Request to 4 Phones
            </button>
            <button
              onClick={() => {
                const allLinks = players.map(p => `${p.name} (${p.color}): ${generateInviteLink(p)}`).join('\n\n');
                const fullMessage = `${gameName} Room ${roomCode} - 4 Players Invitations:\n\n${allLinks}\n\nJoin: https://accessible-board-games.vercel.app/rooms/${roomCode}`;
                navigator.clipboard.writeText(fullMessage);
                sound.play("win");
                alert(`All 4 invitation links copied!\n\n${fullMessage}`);
              }}
              className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-400"
            >
              🔗 Copy All 4 Links
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={`sms:?body=${encodeURIComponent(`🎮 ${gameName} 4-Player Match! Room ${roomCode}\nPlayers: ${players.map(p => `${p.name} ${p.color} ${p.phone}`).join(', ')}\nJoin: https://accessible-board-games.vercel.app/rooms/${roomCode}`)}`}
              className="rounded-xl bg-slate-700 border border-slate-600 px-3 py-2 text-xs font-bold text-white text-center hover:bg-slate-600"
            >
              📱 SMS to All 4 Phones
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🎮 ${gameName} 4-Player Match Room ${roomCode}! Players: ${players.map(p => `${p.name}(${p.color})`).join(', ')} - Join: https://accessible-board-games.vercel.app/rooms/${roomCode}`)}`}
              target="_blank"
              className="rounded-xl bg-emerald-600 border border-emerald-500 px-3 py-2 text-xs font-bold text-white text-center hover:bg-emerald-500"
            >
              💬 WhatsApp All 4
            </a>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 text-center">
            Each player clicks their link, chooses colour (already assigned), joins room {roomCode}, then game starts with 4 colours! Switch turns online.
          </div>
        </div>
      )}

      {players.length === 4 && (
        <div className="rounded-2xl border-2 border-white bg-slate-900 p-3 text-center">
          <div className="font-black text-white">🎉 4 Players Ready! Full House!</div>
          <div className="mt-1 flex justify-center gap-2 flex-wrap">
            {players.map(p => {
              const c = COLORS.find(col => col.id === p.color);
              return (
                <div key={p.id} className="flex items-center gap-1 text-xs">
                  <span style={{ color: c?.hex }}>{c?.emoji}</span>
                  <span className="text-white font-bold">{p.name}</span>
                  <span className="text-slate-500">({p.phone.slice(-4)})</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-bold">All 4 colours chosen — Red, Green, Yellow, Blue — Ready to play! Switch turns online!</div>
        </div>
      )}
    </div>
  );
}
