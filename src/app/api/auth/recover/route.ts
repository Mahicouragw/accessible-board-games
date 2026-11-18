import * as LocalDB from "@/lib/local-cloud-db";
import { store, CloudNotReadyError } from "@/lib/cloud-store";
import { hashAnswer } from "@/lib/secret";

export const dynamic = "force-dynamic";

// Recover a forgotten Player ID: name + secret answer → returns the player
// (with their login code). The answer is hashed before lookup — the raw
// answer is never stored or compared in plaintext.
export async function POST(req: Request) {
  try {
    const { name, answer } = await req.json();
    const cleanName = String(name ?? "").trim().slice(0, 24);
    const cleanAnswer = String(answer ?? "").trim();
    if (!cleanName || !cleanAnswer) {
      return Response.json({ error: "Name and secret answer are required" }, { status: 400 });
    }
    const hash = hashAnswer(cleanAnswer);
    // Try the real cloud database first; on ANY failure (tables not ready,
    // network blip) fall back to the local DB so recovery never breaks.
    try {
      const player = await store.players.findBySecret(cleanName, hash);
      if (player) {
        return Response.json({
          player,
          message: `Found it! Your Player ID is ${player.code}. Use it to log in.`,
          cloud: true,
        });
      }
    } catch (e) {
      if (!(e instanceof CloudNotReadyError)) console.warn("recover cloud failed, trying local:", e);
    }
    const local = LocalDB.findPlayerBySecret(cleanName, hash);
    if (!local) {
      return Response.json({ error: "No account matches that name and secret answer." }, { status: 404 });
    }
    return Response.json({
      player: local,
      message: `Found it! Your Player ID is ${local.code}. Use it to log in.`,
      cloud: false,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Recovery failed. Please try again." }, { status: 500 });
  }
}
