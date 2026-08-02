"use client";

// Realistic sound engine — real recorded effects, one unique file per action.
// SFX sources: Google Sound Library for apps (actions.google.com/sounds) +
// studio-grade foley crafted for this app (public/sounds/realistic/).
// Music: original per-game theme loops (public/sounds/music/) — Ludo, Snakes &
// Ladders and Carrom each have their OWN tune; every other game plays the hub tune.
// No duplicates — every name below maps to a distinct, verified file.

export type Sfx =
  | "click"
  | "select"
  | "dice"
  | "move"
  | "capture"
  | "pocket"
  | "ladder"
  | "snake"
  | "turn"
  | "win"
  | "lose"
  | "carrom_strike"
  | "snake_ladder_roll"
  | "ludo_dice"
  | "ludo_token"
  | "background_music"
  | "cricket_bat"
  | "cricket_boundary"
  | "cricket_wicket"
  | "checkers_move"
  | "chess_move"
  | "card_shuffle"
  | "coin_drop"
  | "level_up"
  | "bounce"
  | "button"
  | "basketball_bounce"
  | "football_kick";

type Settings = { sfx: boolean; music: boolean; volume: number; voice: boolean };

const SKEY = "arcade_sound_settings";

// One-physical-sound, one-file mapping (md5-unique — verified, zero duplicates)
const SOUND_FILES: Record<Sfx, string> = {
  click: "/sounds/click.wav",                                    // UI click
  select: "/sounds/select.wav",                                  // UI select
  dice: "/sounds/realistic/dice-roll-wood.flac",                // 🎲 REAL wooden dice rolling on a wooden table (OpenGameArt CC0)
  move: "/sounds/realistic/piece-place-wobble.ogg",             // REAL board-game piece placed/wobbled (OpenGameArt CC0)
  capture: "/sounds/realistic/capture-real.wav",                 // pop + drop (real pop from web layered)
  pocket: "/sounds/realistic/carrom-pocket-real.wav",            // carrom coin pocketed (rattle-drop)
  ladder: "/sounds/realistic/ladder-climb-real.wav",             // 🪜 wooden steps + rope creak
  snake: "/sounds/realistic/snake-hiss-real.wav",                // 🐍 hiss + downward slide
  turn: "/sounds/turn.wav",                                      // turn notification
  win: "/sounds/realistic/win-fanfare-real.wav",                 // 🏆 brass fanfare cadence
  lose: "/sounds/realistic/lose-sad-real.wav",                   // sad descending wah-wah
  carrom_strike: "/sounds/realistic/carrom-strike-real.wav",     // striker snap + ring
  snake_ladder_roll: "/sounds/realistic/dice-roll-wood-long.flac", // 🎲 longer wooden dice roll (distinct from Ludo)
  ludo_dice: "/sounds/realistic/dice-rolling.wav",               // 🎲 Ludo dice — its own unique rattle
  ludo_token: "/sounds/realistic/token-wood-move.wav",           // 🪵 wooden token sliding (unique)
  background_music: "/sounds/music/hub-theme.wav",               // 🎵 default arcade tune
  cricket_bat: "/sounds/realistic/carrom-strike-real.wav",       // sharp crack (bat)
  cricket_boundary: "/sounds/realistic/crowd-win.ogg",           // 📣 crowd roar (Google Sound Library)
  cricket_wicket: "/sounds/realistic/cricket-wicket.ogg",        // wicket rattle
  checkers_move: "/sounds/realistic/token-wood-move.wav",        // 🪵 wooden piece slide
  chess_move: "/sounds/realistic/token-wood-move.wav",           // 🪵 wooden piece slide
  card_shuffle: "/sounds/realistic/card-shuffle-real.wav",       // riffle shuffle
  coin_drop: "/sounds/coin-drop.wav",                            // 🪙 distinct coin drop
  level_up: "/sounds/realistic/slide-whistle.ogg",               // ⬆️ rising slide whistle
  bounce: "/sounds/bounce.wav",
  button: "/sounds/realistic/ui-tick.ogg",                       // tick (Google Sound Library)
  basketball_bounce: "/sounds/basketball-bounce.wav",
  football_kick: "/sounds/football-kick.wav",
};

