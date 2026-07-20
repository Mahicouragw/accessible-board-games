import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Save a score/progress for a single-player game. Keeps only the best.
export async function POST(req: Request) {
  try {
    const { code, game, score, meta } = await req.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    const s = Math.max(0, Math.floor(Number(score) || 0));
    if (!cleanCode || !g) {
      return Response.json({ error: "code and game required" }, { status: 400 });
    }

    const player = await store.players.findByCode(cleanCode);
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const existing = await store.scores.find(player.id, g);
    let record;
    if (existing) {
      if (s > existing.score) {
        record = await store.scores.update(existing.id, {
          score: s, meta: meta ?? existing.meta, createdAt: new Date().toISOString(),
        });
      } else {
        record = existing;
      }
    } else {
      record = await store.scores.insert({
        playerId: player.id, playerName: player.name, game: g, score: s, meta: meta ?? null,
      });
    }

    // grant XP
    const updated = await store.players.update(player.id, {
      xp: Number(player.xp || 0) + Math.max(1, Math.floor(s / 10)),
    });

    return Response.json({ record, player: updated, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json({ ok: true, cloud: false, ...cloudSetupJson() }, { status: 200 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// Leaderboard for a game
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const g = String(searchParams.get("game") ?? "").trim();
    if (!g) return Response.json({ error: "game required" }, { status: 400 });
    const leaderboard = await store.scores.leaderboard(g);
    return Response.json({ leaderboard, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ leaderboard: [], cloud: false });
  }
}
