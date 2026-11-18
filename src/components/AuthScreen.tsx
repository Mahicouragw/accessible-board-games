"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { SECRET_QUESTIONS } from "@/lib/secret-questions";

export default function AuthScreen() {
  const { setPlayer } = useSession();
  const [mode, setMode] = useState<"register" | "login" | "recover">("register");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [secretQ, setSecretQ] = useState(SECRET_QUESTIONS[0]);
  const [secretA, setSecretA] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  // Register: NAME + secret question/answer only. No phone number.
  async function register() {
    if (!name.trim()) return setError("Enter your name first");
    if (!secretA.trim()) return setError("Answer the secret question — it recovers your Player ID if you forget it");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, secretQ, secretA }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewCode(data.player?.code ?? "");
      setPlayer(data.player);
      sound.play("win");
      announce(`Account created. Your Player ID is ${data.player?.code}. Save it to log in later.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      sound.play("lose");
    } finally {
      setBusy(false);
    }
  }

  // Login: Player ID only.
  async function login() {
    if (!code.trim()) return setError("Enter your 6-character Player ID");
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
      sound.play("select");
      announce(`Welcome back, ${data.player?.name ?? "player"}!`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      sound.play("lose");
    } finally {
      setBusy(false);
    }
  }

  // Recover forgotten Player ID: name + secret answer.
  async function recover() {
    if (!name.trim() || !secretA.trim()) return setError("Enter your name and your secret answer");
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, answer: secretA }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setInfo(data.message ?? `Your Player ID is ${data.player?.code}`);
      sound.play("win");
      announce(data.message ?? `Your Player ID is ${data.player?.code}`);
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
            This is your Player ID. Save it — use it to log in from any device and keep all your progress.
            If you ever forget it, use the <b>secret question</b> you just set on the login page.
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
            Let&apos;s Play → 🔊
          </button>
        </div>
      </div>
    );
  }

  const tabBtn = (m: "register" | "login" | "recover", label: string) => (
    <button
      onClick={() => {
        setMode(m);
        setError("");
        setInfo("");
        sound.play("click");
      }}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        mode === m ? "bg-slate-700 text-white" : "text-slate-400"
      }`}
    >
      {label}
    </button>
  );

  const inputCls =
    "mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-sky-500";

  return (
    <div className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-6xl">🎮</div>
          <h1 className="mt-3 bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-4xl font-black text-transparent">
            PlayVerse Arcade
          </h1>
          <p className="mt-2 text-slate-400">
            Play online with friends or vs AI. Progress saved in the real cloud database.
            <br/>
            <span className="text-xs">🔊 Real recorded sounds · 🎙️ In-game TalkBack voice · 🌐 Play online from any device</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1">
            {tabBtn("register", "New Player")}
            {tabBtn("login", "I have an ID")}
            {tabBtn("recover", "Forgot ID?")}
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
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Secret question (recovers your ID if forgotten) 🔐
                <select
                  value={secretQ}
                  onChange={(e) => setSecretQ(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  {SECRET_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Your secret answer *
                <input
                  value={secretA}
                  onChange={(e) => setSecretA(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && register()}
                  placeholder="Only you know this"
                  className={inputCls}
                />
                <span className="text-[11px] text-slate-500">Stored hashed — used only to find your Player ID again.</span>
              </label>
              <button
                onClick={register}
                disabled={busy}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? "Creating... 🔊" : "Create My Player ID 🔊"}
              </button>
              <div className="text-center">
                <button onClick={() => sound.play("win")} className="text-xs text-slate-500 hover:text-slate-300">🔊 Test Win Sound</button>
                <span className="mx-2 text-slate-600">|</span>
                <button onClick={() => sound.play("dice")} className="text-xs text-slate-500 hover:text-slate-300">🎲 Test Dice</button>
              </div>
            </div>
          ) : mode === "login" ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-300">
                Player ID
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="e.g. K7P2QX"
                  className={`${inputCls} font-mono text-lg tracking-[0.2em] uppercase`}
                />
                <span className="text-[11px] text-slate-500">The 6-character ID you got when you registered</span>
              </label>
              <button
                onClick={login}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Logging in... 🔊" : "Log In 🔊"}
              </button>
              <button
                onClick={() => { setMode("recover"); setError(""); sound.play("click"); }}
                className="w-full text-center text-xs text-sky-400 hover:text-sky-300"
              >
                Forgot your Player ID? Recover it with your secret answer →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your name and the secret answer you chose at registration — we&apos;ll show your Player ID again.
              </p>
              <label className="block text-sm font-medium text-slate-300">
                Your Name *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex, Priya"
                  maxLength={24}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-medium text-slate-300">
                Your secret answer *
                <input
                  value={secretA}
                  onChange={(e) => setSecretA(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && recover()}
                  placeholder="Your answer"
                  className={inputCls}
                />
              </label>
              <button
                onClick={recover}
                disabled={busy}
                className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
              >
                {busy ? "Checking... 🔊" : "Recover my Player ID 🔐"}
              </button>
              {info && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-400">{info}</p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-400">
              {error}
            </p>
          )}

          <div className="mt-6 rounded-xl bg-slate-800/50 border border-slate-700 p-3">
            <div className="text-xs font-bold text-slate-300">🎯 Features:</div>
            <ul className="mt-1 text-[11px] text-slate-400 space-y-1 list-disc list-inside">
              <li>🔊 Real recorded sounds: dice, token move, win, ladder, snake, swipe</li>
              <li>🎵 Per-game background music</li>
              <li>🎙️ In-game TalkBack voice — every move is spoken, no system TalkBack needed</li>
              <li>🌐 Online multiplayer: share your Player ID, invite friends, get matched randomly</li>
              <li>🗄️ Real cloud database (Supabase) — chat, rooms, matches, scores persist</li>
              <li>🎛️ Sound Studio — record your own real sound effects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