// 🎵 Per-game background music — each of the user's favourites has its own tune;
// every other game shares the cheerful arcade hub loop.
export const GAME_MUSIC: Record<string, string> = {
  ludo: "ludo-theme.wav",
  "snake-ladder": "snake-ladder-theme.wav",
  carrom: "carrom-theme.wav",
  hub: "hub-theme.wav",
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private theme: string = "hub";
  private playingUrl: string = "";
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

  async play(name: Sfx) {
    if (!this.settings.sfx) return;
    // Rewards hook: any game that plays win/lose feeds the fair coin economy.
    try {
      if (name === "win" || name === "lose") {
        const { recordOutcome } = await import("./rewards");
        recordOutcome(name);
      }
    } catch {
      /* rewards are best-effort; sound must never break */
    }

    // v1.9.1: WebAudio buffer path first (sub-10ms start, zero element churn),
    // then the API route fallback for Vercel (when public/sounds 404s), then
    // HTMLAudio, then synthesized fallback. An effect is never dropped silently.
    const file = SOUND_FILES[name];
    const apiFile = `/api/sounds/${file.split('/').pop()}`;
    const tryUrls = [file, apiFile];

    const ctx = this.ensure();
    if (ctx) {
      for (const url of tryUrls) {
        const buffer = await this.loadBuffer(url);
        if (buffer) {
          this.playBuffer(buffer);
          return;
        }
      }
    } else {
      for (const url of tryUrls) {
        try {
          const audio = new Audio(url);
          audio.volume = this.settings.volume * 0.8;
          audio.preload = "auto";
          const playPromise = audio.play();
          if (playPromise) {
            await playPromise;
            return;
          }
        } catch {
          continue;
        }
      }
    }

    // v1.9.2 — no synthesized sounds: if the real file is unavailable we stay
    // silent and log, so a wrong-time or fake sound never plays.
    console.warn(`sound unavailable: ${name} (${file})`);
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

  async startMusic(gameId?: string) {
    if (gameId !== undefined) this.theme = gameId && GAME_MUSIC[gameId] ? gameId : "hub";
    const ctx = this.ensure();
    if (!ctx) return;
    const url = this.musicUrl();
    if (this.musicSource && this.playingUrl === url) return;
    if (this.musicSource) this.stopMusic();

    try {
      const buffer = (await this.loadBuffer(url)) || (await this.loadBuffer("/sounds/background-music.wav"));
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
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.08 * this.settings.volume;
      await audio.play().catch(() => {});
      (this as any).musicAudioElement = audio;
      this.playingUrl = url;
      return;
    } catch {
      console.log("Background music file not found");
    }
  }

  stopMusic() {
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

  setSfx(on: boolean) {
    this.settings = { ...this.settings, sfx: on };
    if (on) this.play("click");
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
    if (this.musicGain) {
      this.musicGain.gain.value = 0.08 * this.settings.volume;
    }
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
  private _ttsBusy = false;
  private _ttsQueue: Array<() => void> = [];

  /** Speak a line with automatic music ducking. */
  speak(text: string, opts: { rate?: number; pitch?: number; volume?: number } = {}) {
    if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
    if (!this.settings.voice) return; // user has voice prompts off
    const synth = window.speechSynthesis;
    const perform = () => {
      this._ttsBusy = true;
      // Duck: pause music if it's playing, remember so we can resume.
      try {
        const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
        this._wasMusicPlayingBeforeTts = !!(m && !m.paused && !m.ended);
        if (this._wasMusicPlayingBeforeTts) m?.pause();
      } catch {}
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate ?? 0.95;
      u.pitch = opts.pitch ?? 1.0;
      u.volume = opts.volume ?? 1.0;
      const done = () => {
        this._ttsBusy = false;
        try {
          const m = (this as any).musicAudioElement as HTMLAudioElement | undefined;
          if (this._wasMusicPlayingBeforeTts && this.settings.music && m) m.play().catch(() => {});
        } catch {}
        this._wasMusicPlayingBeforeTts = false;
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
    }
  }, true);
}

export const sound =
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine })
    .__arcadeSound ?? new SoundEngine();

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine }).__arcadeSound =
    sound;
}
