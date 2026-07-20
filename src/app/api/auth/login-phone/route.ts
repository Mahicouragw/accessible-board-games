import * as LocalDB from "@/lib/local-cloud-db";
import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Login via phone number - for Ludo / Snake & Ladder phone multiplayer.
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const cleanPhone = String(phone ?? "").trim();
    if (!cleanPhone) {
      return Response.json({ error: "Phone number required" }, { status: 400 });
    }
    const last10 = cleanPhone.replace(/\D/g, "").slice(-10);

    try {
      // Exact match first.
      let player = await store.players.findByCode(""); // warm not needed; placeholder replaced below
      const all = await store.players.listAll();
      const found = all.find(
        (p) =>
          p.phone &&
          (p.phone === cleanPhone ||
            (last10 && String(p.phone).replace(/\D/g, "").slice(-10) === last10)),
      );
      if (found) {
        await store.players.update(found.id, { lastSeen: new Date().toISOString() });
        return Response.json({ player: found, scores: [], cloud: true });
      }
      // Not found: auto-register a phone player (same behaviour as guest register).
      let code = genCode();
      for (let i = 0; i < 6; i++) {
        const dup = await store.players.findByCode(code);
        if (!dup) break;
        code = genCode();
      }
      player = await store.players.create({
        name: `Player ${last10.slice(-4) || cleanPhone.slice(-4)}`,
        code, avatar: "📱", phone: cleanPhone,
      });
      return Response.json({ player, scores: [], cloud: true });
    } catch (e) {
      if (!(e instanceof CloudNotReadyError)) throw e;
    }

    // Cloud not ready: local DB fallback (single-device).
    const allPlayers = LocalDB.getAllPlayers();
    const found = allPlayers.find(
      (p) =>
        p.phone &&
        ((last10 && p.phone.includes(last10)) || p.phone === cleanPhone),
    );
    if (found) return Response.json({ player: found, scores: [], cloud: false });
    const player = LocalDB.createPlayer(`Player ${last10.slice(-4) || cleanPhone.slice(-4)}`, cleanPhone);
    return Response.json({ player, scores: [], cloud: false });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to login with phone" }, { status: 500 });
  }
}
