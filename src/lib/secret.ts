import { createHash } from "crypto";

/** SHA-256 so the raw secret answer is never stored. Server-only. */
export function hashAnswer(answer: string): string {
  return createHash("sha256").update(answer.trim().toLowerCase()).digest("hex");
}
