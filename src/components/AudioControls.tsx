"use client";

import { useSyncExternalStore } from "react";
import { sound } from "@/lib/sound";

export default function AudioControls() {
  const settings = useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.settings,
    () => ({ sfx: true, music: false }),
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2">
      <button
        onClick={() => sound.setSfx(!settings.sfx)}
        aria-label={settings.sfx ? "Mute sound effects" : "Enable sound effects"}
        aria-pressed={settings.sfx}
        title="Sound effects"
        className={`grid h-11 w-11 place-items-center rounded-full border text-lg shadow-lg transition ${
          settings.sfx
            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
            : "border-slate-700 bg-slate-900 text-slate-500"
        }`}
      >
        {settings.sfx ? "🔊" : "🔇"}
      </button>
      <button
        onClick={() => sound.setMusic(!settings.music)}
        aria-label={settings.music ? "Turn off music" : "Turn on music"}
        aria-pressed={settings.music}
        title="Background music"
        className={`grid h-11 w-11 place-items-center rounded-full border text-lg shadow-lg transition ${
          settings.music
            ? "border-violet-500 bg-violet-500/20 text-violet-300"
            : "border-slate-700 bg-slate-900 text-slate-500"
        }`}
      >
        {settings.music ? "🎵" : "🎶"}
      </button>
    </div>
  );
}
