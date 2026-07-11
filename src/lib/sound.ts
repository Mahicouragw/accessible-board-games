"use client";

// Web Audio powered sound engine — generates all effects & music at runtime,
// so no binary audio assets are required.

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
  | "lose";

type Settings = { sfx: boolean; music: boolean };

const SKEY = "arcade_sound_settings";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  settings: Settings = { sfx: true, music: false };
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(SKEY);
        if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
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
      } catch {
        /* ignore */
      }
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

  play(name: Sfx) {
    if (!this.settings.sfx) return;
    switch (name) {
      case "click":
        this.tone(440, 0.08, "triangle", 0.15);
        break;
      case "select":
        this.tone(660, 0.09, "sine", 0.18);
        break;
      case "move":
        this.tone(330, 0.07, "sine", 0.16);
        break;
      case "turn":
        this.tone(520, 0.1, "triangle", 0.15);
        this.tone(680, 0.1, "triangle", 0.12, 0.06);
        break;
      case "capture":
        this.tone(200, 0.12, "sawtooth", 0.2);
        this.tone(120, 0.18, "square", 0.15, 0.03);
        break;
      case "pocket":
        this.tone(700, 0.08, "sine", 0.2);
        this.tone(950, 0.12, "sine", 0.18, 0.05);
        break;
      case "dice": {
        for (let i = 0; i < 4; i++)
          this.tone(300 + Math.random() * 500, 0.05, "square", 0.1, i * 0.05);
        break;
      }
      case "ladder": {
        const notes = [400, 500, 600, 750, 900];
        notes.forEach((n, i) => this.tone(n, 0.12, "sine", 0.18, i * 0.07));
        break;
      }
      case "snake": {
        const notes = [800, 650, 520, 400, 300];
        notes.forEach((n, i) => this.tone(n, 0.12, "sawtooth", 0.16, i * 0.07));
        break;
      }
      case "win": {
        [523, 659, 784, 1047].forEach((n, i) =>
          this.tone(n, 0.22, "triangle", 0.22, i * 0.12),
        );
        break;
      }
      case "lose": {
        [392, 330, 262].forEach((n, i) =>
          this.tone(n, 0.3, "sine", 0.2, i * 0.16),
        );
        break;
      }
    }
  }

  // ---- Background music: gentle looping arpeggio ----
  private notesSeq = [
    261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23, 440.0, 587.33,
    440.0, 349.23,
  ];

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer) return;
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.06;
      this.musicGain.connect(ctx.destination);
    }
    const beat = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime;
      const freq = this.notesSeq[this.step % this.notesSeq.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.5);
      // bass every 4 steps
      if (this.step % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = "sine";
        bass.frequency.value = freq / 2;
        bg.gain.setValueAtTime(0, t);
        bg.gain.linearRampToValueAtTime(0.4, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        bass.connect(bg).connect(this.musicGain);
        bass.start(t);
        bass.stop(t + 1);
      }
      this.step++;
    };
    beat();
    this.musicTimer = setInterval(beat, 340);
  }

  stopMusic() {
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
}

export const sound =
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine })
    .__arcadeSound ?? new SoundEngine();

if (typeof globalThis !== "undefined") {
  (globalThis as typeof globalThis & { __arcadeSound?: SoundEngine }).__arcadeSound =
    sound;
}
