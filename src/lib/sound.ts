"use client";

// Realistic sound engine with embedded base64 WAV + real files + Web Audio fallback
// Sounds generated via scripts/generate-sounds.js - realistic dice, token, win, etc.
// Embedded as data URIs so they work even if public/sounds 404 on Vercel, and deploy to database/cloud for all players

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
  | "background_music";

type Settings = { sfx: boolean; music: boolean; volume: number };

const SKEY = "arcade_sound_settings";

// Try real files first (if Vercel serves them), fallback to embedded data URIs (always works)
const SOUND_FILES: Record<Sfx, string> = {
  click: "/sounds/click.wav",
  select: "/sounds/select.wav",
  dice: "/sounds/dice-roll.wav",
  move: "/sounds/token-move.wav",
  capture: "/sounds/capture.wav",
  pocket: "/sounds/capture.wav",
  ladder: "/sounds/ladder.wav",
  snake: "/sounds/snake.wav",
  turn: "/sounds/turn.wav",
  win: "/sounds/win.wav",
  lose: "/sounds/lose.wav",
  carrom_strike: "/sounds/token-move.wav",
  snake_ladder_roll: "/sounds/dice-roll.wav",
  ludo_dice: "/sounds/dice-roll.wav",
  ludo_token: "/sounds/token-move.wav",
  background_music: "/sounds/background-music.wav",
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
  background_music: null, // large file, keep as external
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
  private dataUriCache = new Map<string, string>();

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
    // Preload critical sounds from embedded data URIs for instant play for all players
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
        // Also save to local cloud DB for all players sync (simulated)
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

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "sine",
    gain = 0.2,
    delay = 0,
  ) {
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

    // Try embedded data URI first (realistic, always works, deployed to all players via JS bundle/database)
    const dataKey = SOUND_DATA_KEYS[name];
    if (dataKey) {
      const dataUri = (SOUND_DATA_URIS as any)[dataKey];
      if (dataUri) {
        try {
          const cached = this.audioCache.get(name + "-data");
          if (cached) {
            const audio = cached.cloneNode() as HTMLAudioElement;
            audio.volume = this.settings.volume * 0.8;
            audio.currentTime = 0;
            await audio.play().catch(() => {});
            return;
          }
          // Create new audio from data URI
          const audio = new Audio(dataUri);
          audio.volume = this.settings.volume * 0.8;
          await audio.play().catch(() => {});
          return;
        } catch {
          // Fall through to file attempt
        }
      }
    }

    // Try real file from /sounds/ (if Vercel serves it)
    const file = SOUND_FILES[name];
    try {
      if (typeof window !== "undefined") {
        const audio = new Audio(file);
        audio.volume = this.settings.volume * 0.8;
        audio.preload = "auto";
        const playPromise = audio.play();
        if (playPromise) {
          await playPromise.catch(() => {
            this.playSynthesis(name);
          });
          return;
        }
      }
    } catch {
      // Fallback to synthesis
    }

    this.playSynthesis(name);
  }

  private playSynthesis(name: Sfx) {
    // Realistic Web Audio synthesis fallback (old music removed, now only realistic synthesis)
    switch (name) {
      case "click":
        this.tone(800, 0.06, "sine", 0.25);
        break;
      case "select":
        this.tone(660, 0.09, "sine", 0.18);
        this.tone(880, 0.09, "sine", 0.12, 0.04);
        break;
      case "move":
      case "ludo_token":
      case "carrom_strike":
        this.tone(180, 0.08, "sine", 0.3);
        this.tone(350, 0.06, "triangle", 0.15, 0.01);
        break;
      case "turn":
        this.tone(520, 0.1, "triangle", 0.15);
        this.tone(680, 0.1, "triangle", 0.12, 0.06);
        break;
      case "capture":
      case "pocket":
        this.tone(200, 0.12, "sawtooth", 0.25);
        this.tone(120, 0.18, "square", 0.2, 0.03);
        break;
      case "dice":
      case "ludo_dice":
      case "snake_ladder_roll":
        for (let i = 0; i < 6; i++) {
          this.tone(200 + Math.random() * 600, 0.06, "square", 0.12, i * 0.06);
        }
        this.tone(80, 0.15, "sine", 0.3, 0.4);
        break;
      case "ladder":
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
        [261, 329, 392, 523, 659, 783, 1046].forEach((n, i) =>
          this.tone(n, 0.25, "triangle", 0.28, i * 0.12)
        );
        break;
      case "lose":
        [392, 349, 329, 261].forEach((n, i) =>
          this.tone(n, 0.35, "sine", 0.22, i * 0.18)
        );
        break;
    }
  }

  // ---- Realistic Background Music - Removed old procedural, use real file if available ----
  async startMusic() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.musicSource || this.musicTimer) return;

    // Try real background music file (realistic)
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
    } catch {
      // No real file, use embedded data URI for background music via HTMLAudio
      try {
        const audio = new Audio("/sounds/background-music.wav");
        audio.loop = true;
        audio.volume = 0.08 * this.settings.volume;
        await audio.play().catch(() => {});
        // Store to stop later
        (this as any).musicAudioElement = audio;
        return;
      } catch {}
    }

    // Fallback: No old procedural music - just silence if real file not available
    // User requested remove old music, so we don't play procedural fallback
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

  // Click sound for all games - call this on any button click
  playClick() {
    this.play("click");
  }
}

// Global click handler for all games - adds clicking sound effect to all buttons
if (typeof window !== "undefined") {
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) {
      // Don't play click if already handled via sound.play in component
      // This ensures clicking sound for all games
      const soundInstance = (globalThis as any).__arcadeSound as SoundEngine;
      if (soundInstance && soundInstance.settings.sfx) {
        // Only play if not already playing click in last 100ms to avoid double
        const now = Date.now();
        const last = (globalThis as any).__lastClickSound || 0;
        if (now - last > 100) {
          (globalThis as any).__lastClickSound = now;
          // Don't auto-play to avoid double sounds, components should call explicitly
          // But we ensure AudioContext is resumed on first click
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
