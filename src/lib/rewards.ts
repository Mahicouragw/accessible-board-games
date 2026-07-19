"use client";

// PlayVerse Rewards — a fair, fully-offline coin & gem economy.
// Earn coins for playing and winning, gems for win streaks — no pay-to-win,
// hard daily caps keep it honest for everyone.
//
// Wired centrally into the SoundEngine so ANY game that plays the "win"
// sound automatically rewards the player (single integration point).

import { announce } from "./a11y";

export type Rewards = {
  coins: number;
  gems: number;
  wins: number;
  played: number;
  streak: number;
  bestStreak: number;
  lastDaily: string;
  rewardedToday: number; // wins rewarded today (fairness cap)
  rewardedDay: string;
};

const KEY = "arcade_rewards_v1";
const COIN_PER_WIN = 15;
const COIN_PER_PLAY = 2;
const GEM_EVERY_STREAK = 3; // every 3-win streak → 1 gem
const DAILY_CLAIM = 25;
const MAX_REWARDED_WINS_PER_DAY = 20; // stops demo-button farming
const WIN_DEBOUNCE_MS = 15_000; // one rewarded win per 15s max

const DEFAULTS: Rewards = {
  coins: 0,
  gems: 0,
  wins: 0,
  played: 0,
  streak: 0,
  bestStreak: 0,
  lastDaily: "",
  rewardedToday: 0,
  rewardedDay: "",
};

let state: Rewards = { ...DEFAULTS };
let lastWinAt = 0;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    state = { ...DEFAULTS };
  }
}
load();

function save() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full/blocked — session rewards still work */
  }
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

export function getRewards(): Rewards {
  return { ...state };
}

export function subscribeRewards(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function currentGame(): string {
  if (typeof window === "undefined") return "game";
  const seg = window.location.pathname.split("/").filter(Boolean);
  return seg[0] === "play" && seg[1] ? seg[1] : seg[0] || "game";
}

function pretty(game: string): string {
  return game.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Called once per game start/interaction that should count as playing. */
export function recordPlay() {
  state.played += 1;
  state.coins += COIN_PER_PLAY;
  emit();
}

/**
 * Called by the SoundEngine whenever a game plays "win" or "lose".
 * Debounced + daily-capped so repeated/manual sound triggers can't farm coins.
 */
export function recordOutcome(kind: "win" | "lose") {
  if (typeof window === "undefined") return;
  const game = pretty(currentGame());
  const now = Date.now();
  const t = today();

  if (state.rewardedDay !== t) {
    state.rewardedDay = t;
    state.rewardedToday = 0;
  }

  if (kind === "lose") {
    state.streak = 0;
    emit();
    return;
  }

  // kind === "win"
  if (now - lastWinAt < WIN_DEBOUNCE_MS) return; // debounce accidental doubles
  lastWinAt = now;

  state.wins += 1;
  emit();

  if (state.rewardedToday >= MAX_REWARDED_WINS_PER_DAY) return;
  state.rewardedToday += 1;
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.coins += COIN_PER_WIN;

  let msg = `🎉 You won ${game}! +${COIN_PER_WIN} coins (wallet: ${state.coins}).`;
  if (state.streak % GEM_EVERY_STREAK === 0) {
    state.gems += 1;
    msg += ` 💎 Win streak ${state.streak} — a gem for you! (${state.gems} total)`;
  }
  emit();
  announce(msg);
}

/** Once-per-day free chest — fair for every player. Returns true if claimed. */
export function claimDailyChest(): boolean {
  const t = today();
  if (state.lastDaily === t) {
    announce("Daily chest already claimed — a new one arrives tomorrow. Fair is fair! ⚖️");
    return false;
  }
  state.lastDaily = t;
  state.coins += DAILY_CLAIM;
  emit();
  announce(`🎁 Daily chest: +${DAILY_CLAIM} coins! You now have ${state.coins} coins and ${state.gems} gems.`);
  return true;
}
