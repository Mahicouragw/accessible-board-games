"use client";

// ♿⚡ Quick accessibility & sound controls — shown on the Home tab AND in the
// sidebar of every game page, so music / sound-effects / TalkBack voice /
// narration language are always one tap away.

import { useSyncExternalStore, useEffect, useState } from "react";
import { sound } from "@/lib/sound";
import { announce } from "@/lib/a11y";
import { LANGS, getLanguage, setLanguage, type Lang } from "@/lib/i18n";

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
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
        on ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-800/60"
      }`}
    >
      <span className="flex items-center gap-2 font-semibold">
        <span aria-hidden>{icon}</span> {label}
      </span>
      <span className={`text-xs font-bold ${on ? "text-emerald-400" : "text-slate-500"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

export default function QuickA11y({ compact = false }: { compact?: boolean }) {
  const settings = useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.settings,
    () => ({ sfx: true, music: false, volume: 0.7, voice: true }),
  );
  const [lang, setLang] = useState<Lang>("en");
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    setLang(getLanguage());
    setHighContrast(localStorage.getItem("a11y-highContrast") === "true");
  }, []);

  return (
    <section
      className="rounded-3xl border border-slate-800 bg-slate-900 p-5"
      aria-label="Accessibility and sound quick settings"
    >
      <h3 className="text-base font-bold">♿ Accessibility & sound</h3>
      <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <Toggle
          on={settings.sfx}
          onChange={(v) => { sound.setSfx(v); announce(v ? "Sound effects on" : "Sound effects off"); }}
          label="Sound effects"
          icon="🔔"
        />
        <Toggle
          on={settings.music}
          onChange={(v) => { sound.setMusic(v); announce(v ? "Music on" : "Music off"); }}
          label="Music"
          icon="🎵"
        />
        <Toggle
          on={settings.voice}
          onChange={(v) => { sound.setVoice(v); announce(v ? "TalkBack voice on" : "TalkBack voice off"); }}
          label="TalkBack voice"
          icon="🎙️"
        />
        <Toggle
          on={highContrast}
          onChange={(v) => {
            setHighContrast(v);
            document.documentElement.setAttribute("data-theme", v ? "high-contrast" : "light");
            localStorage.setItem("a11y-highContrast", String(v));
            announce(v ? "High contrast on" : "High contrast off");
          }}
          label="High contrast"
          icon="🌑"
        />
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-400">
        🗣️ Game TalkBack language
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
          aria-label="Game TalkBack language"
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>{l.native} ({l.id})</option>
          ))}
        </select>
      </label>
    </section>
  );
}
