import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

function mockPlayer(code: string) {
  return {
    id: 1, name: "Guest Player", code, avatar: "🎮",
    wins: 0, losses: 0, draws: 0, totalGames: 0, xp: 0,
    createdAt: new Date(), lastSeen: new Date(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return Response.json({ error: "code required" }, { status: 400 });

  try {
    const player = await store.players.findByCode(code);
    if (!player) return Response.json({ error: "not found" }, { status: 404 });
    const scores = await store.scores.forPlayer(player.id);
    return Response.json({ player, scores, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ player: mockPlayer(code), scores: [], cloud: false });
  }
}
