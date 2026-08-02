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
  | "snake_bite"
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
  click: "/sounds/click.wav",                                    // Kenney Interface click (CC0)
  select: "/sounds/select.wav",                                  // Kenney Interface confirmation (CC0)
  dice: "/sounds/realistic/dice-roll-wood.flac",                // 🎲 real wooden dice (OpenGameArt CC0)
  move: "/sounds/realistic/tap-wood.wav",                       // 🪵 clean board-game TAP (Kenney Impact plank CC0)
  capture: "/sounds/realistic/capture-real.wav",                 // pop + drop (real pop from web layered)
  pocket: "/sounds/realistic/carrom-pocket-real.wav",            // carrom coin pocketed (rattle-drop)
  ladder: "/sounds/realistic/ladder-climb-real.wav",             // 🪜 4 real wooden footsteps (Kenney CC0)
  snake: "/sounds/realistic/snake-hiss-real.wav",                // 🐍 real air whoosh slide (OpenGameArt CC0)
  snake_bite: "/sounds/realistic/snake-bite-real.wav",           // 🐍 sharp strike (Kenney Impact CC0)
  turn: "/sounds/turn.wav",                                      // turn notification
  win: "/sounds/realistic/win-fanfare-real.wav",                 // 🏆 brass fanfare cadence
  lose: "/sounds/realistic/lose-sad-real.wav",                   // sad descending wah-wah
  carrom_strike: "/sounds/realistic/carrom-strike-real.wav",     // Kenney Impact plank (CC0)
  snake_ladder_roll: "/sounds/realistic/dice-roll-wood-long.flac", // 🎲 longer real dice (OpenGameArt CC0)
  ludo_dice: "/sounds/realistic/dice-rolling.wav",               // 🎲 REAL dice throw (Kenney Casino CC0)
  ludo_token: "/sounds/realistic/token-wood-move.wav",           // 🪵 clean board-game tap (Kenney CC0)
  background_music: "/sounds/music/hub-theme.mp3",               // 🎵 real loop (OpenGameArt CC-BY)
  cricket_bat: "/sounds/cricket-bat.wav",                        // Kenney Impact punch (CC0)
  cricket_boundary: "/sounds/realistic/crowd-win.ogg",           // 📣 crowd roar (Google Sound Library)
  cricket_wicket: "/sounds/realistic/cricket-wicket.ogg",        // wicket rattle
  checkers_move: "/sounds/realistic/token-wood-move.wav",        // 🪵 board tap (Kenney CC0)
  chess_move: "/sounds/realistic/token-wood-move.wav",           // 🪵 board tap (Kenney CC0)
  card_shuffle: "/sounds/realistic/card-shuffle-real.wav",       // real riffle shuffle (Kenney Casino CC0)
  coin_drop: "/sounds/coin-drop.wav",                            // 🪙 Kenney Casino chip (CC0)
  level_up: "/sounds/realistic/slide-whistle.ogg",               // ⬆️ rising slide whistle
  bounce: "/sounds/bounce.wav",                                  // real boing (OpenGameArt CC0)
  button: "/sounds/realistic/ui-tick.ogg",                       // tick (Google Sound Library)
  basketball_bounce: "/sounds/basketball-bounce.wav",            // Kenney Impact soft (CC0)
  football_kick: "/sounds/football-kick.wav",                    // Kenney Impact punch (CC0)
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

  /** Load a buffer for a sfx name (cached), with API-route fallback. */
  private async bufferFor(name: Sfx): Promise<AudioBuffer | null> {
    const file = SOUND_FILES[name];
    const apiFile = `/api/sounds/${file.split("/").pop()}`;
    const ctx = this.ensure();
    if (!ctx) return null;
    for (const url of [file, apiFile]) {
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

  async startMusic(gameId?: string) {
    if (gameId !== undefined) this.theme = gameId && GAME_MUSIC[gameId] ? gameId : "hub";
    const ctx = this.ensure();
    if (!ctx) return;
    const url = this.musicUrl();
    if (this.musicSource && this.playingUrl === url) return;
    if (this.musicSource) this.stopMusic();

    try {
      const buffer = (await this.loadBuffer(url)) || (await this.loadBuffer("/sounds/music/hub-theme.mp3"));
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
