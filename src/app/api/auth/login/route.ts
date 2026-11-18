import * as LocalDB from "@/lib/local-cloud-db";
import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

function mockPlayer(code: string) {
  return {
    id: 1, name: "Guest Player", code, avatar: "🎮",
    wins: 0, losses: 0, draws: 0, totalGames: 0, xp: 0,
    createdAt: new Date(), lastSeen: new Date(),
  };
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const clean = String(code ?? "").trim().toUpperCase();
    if (!clean) {
      return Response.json({ error: "Player ID is required" }, { status: 400 });
    }

    let player;
    try {
      player = await store.players.findByCode(clean);
      if (player) {
        await store.players.update(player.id, { lastSeen: new Date().toISOString() });
        const scores = await store.scores.forPlayer(player.id);
        return Response.json({ player, scores, cloud: true });
      }
      // Cloud reachable but ID unknown — check the local DB before saying no
      // (covers offline / not-ready states), then give a real 404.
      const local = LocalDB.getPlayerByCode(clean);
      if (local) return Response.json({ player: local, scores: [], cloud: false });
      return Response.json({ error: "No player found with that ID. Check the code or register first." }, { status: 404 });
    } catch (e) {
      // Cloud unreachable / not set up (any error): local DB, then guest mode,
      // so login never hard-fails.
      if (!(e instanceof CloudNotReadyError)) console.warn("login cloud failed, trying local:", e);
      const local = LocalDB.getPlayerByCode(clean);
      if (local) return Response.json({ player: local, scores: [], cloud: false });
      return Response.json({ player: mockPlayer(clean), scores: [], cloud: false });
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
