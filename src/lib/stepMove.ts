"use client";

/**
 * v1.9.3 — synchronized per-tile movement.
 *
 * Moves `steps` squares with EXACTLY ONE tap-sound per square, in strict
 * order:  move 1 square → play 1 tap (waits for it to finish) → announce the
 * square → next square. Never plays extra sounds, never overlaps, and the
 * announcement is never delayed ahead of the sound.
 *
 * Games wire `tap` to `sound.playAndWait("move")` and `announceStep` to the
 * TalkBack/aria-live announce() helper.
 */
export async function stepMove(opts: {
  steps: number;
  /** Advance the token by one square (called BEFORE the tap). */
  onStep: (i: number) => void;
  /** Announce the square AFTER the tap finished. */
  announceStep: (i: number) => void;
  /** Play one movement sound; must resolve after the sound ends. */
  tap: () => Promise<void>;
  /** Small pause after each announcement (default 80ms). */
  gapMs?: number;
}): Promise<void> {
  const gapMs = opts.gapMs ?? 80;
  for (let i = 1; i <= opts.steps; i++) {
    opts.onStep(i);
    await opts.tap(); // exactly ONE sound, waits for its real duration
    opts.announceStep(i);
    if (gapMs > 0) await new Promise((r) => setTimeout(r, gapMs));
  }
}
