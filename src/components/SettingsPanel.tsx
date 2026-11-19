"use client";

// ⚙️ Settings tab — ALL settings in one place:
// sound effects, music, volume, in-game TalkBack voice, mute-all,
// high contrast, font size, narration language, accessibility reset,
// plus links to Sound Studio and the live site.

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { LANGS, getLanguage, setLanguage, type Lang } from "@/lib/i18n";
import { getAiLevel, setAiLevel, type AiLevel } from "@/lib/player-prefs";

function Toggle({
  on,
  onChange,
  label,
  icon,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      aria-label={label}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
        on ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-800/60"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-lg">{icon}</span> {label}
      </span>
      <span className={`text-xs font-bold ${on ? "text-emerald-400" : "text-slate-500"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export default function SettingsPanel() {
  const { player, logout } = useSession();
  const settings = useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.settings,
    () => ({ sfx: true, music: false, volume: 0.7, voice: true }),
  );
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [lang, setLang] = useState<Lang>("en");
  const [muted, setMuted] = useState(false);
  const [aiLevel, setAiLevelState] = useState<AiLevel>("smart");

  useEffect(() => {
    setHighContrast(localStorage.getItem("a11y-highContrast") === "true");
    setFontSize(parseInt(localStorage.getItem("a11y-fontSize") || "16", 10));
    setLang(getLanguage());
    setMuted(localStorage.getItem("arcade_muted") === "true");
    setAiLevelState(getAiLevel());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", highContrast ? "high-contrast" : "light");
    document.documentElement.style.setProperty("--font-size", `${fontSize}px`);
    localStorage.setItem("a11y-highContrast", String(highContrast));
    localStorage.setItem("a11y-fontSize", String(fontSize));
  }, [highContrast, fontSize]);

  // Master mute: turns off sfx + music + voice together.
  useEffect(() => {
    localStorage.setItem("arcade_muted", String(muted));
    if (muted) {
      sound.stopAll();
    }
  }, [muted]);

  const applyMute = (v: boolean) => {
    setMuted(v);
    if (v) {
      sound.stopAll();
      announce("All sound muted.");
    } else {
      sound.setSfx(true);
      announce("Sound unmuted.");
    }
  };

  const sfxOn = settings.sfx && !muted;
  const musicOn = settings.music && !muted;
  const voiceOn = settings.voice && !muted;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Sound & music */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🔊 Sound & Music</h3>
        <div className="mt-4 space-y-3">
          <Toggle on={muted} onChange={(v) => applyMute(!v)} label="Mute everything" icon="🔕" />
          <Toggle on={sfxOn} onChange={(v) => { if (!muted) sound.setSfx(v); announce(v ? "Sound effects on" : "Sound effects off"); }} label="Sound effects (real recordings)" icon="🔔" />
          <Toggle on={musicOn} onChange={(v) => { if (!muted) sound.setMusic(v); announce(v ? "Music on" : "Music off"); }} label="Background music" icon="🎵" />
          <Toggle on={voiceOn} onChange={(v) => { if (!muted) sound.setVoice(v); }} label="🎙️ In-game TalkBack voice (speaks every move)" icon="🗣️" />
          <label className="block text-sm font-medium text-slate-300">
            Volume 🔉
            <input
              type="range" min={0} max={100} value={Math.round(settings.volume * 100)}
              onChange={(e) => sound.setVolume(Number(e.target.value) / 100)}
              aria-label="Volume"
              className="mt-2 w-full accent-sky-500"
            />
          </label>
          <Link
            href="/sound-studio"
            className="block rounded-2xl border border-sky-700/50 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/20"
          >
            🎛️ Sound Studio — record/upload your own real sound effects
          </Link>
        </div>
      </section>

      {/* Accessibility */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">♿ Accessibility</h3>
        <div className="mt-4 space-y-3">
          <Toggle on={highContrast} onChange={(v) => { setHighContrast(v); announce(v ? "High contrast on" : "High contrast off"); }} label="High contrast" icon="🌑" />
          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            <span className="text-sm font-semibold">Text size: {fontSize}px</span>
            <span className="flex gap-2">
              <button onClick={() => { const n = Math.max(14, fontSize - 2); setFontSize(n); announce(`Font size ${n}`); }} aria-label="Decrease font size" className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-bold">A−</button>
              <button onClick={() => { const n = Math.min(24, fontSize + 2); setFontSize(n); announce(`Font size ${n}`); }} aria-label="Increase font size" className="rounded-lg bg-slate-700 px-3 py-1 text-sm font-bold">A+</button>
            </span>
          </div>
          <label className="block text-sm font-medium text-slate-300">
            🗣️ Narration language
            <select
              value={lang}
              onChange={(e) => {
                const l = e.target.value as Lang;
                setLang(l);
                setLanguage(l);
                const label = LANGS.find((x) => x.id === l);
                sound.speak(`Narration language: ${label?.native ?? l}`);
                announce(`Narration language: ${label?.native ?? l}`);
              }}
              aria-label="Narration language"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.native} ({l.id})</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setHighContrast(false); setFontSize(16);
              sound.setSfx(true); sound.setMusic(false); sound.setVoice(true); setMuted(false);
              setAiLevelState("smart"); setAiLevel("smart"); setLanguage("en"); setLang("en");
              announce("All settings reset to defaults.");
              sound.play("click");
            }}
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            ↺ Reset all settings
          </button>
          <p className="text-xs text-slate-500">
            Gestures: in every game, swipe to scan/act and tap to select — game gestures never leak to the home screen. Captions show every announcement on screen too.
          </p>
        </div>
      </section>

      {/* Game settings */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-bold">🎮 Game Settings</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-300">
            🤖 AI opponent strength
            <select
              value={aiLevel}
              onChange={(e) => {
                const l = e.target.value as AiLevel;
                setAiLevelState(l);
                setAiLevel(l);
                announce(`AI opponent: ${l === "easy" ? "Easy — it sometimes plays a random move" : "Smart — it plays its best moves"}`);
              }}
              aria-label="AI opponent strength"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            >
              <option value="smart">🧠 Smart (best moves)</option>
              <option value="easy">😊 Easy (random moves sometimes)</option>
            </select>
          </label>
          <button
            onClick={() => {
              localStorage.removeItem("arcade_guest_player");
              announce("Local progress on this device was reset. Cloud account and scores are untouched.");
              sound.play("click");
            }}
            className="w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            🗑️ Reset progress on this device (cloud account kept)
          </button>
          <p className="text-xs text-slate-500">
            Local multiplayer (2 or 4 players on one device) lives in the 🌐 Multiplayer tab — Ludo, Snake &amp; Ladder and Carrom support pass-and-play.
          </p>
        </div>
      </section>

      {/* Account & links */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
        <h3 className="text-lg font-bold">👤 Account & Links</h3>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-xl bg-slate-800 px-4 py-2">{player?.avatar} <b>{player?.name}</b></span>
          <span className="rounded-xl bg-slate-800 px-4 py-2 font-mono text-emerald-400">ID: {player?.code}</span>
          <a href="https://accessible-board-games.vercel.app" target="_blank" rel="noreferrer" className="rounded-xl border border-sky-700 bg-sky-500/15 px-4 py-2 font-semibold text-sky-300 hover:bg-sky-500/30">
            🌐 Live site ↗
          </a>
          <button onClick={logout} className="rounded-xl border border-rose-700/60 bg-rose-500/10 px-4 py-2 font-semibold text-rose-300 hover:bg-rose-500/20">
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
