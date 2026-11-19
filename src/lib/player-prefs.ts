"use client";

// Player preferences stored on this device (game settings).

export type AiLevel = "easy" | "smart";

const AI_KEY = "arcade_ai_level";

/** AI opponent strength chosen in Settings → Game settings. Default: smart. */
export function getAiLevel(): AiLevel {
  if (typeof window === "undefined") return "smart";
  return window.localStorage.getItem(AI_KEY) === "easy" ? "easy" : "smart";
}

export function setAiLevel(level: AiLevel) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_KEY, level);
  window.dispatchEvent(new CustomEvent("arcade:ai-level", { detail: level }));
}
