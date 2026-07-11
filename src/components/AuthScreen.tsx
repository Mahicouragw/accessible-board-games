"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";

export default function AuthScreen() {
  const { setPlayer } = useSession();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  async function register() {
    if (!name.trim()) return setError("Enter your name first");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewCode(data.player?.code ?? "");
      setPlayer(data.player);
      sound.play("win");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      sound.play("lose");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (!code.trim()) return setError("Enter your Player ID or Phone Number");
    setBusy(true);
    setError("");
    try {
      // Try login by code first, if phone number, try phone login
      const isPhone = code.includes("+") || code.length > 6 && /^[\d\s+-]+$/.test(code);
      const endpoint = isPhone ? "/api/auth/login-phone" : "/api/auth/login";
      const body = isPhone ? { phone: code } : { code };
      
      let res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      // If phone login endpoint doesn't exist, try regular login with phone as code (local DB will handle)
      if (!res.ok && isPhone) {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlayer(data.player);
      sound.play("select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      sound.play("lose");
    } finally {
      setBusy(false);
    }
  }

  if (newCode) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 text-2xl font-bold">Welcome, {name}!</h1>
          <p className="mt-2 text-slate-400">
            This is your Player ID. Save it — use it to log in and keep all your progress.
            {phone && <><br/>Phone: <span className="text-emerald-400">{phone}</span> linked for multiplayer invites</>}
          </p>
          <div className="mt-6 rounded-2xl bg-slate-800 p-6">
            <div className="text-xs uppercase tracking-widest text-slate-500">Your Player ID</div>
            <div className="mt-2 select-all font-mono text-4xl font-black tracking-[0.3em] text-emerald-400">
              {newCode}
            </div>
            {phone && (
              <div className="mt-3 text-xs text-slate-400">
                📱 Phone: {phone} — Friends can invite you via phone number for Ludo & Snake Ladder
              </div>
            )}
          </div>
          <button
            onClick={() => setNewCode(null)}
            className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Let&apos;s Play → 🔊
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-6xl">🎮</div>
          <h1 className="mt-3 bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-4xl font-black text-transparent">
            PlayVerse Arcade
          </h1>
          <p className="mt-2 text-slate-400">
            Play online or vs AI. Your progress is saved forever.
            <br/>
            <span className="text-xs">🔊 Realistic sounds + 📱 Phone multiplayer for Ludo & Snake Ladder</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-6 flex rounded-xl bg-slate-800 p-1">
            <button
              onClick={() => {
                setMode("register");
                setError("");
                sound.play("click");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              New Player 📱
            </button>
            <button
              onClick={() => {
                setMode("login");
                setError("");
                sound.play("click");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              I have an ID
            </button>
          </div>

          {mode === "register" ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Your Name *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && register()}
                  placeholder="e.g. Alex, Priya"
                  maxLength={24}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Phone Number (for Ludo & Snake multiplayer) 📱
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210 (optional)"
                  type="tel"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500">Friends can invite you via phone for Ludo & Snake Ladder. Switch players online!</span>
              </label>
              <button
                onClick={register}
                disabled={busy}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? "Creating... 🔊" : "Create My Player ID 📱🔊"}
              </button>
              <div className="text-center">
                <button onClick={() => sound.play("win")} className="text-xs text-slate-500 hover:text-slate-300">🔊 Test Win Sound</button>
                <span className="mx-2 text-slate-600">|</span>
                <button onClick={() => sound.play("dice")} className="text-xs text-slate-500 hover:text-slate-300">🎲 Test Dice</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Player ID or Phone Number 📱
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="e.g. K7P2QX or +91..."
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-lg tracking-wide text-white outline-none focus:border-sky-500"
                />
                <span className="text-[11px] text-slate-500">Enter 6-char ID or phone number to login</span>
              </label>
              <button
                onClick={login}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Logging in... 🔊" : "Log In 📱"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-400">
              {error}
            </p>
          )}

          <div className="mt-6 rounded-xl bg-slate-800/50 border border-slate-700 p-3">
            <div className="text-xs font-bold text-slate-300">🎯 New Features:</div>
            <ul className="mt-1 text-[11px] text-slate-400 space-y-1 list-disc list-inside">
              <li>🔊 Realistic sounds: Dice roll, token move, win, ladder, snake - taken from real game audio</li>
              <li>🎵 Background music: Lo-fi loop for all games</li>
              <li>📱 Phone multiplayer: Add players by phone number for Ludo & Snake Ladder</li>
              <li>🔄 Switch players: Choose player and switch turn online or local</li>
              <li>♿ Accessible: High contrast, screen reader, keyboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
