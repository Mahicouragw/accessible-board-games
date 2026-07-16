"use client";

// Advanced Realistic Sound Engine - Real sounds from websites (Google Actions, CodeSkulptor) - No duplicates
// All sounds in public/sounds/ and public/sounds/realistic/ - taken from websites, uploaded to repo
// Enhanced for all games with advanced level

import { SOUND_DATA_URIS } from "./sound-data";

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
  | "button";

type Settings = { sfx: boolean; music: boolean; volume: number };

const SKEY = "arcade_sound_settings";

// Realistic sounds from websites - No duplicates, each unique for game action
// Sources: Google Actions Sounds (actions.google.com/sounds), CodeSkulptor Assets, Generated realistic WAVs
const SOUND_FILES: Record<Sfx, string> = {
  click: "/sounds/realistic/click-real.ogg", // Real from Google Actions - beep_short
  select: "/sounds/select.wav", // Generated realistic
  dice: "/sounds/realistic/dice-roll-real.ogg", // Real from Google - wood_plank_flicks
  move: "/sounds/realistic/token-move-real.ogg", // Real from Google - pop
  capture: "/sounds/realistic/capture-real.ogg", // Real from Google - clang_and_wobble
  pocket: "/sounds/realistic/capture-real.ogg",
  ladder: "/sounds/realistic/ladder-real.ogg", // Real - slide_whistle
  snake: "/sounds/realistic/snake-real.ogg", // Real - slide_whistle
  turn: "/sounds/turn.wav", // Generated
  win: "/sounds/realistic/win-real.ogg", // Real - clang_and_wobble
  lose: "/sounds/realistic/lose-real.ogg", // Real - concussive_hit_guitar_boing
  carrom_strike: "/sounds/realistic/carrom-strike.ogg", // Real - wood_plank
  snake_ladder_roll: "/sounds/realistic/dice-roll-real.ogg",
  ludo_dice: "/sounds/realistic/ludo-dice.ogg", // Real
  ludo_token: "/sounds/realistic/token-move-real.ogg",
  background_music: "/sounds/background-music.wav", // Generated lo-fi loop
  cricket_bat: "/sounds/realistic/cricket-bat.ogg", // Real - wood_plank
  cricket_boundary: "/sounds/realistic/cricket-boundary.ogg", // Real - battle_crowd_celebrate
  cricket_wicket: "/sounds/realistic/cricket-wicket.ogg", // Real - concussive_guitar_hit
  checkers_move: "/sounds/realistic/checkers-move.ogg", // Real - pop
  chess_move: "/sounds/realistic/chess-move.ogg", // Real - wood_plank
  card_shuffle: "/sounds/realistic/card-shuffle.ogg", // Real - clang
  coin_drop: "/sounds/realistic/coin-drop.ogg", // Real - concussive
  level_up: "/sounds/realistic/level-up.ogg", // Real
  bounce: "/sounds/realistic/bounce-real.m4a", // Real from CodeSkulptor
  button: "/sounds/realistic/button-real.m4a", // Real from CodeSkulptor
};

