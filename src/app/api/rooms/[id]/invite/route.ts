import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, opponentCode } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();

    const me = await store.players.findByCode(c);
    const opp = await store.players.findByCode(oc);
    if (!me || !opp) return Response.json({ error: "player not found" }, { status: 404 });

    const room = await store.rooms.byId(roomId);
    if (!room) return Response.json({ error: "room not found" }, { status: 404 });

    // Avoid duplicate pending invites.
    const dup = await store.roomInvites.findDup(roomId, opp.id);
    if (!dup) {
      await store.roomInvites.insert({
        roomId, fromName: me.name, toId: opp.id, game: room.game,
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
