"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";

export default function AuthScreen() {
  const { setPlayer } = useSession();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
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
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewCode(data.player?.code ?? "");
      setPlayer(data.player);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (!code.trim()) return setError("Enter your Player ID");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlayer(data.player);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
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
          </p>
          <div className="mt-6 rounded-2xl bg-slate-800 p-6">
            <div className="text-xs uppercase tracking-widest text-slate-500">Your Player ID</div>
            <div className="mt-2 select-all font-mono text-4xl font-black tracking-[0.3em] text-emerald-400">
              {newCode}
            </div>
          </div>
          <button
            onClick={() => setNewCode(null)}
            className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Let&apos;s Play →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-6xl">🎮</div>
          <h1 className="mt-3 bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-4xl font-black text-transparent">
            PlayVerse Arcade
          </h1>
          <p className="mt-2 text-slate-400">
            Play online or vs AI. Your progress is saved forever.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-6 flex rounded-xl bg-slate-800 p-1">
            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              New Player
            </button>
            <button
              onClick={() => {
                setMode("login");
                setError("");
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
                Your Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && register()}
                  placeholder="e.g. Alex"
                  maxLength={24}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-sky-500"
                />
              </label>
              <button
                onClick={register}
                disabled={busy}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? "Creating..." : "Create My Player ID"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Player ID
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="e.g. K7P2QX"
                  maxLength={6}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-sky-500"
                />
              </label>
              <button
                onClick={login}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Logging in..." : "Log In"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
