"use client";

// Announcements for the arcade's IN-GAME TalkBack.
// Every announce() does two things:
//   1. writes to an ARIA live region (so a real system screen reader —
//      Android TalkBack, VoiceOver, NVDA — reads it too), and
//   2. SPEAKS the text aloud via speechSynthesis when the game voice is on,
//      so the games are fully playable with the in-game voice alone, no
//      system TalkBack required.

import { sound } from "./sound";

let region: HTMLElement | null = null;

const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

/** Speak numbers as words: 6 → "six", 21 → "twenty-one", 100 → "one hundred". */
export function numWord(n: number): string {
  n = Math.round(n);
  if (n >= 0 && n < 20) return ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
  }
  if (n === 100) return "one hundred";
  return String(n);
}

function ensureRegion(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (region && document.body.contains(region)) return region;
  region = document.getElementById("a11y-live") as HTMLElement | null;
  if (!region) {
    region = document.createElement("div");
    region.id = "a11y-live";
    region.setAttribute("aria-live", "assertive");
    region.setAttribute("aria-atomic", "true");
    region.setAttribute("role", "status");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;";
    document.body.appendChild(region);
  }
  return region;
}

export function announce(message: string) {
  // 1. Speak aloud (in-game TalkBack voice) — no-op when the voice is off.
  try {
    sound.speak(message);
  } catch {}
  // 2. ARIA live region for system screen readers.
  const r = ensureRegion();
  if (!r) return;
  // Clear then set so repeated identical messages are still read aloud.
  r.textContent = "";
  window.setTimeout(() => {
    if (r) r.textContent = message;
  }, 60);
}