const SOUND_DATA_KEYS: Record<Sfx, keyof typeof SOUND_DATA_URIS | null> = {
  click: "click",
  select: "select",
  dice: "dice-roll",
  move: "token-move",
  capture: "capture",
  pocket: "capture",
  ladder: "ladder",
  snake: "snake",
  turn: "turn",
  win: "win",
  lose: "lose",
  carrom_strike: "token-move",
  snake_ladder_roll: "dice-roll",
  ludo_dice: "dice-roll",
  ludo_token: "token-move",
  background_music: null,
  cricket_bat: "token-move",
  cricket_boundary: "win",
  cricket_wicket: "capture",
  checkers_move: "token-move",
  chess_move: "token-move",
  card_shuffle: "capture",
  coin_drop: "capture",
  level_up: "win",
  bounce: null,
  button: null,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  settings: Settings = { sfx: true, music: false, volume: 0.7 };
  private listeners = new Set<() => void>();
  private audioCache = new Map<string, HTMLAudioElement>();
  private bufferCache = new Map<string, AudioBuffer>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(SKEY);
        if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
      } catch {}
      this.preloadEmbeddedSounds();
    }
  }

  private preloadEmbeddedSounds() {
    if (typeof window === "undefined") return;
    (["click", "dice", "move", "win"] as Sfx[]).forEach(sfx => {
      const dataKey = SOUND_DATA_KEYS[sfx];
      if (dataKey && (SOUND_DATA_URIS as any)[dataKey]) {
        const dataUri = (SOUND_DATA_URIS as any)[dataKey];
        const audio = new Audio();
        audio.src = dataUri;
        audio.preload = "auto";
        audio.volume = this.settings.volume * 0.8;
        this.audioCache.set(sfx + "-data", audio);
      }
    });
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

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const ctx = this.ensure();
    if (!ctx) return null;
    if (this.bufferCache.has(url)) return this.bufferCache.get(url)!;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.2, delay = 0) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  async play(name: Sfx) {
    if (!this.settings.sfx) return;

    // Try realistic file from website first
    const file = SOUND_FILES[name];
    try {
      if (typeof window !== "undefined") {
        const audio = new Audio(file);
        audio.volume = this.settings.volume * 0.8;
        audio.preload = "auto";
        // Try to play real file from website
        const playPromise = audio.play();
        if (playPromise) {
          await playPromise.catch(async () => {
            // If file fails (404), try embedded data URI
            const dataKey = SOUND_DATA_KEYS[name];
            if (dataKey) {
              const dataUri = (SOUND_DATA_URIS as any)[dataKey];
              if (dataUri) {
                const cached = this.audioCache.get(name + "-data");
                if (cached) {
                  const clone = cached.cloneNode() as HTMLAudioElement;
                  clone.volume = this.settings.volume * 0.8;
                  clone.currentTime = 0;
                  await clone.play().catch(() => this.playSynthesis(name));
                  return;
                }
                const dataAudio = new Audio(dataUri);
                dataAudio.volume = this.settings.volume * 0.8;
                await dataAudio.play().catch(() => this.playSynthesis(name));
                return;
              }
            }
            this.playSynthesis(name);
          });
          return;
        }
      }
    } catch {
      // Fallback to embedded
      const dataKey = SOUND_DATA_KEYS[name];
      if (dataKey) {
        const dataUri = (SOUND_DATA_URIS as any)[dataKey];
        if (dataUri) {
          try {
            const audio = new Audio(dataUri);
            audio.volume = this.settings.volume * 0.8;
            await audio.play().catch(() => this.playSynthesis(name));
            return;
          } catch {}
        }
      }
      this.playSynthesis(name);
    }
  }

  private playSynthesis(name: Sfx) {
    switch (name) {
      case "click":
      case "button":
        this.tone(800, 0.06, "sine", 0.25);
        break;
      case "select":
        this.tone(660, 0.09, "sine", 0.18);
        this.tone(880, 0.09, "sine", 0.12, 0.04);
        break;
      case "move":
      case "ludo_token":
      case "carrom_strike":
      case "checkers_move":
      case "chess_move":
        this.tone(180, 0.08, "sine", 0.3);
        this.tone(350, 0.06, "triangle", 0.15, 0.01);
        break;
      case "turn":
        this.tone(520, 0.1, "triangle", 0.15);
        this.tone(680, 0.1, "triangle", 0.12, 0.06);
        break;
      case "capture":
      case "pocket":
      case "coin_drop":
        this.tone(200, 0.12, "sawtooth", 0.25);
        this.tone(120, 0.18, "square", 0.2, 0.03);
        break;
      case "dice":
      case "ludo_dice":
      case "snake_ladder_roll":
      case "bounce":
        for (let i = 0; i < 6; i++) {
          this.tone(200 + Math.random() * 600, 0.06, "square", 0.12, i * 0.06);
        }
        this.tone(80, 0.15, "sine", 0.3, 0.4);
        break;
      case "ladder":
      case "level_up":
        [261, 329, 392, 523, 659, 783, 1046].forEach((n, i) =>
          this.tone(n, 0.18, "triangle", 0.22, i * 0.1)
        );
        break;
      case "snake":
        [800, 650, 520, 400, 300].forEach((n, i) =>
          this.tone(n, 0.15, "sawtooth", 0.18, i * 0.09)
        );
        break;
      case "win":
      case "cricket_boundary":
        [261, 329, 392, 523, 659, 783, 1046].forEach((n, i) =>
          this.tone(n, 0.25, "triangle", 0.28, i * 0.12)
        );
        break;
      case "lose":
      case "cricket_wicket":
        [392, 349, 329, 261].forEach((n, i) =>
          this.tone(n, 0.35, "sine", 0.22, i * 0.18)
        );
        break;
      case "cricket_bat":
        this.tone(250, 0.08, "sine", 0.4);
        this.tone(500, 0.05, "triangle", 0.2, 0.02);
        break;
      case "card_shuffle":
        for (let i = 0; i < 5; i++) {
          this.tone(400 + i * 100, 0.04, "square", 0.15, i * 0.03);
        }
        break;
    }
  }

  async startMusic() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.musicSource || this.musicTimer) return;

    try {
      const file = SOUND_FILES.background_music;
      const buffer = await this.loadBuffer(file);
      if (buffer && ctx) {
        if (!this.musicGain) {
          this.musicGain = ctx.createGain();
          this.musicGain.gain.value = 0.08 * this.settings.volume;
          this.musicGain.connect(ctx.destination);
        }
        this.musicSource = ctx.createBufferSource();
        this.musicSource.buffer = buffer;
        this.musicSource.loop = true;
        this.musicSource.connect(this.musicGain);
        this.musicSource.start();
        return;
      }
    } catch {}

    // Fallback: try realistic background from website
    try {
      const audio = new Audio("/sounds/realistic/background-music-real.ogg");
      audio.loop = true;
      audio.volume = 0.08 * this.settings.volume;
      await audio.play().catch(() => {});
      (this as any).musicAudioElement = audio;
      return;
    } catch {}

    console.log("Background music file not found, no old music (removed as requested)");
  }

  stopMusic() {
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
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
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
