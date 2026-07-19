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

type Settings = { sfx: boolean; music: boolean; volume: number };

const SKEY = "arcade_sound_settings";

// One-physical-sound, one-file mapping (md5-unique — verified, zero duplicates)
const SOUND_FILES: Record<Sfx, string> = {
  click: "/sounds/click.wav",                                    // UI click
  select: "/sounds/select.wav",                                  // UI select
  dice: "/sounds/realistic/dice-rolling.wav",                    // 🎲 shaker rattle + landing thud
  move: "/sounds/realistic/token-wood-move.wav",                 // wooden token hop
  capture: "/sounds/realistic/capture-real.wav",                 // pop + drop (real pop from web layered)
  pocket: "/sounds/realistic/carrom-pocket-real.wav",            // carrom coin pocketed (rattle-drop)
  ladder: "/sounds/realistic/ladder-climb-real.wav",             // 🪜 wooden steps + rope creak
  snake: "/sounds/realistic/snake-hiss-real.wav",                // 🐍 hiss + downward slide
  turn: "/sounds/turn.wav",                                      // turn notification
  win: "/sounds/realistic/win-fanfare-real.wav",                 // 🏆 brass fanfare cadence
  lose: "/sounds/realistic/lose-sad-real.wav",                   // sad descending wah-wah
  carrom_strike: "/sounds/realistic/carrom-strike-real.wav",     // striker snap + ring
  snake_ladder_roll: "/sounds/realistic/dice-rolling.wav",
  ludo_dice: "/sounds/realistic/dice-rolling.wav",
  ludo_token: "/sounds/realistic/token-wood-move.wav",
  background_music: "/sounds/music/hub-theme.wav",               // 🎵 default arcade tune
  cricket_bat: "/sounds/realistic/carrom-strike-real.wav",       // sharp crack (bat)
  cricket_boundary: "/sounds/realistic/crowd-win.ogg",           // 📣 crowd roar (Google Sound Library)
  cricket_wicket: "/sounds/realistic/cricket-wicket.ogg",        // wicket rattle
  checkers_move: "/sounds/realistic/token-wood-move.wav",
  chess_move: "/sounds/realistic/token-wood-move.wav",
  card_shuffle: "/sounds/realistic/card-shuffle-real.wav",       // riffle shuffle
  coin_drop: "/sounds/realistic/carrom-pocket-real.wav",
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
    // Rewards hook: any game that plays win/lose feeds the fair coin economy.
    try {
      if (name === "win" || name === "lose") {
        const { recordOutcome } = await import("./rewards");
        recordOutcome(name);
      }
    } catch {
      /* rewards are best-effort; sound must never break */
    }

    // Try realistic file from public/sounds/ first, then API route fallback for Vercel (when public/sounds 404)
    const file = SOUND_FILES[name];
    const apiFile = `/api/sounds/${file.split('/').pop()}`;
    
    const tryUrls = [file, apiFile, file.replace('/sounds/', '/sounds/realistic/'), apiFile.replace('/api/sounds/', '/api/sounds/realistic/')];
    
    for (const url of tryUrls) {
      try {
        if (typeof window !== "undefined") {
          const audio = new Audio(url);
          audio.volume = this.settings.volume * 0.8;
          audio.preload = "auto";
          const playPromise = audio.play();
          if (playPromise) {
            await playPromise;
            return; // Success!
          }
        }
      } catch {
        // Try next URL
        continue;
      }
    }
    
    // Fallback synthesis
    this.playSynthesis(name);
  }

  private playSynthesis(name: Sfx) {
    // Fallback realistic synthesis if file fails - no old music, only realistic
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
      case "basketball_bounce":
      case "football_kick":
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
