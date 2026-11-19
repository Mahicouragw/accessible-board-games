"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { sound } from "@/lib/sound";
import { useSession } from "@/lib/session";
import { isAdminName } from "@/lib/admin";

export default function AudioControls() {
  const { player } = useSession();
  const settings = useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.settings,
    () => ({ sfx: true, music: false, volume: 0.7, voice: true }),
  );
  const admin = isAdminName(player?.name);

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
      <button
        onClick={() => sound.setVoice(!settings.voice)}
        aria-label={settings.voice ? "Turn off in-game TalkBack voice" : "Turn on in-game TalkBack voice"}
        aria-pressed={settings.voice}
        title="🎙️ In-game TalkBack voice — every move is spoken aloud, no system TalkBack needed"
        className={`grid h-11 w-11 place-items-center rounded-full border text-lg shadow-lg transition ${
          settings.voice
            ? "border-sky-500 bg-sky-500/20 text-sky-300"
            : "border-slate-700 bg-slate-900 text-slate-500"
        }`}
      >
        {settings.voice ? "🎙️" : "🔇🎙️"}
      </button>
      {admin && (
        <Link
          href="/sound-studio"
          aria-label="Sound Studio (admin only) — record or upload real sound effects"
          title="🎛️ Sound Studio (admin only) — replace any sound with your own recording"
          className="grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-900 text-lg text-slate-300 shadow-lg transition hover:bg-slate-800"
        >
          🎛️
        </Link>
      )}
    </div>
  );
}
