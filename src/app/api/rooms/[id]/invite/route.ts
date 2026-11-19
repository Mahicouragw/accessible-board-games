import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, opponentCode, opponentName } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const oc = String(opponentCode ?? "").trim().toUpperCase();
    const on = String(opponentName ?? "").trim().slice(0, 24);

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "you must be registered" }, { status: 404 });
    // Resolve the invitee by NAME (friends invite by name — IDs are login-only),
    // falling back to an exact Player ID match.
    let opp = oc ? await store.players.findByCode(oc) : null;
    if (!opp && on) opp = await store.players.findByName(on);
    if (!opp && on) opp = await store.players.findByCode(on.toUpperCase());
    if (!opp) {
      return Response.json(
        { error: on ? `No player named "${on}" is registered yet.` : "player not found" },
        { status: 404 },
      );
    }

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
