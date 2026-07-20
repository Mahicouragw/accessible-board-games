import * as LocalDB from "@/lib/local-cloud-db";
import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const AVATARS = ["🦊","🐼","🦁","🐸","🐵","🐯","🦄","🐙","🐳","🦉","🐲","🦖","🐧","🐨"];

export async function POST(req: Request) {
  const { name, phone } = await req.json().catch(() => ({ name: "", phone: "" }));
  const clean = String(name ?? "").trim().slice(0, 24);
  const cleanPhone = String(phone ?? "").trim().slice(0, 20);
  if (!clean) return Response.json({ error: "Name is required" }, { status: 400 });

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
      name: clean, code, avatar, phone: cleanPhone || null,
    });
    return Response.json({ player, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error("register cloud failed:", e);
    // Offline / setup fallback: local guest player so solo games keep working.
    const player = LocalDB.createPlayer(clean, cleanPhone);
    return Response.json({ player, cloud: false });
  }
}
