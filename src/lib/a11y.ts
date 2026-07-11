"use client";

// Screen-reader / TalkBack announcements via an ARIA live region.
// Works with Android TalkBack, VoiceOver, NVDA, etc.

let region: HTMLElement | null = null;

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
  const r = ensureRegion();
  if (!r) return;
  // Clear then set so repeated identical messages are still read aloud.
  r.textContent = "";
  window.setTimeout(() => {
    if (r) r.textContent = message;
  }, 60);
}
