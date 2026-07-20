import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const matchId = Number(params.id);
    if (!Number.isFinite(matchId)) {
      return Response.json({ error: "invalid id" }, { status: 400 });
    }
    const match = await store.matches.byId(matchId);
    if (!match) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ match, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// Leave / cancel a waiting match
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const matchId = Number(params.id);
    const match = await store.matches.byId(matchId);
    if (match && (match.status === "waiting" || match.status === "invited")) {
      await store.matches.remove(matchId);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
