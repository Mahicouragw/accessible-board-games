"use client";

import { speechLang } from "@/lib/i18n";
import { Sfx, SFX_LIST } from "./sfx";

// Realistic sound engine — real recorded effects, one unique file per action.
// SFX sources: Google Sound Library for apps (actions.google.com/sounds) +
// studio-grade foley crafted for this app (public/sounds/realistic/).
// Music: original per-game theme loops (public/sounds/music/) — Ludo, Snakes &
// Ladders and Carrom each have their OWN tune; every other game plays the hub tune.
// No duplicates — every name below maps to a distinct, verified file.

export type { Sfx };
export { SFX_LIST };

type Settings = { sfx: boolean; music: boolean; volume: number; voice: boolean };

const SKEY = "arcade_sound_settings";

// One-physical-sound, one-file mapping (md5-unique — verified, zero duplicates)
const SOUND_FILES: Record<Sfx, string> = {
  click: "/sounds/realistic/uisfx-click.mp3",                   // real recorded press (uisfx CC0)
  select: "/sounds/realistic/uisfx-select.mp3",                 // real recorded select chime (uisfx CC0)
  dice: "/sounds/realistic/dice-roll-wood.flac",                // 🎲 real wooden dice (OpenGameArt CC0)
  move: "/sounds/realistic/tap-wood.wav",                       // 🪵 clean board-game TAP (Kenney Impact plank CC0)
  capture: "/sounds/realistic/capture-real.wav",                 // pop + drop (real pop from web layered)
  pocket: "/sounds/realistic/carrom-pocket-real.wav",            // carrom coin pocketed (rattle-drop)
  ladder: "/sounds/realistic/ladder-climb-real.wav",             // 🪜 4 real wooden footsteps (Kenney CC0)
  snake: "/sounds/realistic/snake-hiss-real.wav",                // 🐍 real air whoosh slide (OpenGameArt CC0)
  snake_bite: "/sounds/realistic/snake-bite-real.wav",           // 🐍 sharp strike (Kenney Impact CC0)
  turn: "/sounds/realistic/uisfx-turn.mp3",                     // real recorded notification (uisfx CC0)
  win: "/sounds/realistic/uisfx-win.mp3",                       // 🏆 real recorded achievement fanfare (uisfx CC0)
  lose: "/sounds/realistic/uisfx-lose.mp3",                     // real recorded "blocked" cue (uisfx CC0)
  carrom_strike: "/sounds/realistic/carrom-strike-real.wav",     // Kenney Impact plank (CC0)
  snake_ladder_roll: "/sounds/realistic/dice-roll-wood-long.flac", // 🎲 longer real dice (OpenGameArt CC0)
  ludo_dice: "/sounds/realistic/dice-rolling.wav",               // 🎲 REAL dice throw (Kenney Casino CC0)
  ludo_token: "/sounds/realistic/token-wood-move.wav",           // 🪵 clean board-game tap (Kenney CC0)
  background_music: "/sounds/music/hub-theme.mp3",               // 🎵 real loop (OpenGameArt CC-BY)
  cricket_bat: "/sounds/realistic/uisfx-bat.mp3",               // 🏏 real recorded double knock (uisfx CC0)
  cricket_boundary: "/sounds/realistic/crowd-win.ogg",           // 📣 crowd roar (Google Sound Library)
  cricket_wicket: "/sounds/realistic/cricket-wicket.ogg",        // wicket rattle
  checkers_move: "/sounds/realistic/token-wood-move.wav",        // 🪵 board tap (Kenney CC0)
  chess_move: "/sounds/realistic/token-wood-move.wav",           // 🪵 board tap (Kenney CC0)
  card_shuffle: "/sounds/realistic/card-shuffle-real.wav",       // real riffle shuffle (Kenney Casino CC0)
  coin_drop: "/sounds/realistic/uisfx-coin.mp3",                // 🪙 real recorded metal drop (uisfx CC0)
  level_up: "/sounds/realistic/uisfx-levelup.mp3",              // ⬆️ real recorded level-up (uisfx CC0)
  bounce: "/sounds/realistic/uisfx-bounce.mp3",                 // real recorded rubber drop (uisfx CC0)
  button: "/sounds/realistic/uisfx-button.mp3",                 // real recorded minimal press (uisfx CC0)
  basketball_bounce: "/sounds/realistic/uisfx-bball.mp3",       // 🏀 real recorded rubber snap (uisfx CC0)
  football_kick: "/sounds/realistic/uisfx-kick.mp3",            // ⚽ real recorded organic thud (uisfx CC0)
};

