import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Poll signals addressed to me (or broadcast), not sent by me.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    const after = Number(searchParams.get("after") ?? 0);

    const me = await store.players.findByCode(code);
    if (!me) return Response.json({ signals: [] });

    const signals = await store.signals.forPlayer(roomId, me.id, after);
    return Response.json({ signals, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ signals: [], cloud: false });
  }
}

// Post a signal (offer/answer/ice/hangup).
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, toId, kind, payload } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "player not found" }, { status: 404 });

    const sig = await store.signals.insert({
      roomId, fromId: me.id, toId: Number(toId) || 0,
      kind: String(kind), payload: payload ?? null,
    });
    return Response.json({ signal: { id: sig?.id ?? null }, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
