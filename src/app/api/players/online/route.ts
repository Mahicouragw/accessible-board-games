import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Players active in the last 60 seconds are considered "online".
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const exclude = String(searchParams.get("exclude") ?? "").trim().toUpperCase();
    const since = new Date(Date.now() - 60_000).toISOString();
    const rows = await store.players.onlineSince(since);
    const players = rows
      .filter((p) => (exclude ? String(p.code).toUpperCase() !== exclude : true))
      .map((p) => ({
        id: p.id, name: p.name, code: p.code, avatar: p.avatar,
        wins: p.wins, losses: p.losses, xp: p.xp,
      }));
    return Response.json({ players, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ players: [], cloud: false });
  }
}
