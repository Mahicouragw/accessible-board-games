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

// Visible caption: even when the device has no TTS engine (some WebViews) or
// the voice is off, the announcement is still SHOWN as a banner — the game
// always gives feedback, with or without system TalkBack.
let caption: HTMLElement | null = null;
let captionTimer: number | undefined;

function showCaption(message: string) {
  if (typeof document === "undefined") return;
  if (!caption || !document.body.contains(caption)) {
    caption = document.createElement("div");
    caption.id = "a11y-caption";
    caption.setAttribute("aria-hidden", "true");
    caption.style.cssText =
      "position:fixed;left:50%;bottom:76px;transform:translateX(-50%);max-width:92vw;" +
      "background:rgba(15,23,42,.95);color:#e2e8f0;border:1px solid #38bdf8;border-radius:14px;" +
      "padding:10px 16px;font-size:15px;font-weight:600;text-align:center;z-index:99999;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.5);pointer-events:none;transition:opacity .25s;";
    document.body.appendChild(caption);
  }
  caption.textContent = message;
  caption.style.opacity = "1";
  window.clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => {
    if (caption) caption.style.opacity = "0";
  }, 3600);
}

export function announce(message: string) {
  // 1. Speak aloud (in-game TalkBack voice) — no-op when the voice is off.
  try {
    sound.speak(message);
  } catch {}
  // 2. Visible caption banner (works even with no TTS / no system TalkBack).
  try {
    showCaption(message);
  } catch {}
  // 3. ARIA live region for system screen readers.
  const r = ensureRegion();
  if (!r) return;
  // Clear then set so repeated identical messages are still read aloud.
  r.textContent = "";
  window.setTimeout(() => {
    if (r) r.textContent = message;
  }, 60);
}
