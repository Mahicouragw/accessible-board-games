"use client";

// 🎛️ Sound Studio — replace any built-in sound effect with YOUR OWN real
// recording. Open this page, tap 🎙️ to record (or 📁 to pick a file), and it
// is instantly published to every player through the cloud database
// (Supabase bg_sounds table). Tap ↺ to go back to the built-in recording.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sound, SFX_LIST } from "@/lib/sound";
import { announce } from "@/lib/a11y";

type Status = { custom: Record<string, boolean>; cloud: string; msg: string };

export default function SoundStudioPage() {
  const [status, setStatus] = useState<Status>({ custom: {}, cloud: "…", msg: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const chunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pendingName = useRef<string>("");

  const refresh = useCallback(async () => {
    const custom: Record<string, boolean> = {};
    await Promise.all(
      SFX_LIST.map(async (s) => {
        try {
          const r = await fetch(`/api/sounds/user/${s.name}`, { cache: "no-store" });
          custom[s.name] = r.ok;
        } catch {
          custom[s.name] = false;
        }
      }),
    );
    let cloud = "…";
    try {
      const h = await fetch("/api/health", { cache: "no-store" }).then((r) => r.json());
      cloud = h.cloud === "supabase" ? "🟢 Real database (Supabase Postgres) LIVE" : "🟡 Zero-setup cloud (Supabase not probed yet)";
    } catch {}
    setStatus((st) => ({ ...st, custom, cloud }));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const say = (msg: string) => {
    setStatus((st) => ({ ...st, msg }));
    announce(msg);
  };

  const upload = async (name: string, dataUrl: string, mime: string) => {
    setBusy(name);
    try {
      const r = await fetch("/api/sounds/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dataUrl, mime }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `upload failed (${r.status})`);
      try {
        localStorage.setItem("arcade_user_sounds_v", String(Date.now()));
      } catch {}
      sound.refreshUserSounds();
      say(`✅ "${name}" published! Every player now hears your recording.`);
      sound.play(name as any); // hear it immediately
    } catch (e: any) {
      say(`❌ Upload failed: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const reset = async (name: string) => {
    setBusy(name);
    try {
      await fetch("/api/sounds/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, reset: true }),
      });
      try {
        localStorage.setItem("arcade_user_sounds_v", String(Date.now()));
      } catch {}
      sound.refreshUserSounds();
      say(`↺ "${name}" reset to the built-in recording.`);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const startRecord = async (name: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      discardRef.current = false;
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(null);
        if (discardRef.current) {
          say(`Recording of "${name}" cancelled — nothing was saved.`);
          return;
        }
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => upload(name, String(reader.result), blob.type);
        reader.readAsDataURL(blob);
      };
      mediaRec.current = rec;
      rec.start();
      setRecording(name);
      say(`Recording "${name}"… tap again to stop.`);
      setTimeout(() => {
        if (mediaRec.current?.state === "recording") mediaRec.current.stop();
      }, 6000); // safety stop at 6 s
    } catch {
      say("❌ Microphone not available — use 📁 Upload file instead.");
    }
  };

  const stopRecord = () => {
    if (mediaRec.current?.state === "recording") mediaRec.current.stop();
  };

  const cancelRecord = () => {
    discardRef.current = true;
    if (mediaRec.current?.state === "recording") mediaRec.current.stop();
    else setRecording(null);
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const name = pendingName.current;
    e.target.value = "";
    if (!f || !name) return;
    const reader = new FileReader();
    reader.onload = () => upload(name, String(reader.result), f.type || "audio/wav");
    reader.readAsDataURL(f);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-slate-100">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">🎛️ Sound Studio</h1>
        <Link href="/" className="rounded-xl border border-slate-700 px-3 py-2 text-sm">← Back to arcade</Link>
      </div>
      <p className="text-sm text-slate-400">
        All game sounds are real recorded effects. Want your own? For any sound below, tap <b>🎙️ Record</b> (speak/clap/roll real dice — up to 6 s)
        or <b>📁 Upload</b> a sound file (wav/mp3/ogg/m4a, max 6 MB). It publishes instantly to <b>every player</b> via the cloud database.
        <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs">{status.cloud}</span>
      </p>
      {status.msg && (
        <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm" aria-live="polite">{status.msg}</div>
      )}

      <input ref={fileInput} type="file" accept="audio/*" className="hidden" onChange={onFilePicked} />

      <div className="mt-4 grid gap-2">
        {SFX_LIST.map((s) => (
          <div key={s.name} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
            <span className="text-xl" aria-hidden>{s.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{s.label}</div>
              <div className="text-[11px] text-slate-500">
                {status.custom[s.name] ? "⭐ your recording (live for everyone)" : "built-in recorded effect"}
              </div>
            </div>
            <button
              onClick={() => sound.play(s.name)}
              disabled={busy === s.name}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              aria-label={`Play ${s.label}`}
            >▶️</button>
            <button
              onClick={() => (recording === s.name ? stopRecord() : startRecord(s.name))}
              disabled={busy === s.name}
              className={`rounded-lg px-3 py-2 text-sm ${recording === s.name ? "bg-red-600 animate-pulse" : "bg-slate-800 hover:bg-slate-700"}`}
              aria-label={recording === s.name ? `Stop recording ${s.label} and save it` : `Record your own ${s.label}`}
            >{recording === s.name ? "⏹️" : "🎙️"}</button>
            {recording === s.name && (
              <button
                onClick={cancelRecord}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                aria-label={`Cancel recording ${s.label} without saving`}
              >❌</button>
            )}
            <button
              onClick={() => { pendingName.current = s.name; fileInput.current?.click(); }}
              disabled={busy === s.name}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              aria-label={`Upload a file for ${s.label}`}
            >📁</button>
            {status.custom[s.name] && (
              <button
                onClick={() => reset(s.name)}
                disabled={busy === s.name}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
                aria-label={`Reset ${s.label} to built-in`}
              >↺</button>
            )}
            {busy === s.name && <span className="text-xs text-slate-400">saving…</span>}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Tip: record real objects — wooden dice on a table for 🎲, a coin dropping into a cup for 🪙, a bat hitting a ball for 🏏.
        Files are stored in the arcade&apos;s Supabase database (bg_sounds) — the same real database that powers chat, rooms and matches.
      </p>
    </main>
  );
}
