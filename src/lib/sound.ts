"use client";

// Realistic sound engine with real WAV files + Web Audio fallback
// Sounds generated via scripts/generate-sounds.js - realistic dice, token, win, etc.
// Plus background music

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
      // Preload critical sounds
      this.preloadSounds();
    }
  }

  private preloadSounds() {
    if (typeof window === "undefined") return;
    // Preload via HTMLAudio for instant play
    (["click", "dice", "move", "win"] as Sfx[]).forEach(sfx => {
      const file = SOUND_FILES[sfx];
      const audio = new Audio();
      audio.src = file;
      audio.preload = "auto";
      audio.volume = this.settings.volume * 0.8;
      this.audioCache.set(sfx, audio);
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

    const file = SOUND_FILES[name];
    
    // Try to play real sound file first (realistic)
    try {
      if (typeof window !== "undefined") {
        // Try HTMLAudioElement first for low latency
        const cached = this.audioCache.get(name);
        if (cached) {
          const audio = cached.cloneNode() as HTMLAudioElement;
          audio.volume = this.settings.volume * 0.8;
          audio.currentTime = 0;
          await audio.play().catch(() => {});
          return;
        }

        // Fallback to loading file directly
        const audio = new Audio(file);
        audio.volume = this.settings.volume * 0.8;
        audio.preload = "auto";
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            // If file play fails, use Web Audio synthesis fallback
            this.playSynthesis(name);
          });
          return;
        }
      }
    } catch {
      // Fallback to synthesis
    }

    // Fallback: Web Audio synthesis (realistic)
    this.playSynthesis(name);
  }

  private playSynthesis(name: Sfx) {
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
        // Realistic wooden knock with resonance
        this.tone(180, 0.08, "sine", 0.3);
        this.tone(350, 0.06, "triangle", 0.15, 0.01);
        this.tone(700, 0.04, "sine", 0.08, 0.02);
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
        // Realistic dice shake: multiple random frequencies
        for (let i = 0; i < 6; i++) {
          this.tone(200 + Math.random() * 600, 0.06, "square", 0.12, i * 0.06);
        }
        // Final thud
        this.tone(80, 0.15, "sine", 0.3, 0.4);
        break;
      case "ladder":
        // Ascending harp
        [261, 329, 392, 523, 659, 783, 1046].forEach((n, i) =>
          this.tone(n, 0.18, "triangle", 0.22, i * 0.1)
        );
        break;
      case "snake":
        // Descending hiss + slide
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

  // ---- Realistic Background Music ----
  async startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;

    // Try to play real background music file
    if (this.settings.music) {
      try {
        const file = SOUND_FILES.background_music;
        const buffer = await this.loadBuffer(file);
        if (buffer && ctx) {
          if (this.musicBuffer !== buffer) {
            this.musicBuffer = buffer;
          }
          if (!this.musicGain) {
            this.musicGain = ctx.createGain();
            this.musicGain.gain.value = 0.08 * this.settings.volume;
            this.musicGain.connect(ctx.destination);
          }
          // Stop previous
          if (this.musicSource) {
            try { this.musicSource.stop(); } catch {}
          }
          this.musicSource = ctx.createBufferSource();
          this.musicSource.buffer = buffer;
          this.musicSource.loop = true;
          this.musicSource.connect(this.musicGain);
          this.musicSource.start();
          return;
        }
      } catch {
        // Fallback to procedural music
      }
    }

    // Fallback: Procedural lo-fi music
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.06 * this.settings.volume;
      this.musicGain.connect(ctx.destination);
    }

    const notesSeq = [
      130.81, 164.81, 196.00, 261.63, 196.00, 164.81, 146.83, 174.61, 220.00, 293.66,
      220.00, 174.61,
    ];

    const beat = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const freq = notesSeq[this.step % notesSeq.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.4, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(g).connect(this.musicGain!);
      osc.start(t);
      osc.stop(t + 0.7);
      
      if (this.step % 4 === 0) {
        const bass = this.ctx!.createOscillator();
        const bg = this.ctx!.createGain();
        bass.type = "sine";
        bass.frequency.value = freq / 2;
        bg.gain.setValueAtTime(0, t);
        bg.gain.linearRampToValueAtTime(0.3, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        bass.connect(bg).connect(this.musicGain!);
        bass.start(t);
        bass.stop(t + 1.2);
      }
      this.step++;
    };
    
    beat();
    this.musicTimer = setInterval(beat, 420);
  }

  stopMusic() {
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

  // Play with phone number - haptic feedback if available
  async vibrate(pattern: number | number[] = 50) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(pattern);
    }
  }
}

export const sound =
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine })
    .__arcadeSound ?? new SoundEngine();

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine }).__arcadeSound =
    sound;
}
