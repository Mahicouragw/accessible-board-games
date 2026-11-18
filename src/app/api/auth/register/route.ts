import * as LocalDB from "@/lib/local-cloud-db";
import { store, CloudNotReadyError } from "@/lib/cloud-store";
import { hashAnswer } from "@/lib/secret";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const AVATARS = ["🦊","🐼","🦁","🐸","🐵","🐯","🦄","🐙","🐳","🦉","🐲","🦖","🐧","🐨"];

// Register: NAME + secret question/answer only (no phone number needed).
// The secret Q/A is the account-recovery method if the Player ID is forgotten.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 24);
  const secretQ = String(body.secretQ ?? "").trim().slice(0, 120);
  const secretA = String(body.secretA ?? "").trim();
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!secretQ || !secretA) {
    return Response.json({ error: "Please choose a secret question and answer — they recover your Player ID if you forget it." }, { status: 400 });
  }
  const aHash = hashAnswer(secretA);

  try {
    // Live cloud: unique login code, shared across devices.
    let code = genCode();
    for (let i = 0; i < 6; i++) {
      const dup = await store.players.findByCode(code);
      if (!dup) break;
      code = genCode();
    }
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const player = await store.players.create({
      name,
      code,
      avatar,
      secretQ,
      secretAHash: aHash,
    });
    return Response.json({ player, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error("register cloud failed:", e);
    // Offline / setup fallback: local player so solo games keep working.
    const player = LocalDB.createPlayer(name, undefined, { q: secretQ, aHash });
    return Response.json({ player, cloud: false });
  }
}
