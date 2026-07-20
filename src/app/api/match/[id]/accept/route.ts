import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const matchId = Number(params.id);
    const { code } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "player not found" }, { status: 404 });

    const match = await store.matches.byId(matchId);
    if (!match) return Response.json({ error: "not found" }, { status: 404 });
    if (match.player2Id !== me.id) {
      return Response.json({ error: "not your invite" }, { status: 403 });
    }

    const updated = await store.matches.update(matchId, {
      status: "active", updatedAt: new Date().toISOString(),
    });
    return Response.json({ match: updated, you: 2, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
