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
      if (!player) {
        // Real auth: a wrong ID must say so (previously it silently faked a login).
        return Response.json({ error: "No player found with that ID. Check the code or register first." }, { status: 404 });
      }
      await store.players.update(player.id, { lastSeen: new Date().toISOString() });
      const scores = await store.scores.forPlayer(player.id);
      return Response.json({ player, scores, cloud: true });
    } catch (e) {
      if (!(e instanceof CloudNotReadyError)) throw e;
      // Cloud not set up yet: keep guest access so solo play never breaks.
      return Response.json({ player: mockPlayer(clean), scores: [], cloud: false });
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