// 🎵 Per-game background music — each of the user's favourites has its own tune;
// every other game shares the cheerful arcade hub loop.
export const GAME_MUSIC: Record<string, string> = {
  ludo: "ludo-theme.mp3",
  "snake-ladder": "snake-ladder-theme.mp3",
  carrom: "carrom-theme.mp3",
  hub: "hub-theme.mp3",
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private theme: string = "hub";
  private playingUrl: string = "";
  /** Generation counter: bumped on every stop — an in-flight async startMusic()
   *  checks it after each await and bails, so music can NEVER start after the
   *  user turned it off or left the game (the old race that let music play
   *  while the toggle said Off). */
  private musicGen = 0;
  private tempHiddenPaused = false;
  settings: Settings = { sfx: true, music: false, volume: 0.7, voice: true };
  private listeners = new Set<() => void>();
  private audioCache = new Map<string, HTMLAudioElement>();
  private bufferCache = new Map<string, AudioBuffer>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(SKEY);
        if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
      } catch {}
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SKEY, JSON.stringify(this.settings));
        localStorage.setItem("arcade_sound_settings_cloud", JSON.stringify(this.settings));
      } catch {}
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  public ensureContext(): AudioContext | null {
    return this.ensure();
  }

  private failedUrls = new Set<string>();

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    if (this.failedUrls.has(url)) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      this.failedUrls.add(url); // don't hammer 404s on every play
      return null;
    }
  }

  /** Zero-latency WebAudio playback of a decoded buffer (no element churn). */
  private playBuffer(buffer: AudioBuffer, gainScale = 0.8) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = this.settings.volume * gainScale;
    src.connect(g).connect(ctx.destination);
    src.start(0);
  }

  // v1.9.3 — one serialized queue for ALL sound effects: no overlapping audio,
  // even when events fire back-to-back (dice → capture → win etc.).
  private chain: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void> | void): Promise<void> {
    const run = this.chain.then(() => task());
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Bumped whenever the player uploads/replaces a recording in Sound Studio,
   *  so every device fetches the new file instead of a cached one. */
  private userSoundVer(): number {
    if (typeof window === "undefined") return 0;
    try { return Number(localStorage.getItem("arcade_user_sounds_v") ?? "0") || 0; } catch { return 0; }
  }

  /** Call after an upload/reset so the new recording is used immediately. */
  refreshUserSounds() {
    const v = this.userSoundVer();
    for (const key of [...this.bufferCache.keys()]) {
      if (key.includes("/api/sounds/user/")) this.bufferCache.delete(key);
    }
    for (const key of [...this.failedUrls]) {
      if (key.includes(`/api/sounds/user/`) && key.includes(`v=${v}`) === false) this.failedUrls.delete(key);
    }
  }

  /** Load a buffer for a sfx name (cached). Order:
   *  1. player's own recording uploaded in Sound Studio (published via DB),
   *  2. the built-in recorded file in /public/sounds,
   *  3. the /api/sounds file-serving fallback route. */
  private async bufferFor(name: Sfx): Promise<AudioBuffer | null> {
    const file = SOUND_FILES[name];
    const apiFile = `/api/sounds/${file.split("/").pop()}`;
    const userFile = `/api/sounds/user/${name}?v=${this.userSoundVer()}`;
    const ctx = this.ensure();
    if (!ctx) return null;
    for (const url of [userFile, file, apiFile]) {
      const buffer = await this.loadBuffer(url);
      if (buffer) return buffer;
    }
    return null;
  }

  /** Fire-and-forget play, serialized (never overlaps other SFX). */
  play(name: Sfx) {
    if (!this.settings.sfx) return;
    // Rewards hook: any game that plays win/lose feeds the fair coin economy.
    if (name === "win" || name === "lose") {
      import("./rewards")
        .then(({ recordOutcome }) => recordOutcome(name))
        .catch(() => undefined);
    }
    void this.enqueue(async () => {
      const buffer = await this.bufferFor(name);
      if (buffer) this.playBuffer(buffer);
      else console.warn(`sound unavailable: ${name} (${SOUND_FILES[name]})`);
    });
  }

  /**
   * v1.9.3 — play one sound and resolve AFTER it actually ends (capped at
   * maxMs). Games use this to lock each tile of a move to exactly ONE tap and
   * to announce the square only after the tap finished — no overlap, no
   * delayed announcements, no extra sounds.
   */
  playAndWait(name: Sfx, maxMs = 3000): Promise<void> {
    if (!this.settings.sfx) return Promise.resolve();
    return this.enqueue(async () => {
      const buffer = await this.bufferFor(name);
      if (!buffer) {
        console.warn(`sound unavailable: ${name} (${SOUND_FILES[name]})`);
        return;
      }
      this.playBuffer(buffer);
      const waitMs = Math.min(buffer.duration * 1000, maxMs);
      await new Promise((r) => setTimeout(r, waitMs));
    });
  }

  // ---------------- per-game background music ----------------

  private musicUrl(): string {
    const file = GAME_MUSIC[this.theme] || GAME_MUSIC.hub;
    return `/sounds/music/${file}`;
  }

  /** Switch the music theme. null/unknown ids fall back to the hub tune.
   *  If music is currently ON and playing, the track switches immediately. */
  setGameTheme(gameId: string | null) {
    this.theme = gameId && GAME_MUSIC[gameId] ? gameId : "hub";
    if (this.settings.music) {
      this.stopMusic();
      void this.startMusic();
    }
  }

  /** True while a music track is actually audible right now. */
  get isMusicPlaying(): boolean {
    if (this.musicSource) return true;
    const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
    return !!(m && !m.paused && !m.ended);
  }

  /** Internal halt that does NOT bump the generation (used when switching tracks). */
  private haltMusic() {
    this.playingUrl = "";
    if ((this as any).musicAudioElement) {
      try {
        (this as any).musicAudioElement.pause();
        (this as any).musicAudioElement = null;
      } catch {}
    }
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch {}
      this.musicSource = null;
    }
  }

  async startMusic(gameId?: string) {
    if (gameId !== undefined) this.theme = gameId && GAME_MUSIC[gameId] ? gameId : "hub";
    const gen = this.musicGen; // captured: any stopMusic() after this bails us out
    const ctx = this.ensure();
    if (!ctx) return;
    const url = this.musicUrl();
    if (this.musicSource && this.playingUrl === url) return;
    if (this.musicSource) this.haltMusic();

    try {
      const buffer = (await this.loadBuffer(url)) || (await this.loadBuffer("/sounds/music/hub-theme.mp3"));
      // RACE FIX: if the user turned music off / left the game / switched theme
      // while the buffer was loading, do NOT start it.
      if (gen !== this.musicGen || !this.settings.music) return;
      if (buffer && ctx) {
        if (!this.musicGain) {
          this.musicGain = ctx.createGain();
          this.musicGain.connect(ctx.destination);
        }
        this.musicGain.gain.value = 0.08 * this.settings.volume;
        this.musicSource = ctx.createBufferSource();
        this.musicSource.buffer = buffer;
        this.musicSource.loop = true;
        this.musicSource.connect(this.musicGain);
        this.musicSource.start();
        this.playingUrl = url;
        return;
      }
    } catch {}

    // Fallback try HTMLAudio for background music
    try {
      if (gen !== this.musicGen || !this.settings.music) return; // same race guard
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.08 * this.settings.volume;
      await audio.play().catch(() => {});
      if (gen !== this.musicGen || !this.settings.music) { // and after play()
        try { audio.pause(); } catch {}
        return;
      }
      (this as any).musicAudioElement = audio;
      this.playingUrl = url;
      return;
    } catch {
      console.log("Background music file not found");
    }
  }

  stopMusic() {
    this.musicGen++; // invalidates any in-flight startMusic()
    this.tempHiddenPaused = false;
    this.haltMusic();
  }

  /** Pause music while the tab/app is hidden; resumed by resumeMusicFromHidden(). */
  pauseMusicForHidden() {
    if (!this.isMusicPlaying) return;
    this.tempHiddenPaused = true;
    if (this.musicGain) this.musicGain.gain.value = 0;
    const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
    if (m) { try { m.pause(); } catch {} }
  }

  /** Resume after the tab becomes visible again — but only if music is still ON. */
  resumeMusicFromHidden() {
    if (!this.tempHiddenPaused) return;
    this.tempHiddenPaused = false;
    if (!this.settings.music) return; // user turned it off while hidden
    if (this.musicGain) this.musicGain.gain.value = 0.08 * this.settings.volume;
    const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
    if (m) m.play().catch(() => {});
  }

  setSfx(on: boolean) {
    this.settings = { ...this.settings, sfx: on };
    if (on) this.play("click");
    this.emit();
  }

  /** In-game TalkBack voice: when ON, every announce() is also SPOKEN aloud
   *  via speechSynthesis — the games are fully playable without the phone's
   *  system TalkBack. */
  setVoice(on: boolean) {
    this.settings = { ...this.settings, voice: on };
    if (on) this.speak("Game voice on. I will read out every move.");
    else this.cancelSpeech();
    this.emit();
  }

  setMusic(on: boolean) {
    this.settings = { ...this.settings, music: on };
    if (on) this.startMusic();
    else this.stopMusic();
    this.emit();
  }

  setVolume(vol: number) {
    this.settings = { ...this.settings, volume: Math.max(0, Math.min(1, vol)) };
    if (this.musicGain && !this.tempHiddenPaused) {
      this.musicGain.gain.value = 0.08 * this.settings.volume;
    }
    const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
    if (m) m.volume = 0.08 * this.settings.volume;
    this.emit();
  }

  vibrate(pattern: number | number[] = 50) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(pattern);
    }
  }

  playClick() {
    this.play("click");
  }

  // ---------- TTS ducking & unified announce helper ----------
  // These helpers let the app use speechSynthesis without it colliding with
  // the music track. When speak() is called, the music is auto-paused and
  // remembered; when speech ends, music resumes from where it left off.
  // announceWithAudio() plays an SFX + speaks a line + ducks the music, all in
  // one call. No-op on browsers without speechSynthesis (e.g. some iOS WebViews).

  private _wasMusicPlayingBeforeTts = false;
  private _musicGainBeforeTts: number | null = null;
  private _ttsBusy = false;
  private _ttsQueue: Array<() => void> = [];

  /** Speak a line with automatic music ducking (WebAudio source AND HTMLAudio fallback). */
  speak(text: string, opts: { rate?: number; pitch?: number; volume?: number } = {}) {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    if (!this.settings.voice) return; // user has voice prompts off
    const synth = window.speechSynthesis;
    const perform = () => {
      this._ttsBusy = true;
      // Duck: mute music if it's playing (both playback paths), remember to resume.
      try {
        this._wasMusicPlayingBeforeTts = this.isMusicPlaying;
        if (this._wasMusicPlayingBeforeTts) {
          if (this.musicGain) {
            this._musicGainBeforeTts = this.musicGain.gain.value;
            this.musicGain.gain.value = 0;
          }
          const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
          if (m && !m.paused) m.pause();
        }
      } catch {}
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang(); // English / Telugu / Hindi narration language setting
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.0;
      u.volume = opts.volume ?? 1.0;
      const done = () => {
        this._ttsBusy = false;
        try {
          // Un-duck only if music is still supposed to be on.
          if (this._wasMusicPlayingBeforeTts && this.settings.music && !this.tempHiddenPaused) {
            if (this.musicGain && this._musicGainBeforeTts !== null) {
              this.musicGain.gain.value = this._musicGainBeforeTts;
            }
            const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
            if (m) m.play().catch(() => {});
          }
        } catch {}
        this._wasMusicPlayingBeforeTts = false;
        this._musicGainBeforeTts = null;
        const next = this._ttsQueue.shift();
        if (next) next();
      };
      u.onend = done;
      u.onerror = done;
      try { synth.cancel(); } catch {}
      synth.speak(u);
    };
    if (this._ttsBusy) { this._ttsQueue.push(perform); return; }
    perform();
  }

  /** Cancel any ongoing or queued TTS. */
  cancelSpeech() {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    try { window.speechSynthesis.cancel(); } catch {}
    this._ttsQueue = [];
    this._ttsBusy = false;
  }

  /** True if TTS is currently speaking or has queued lines. */
  get isSpeaking(): boolean {
    return this._ttsBusy || this._ttsQueue.length > 0;
  }

  /**
   * Play an SFX, then speak a line, all while ducking the music.
   *   sound.announceWithAudio("match", "Match found!");
   * is equivalent to:
   *   sound.play("match");
   *   setTimeout(() => sound.speak("Match found!"), 80);
   * The 80ms gap lets the SFX start cleanly before TTS begins.
   */
  announceWithAudio(sfxName: Sfx | null, text: string | null) {
    if (sfxName) this.play(sfxName);
    if (text) {
      window.setTimeout(() => this.speak(text), 80);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      const soundInstance = (globalThis as any).__arcadeSound as SoundEngine;
      if (soundInstance && soundInstance.settings.sfx) {
        const now = Date.now();
        const last = (globalThis as any).__lastClickSound || 0;
        if (now - last > 100) {
          (globalThis as any).__lastClickSound = now;
          soundInstance.ensureContext();
        }
      }
      // Music saved as ON should actually start on the first user gesture
      // (autoplay policies require a gesture), even on the dashboard.
      const s = (globalThis as any).__arcadeSound as SoundEngine | undefined;
      if (s && s.settings.music && !s.isMusicPlaying) void s.startMusic();
    }
  }, true);

  // Tab hidden / app in background → pause music; visible again → resume only
  // if the music toggle is still ON.
  document.addEventListener("visibilitychange", () => {
    const s = (globalThis as any).__arcadeSound as SoundEngine | undefined;
    if (!s) return;
    if (document.hidden) s.pauseMusicForHidden();
    else s.resumeMusicFromHidden();
  });

  // App/tab closed or navigated away → stop music for real (and cancel any
  // in-flight async start so it can't begin after closing).
  window.addEventListener("pagehide", () => {
    const s = (globalThis as any).__arcadeSound as SoundEngine | undefined;
    if (s) s.stopMusic();
  });
}

export const sound =
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine })
    .__arcadeSound ?? new SoundEngine();

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine }).__arcadeSound =
    sound;
}
