import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// POST /api/friends/[id] { code, action: "accept" | "decline" }
// Only the request's recipient may answer it.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const { code, action } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const a = action === "accept" ? "accepted" : action === "decline" ? "declined" : null;
    if (!c || !a) return Response.json({ error: "code and action required" }, { status: 400 });

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "register first" }, { status: 404 });
    const rows = await store.friends.forPlayer(me.id);
    const fr = rows.find((f) => Number(f.id) === id);
    if (!fr) return Response.json({ error: "friend request not found" }, { status: 404 });
    if (Number(fr.toId) !== Number(me.id)) {
      return Response.json({ error: "only the recipient can answer this request" }, { status: 403 });
    }
    await store.friends.update(id, { status: a });
    return Response.json({ ok: true, status: a, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json({ error: "Cloud not ready" }, { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
