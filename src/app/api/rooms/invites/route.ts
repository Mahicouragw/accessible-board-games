import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    if (!code) return Response.json({ invites: [] });
    const me = await store.players.findByCode(code);
    if (!me) return Response.json({ invites: [] });
    const invites = await store.roomInvites.forPlayer(me.id);
    return Response.json({ invites, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ invites: [], cloud: false });
  }
}

// Dismiss / accept an invite (removes it).
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (id) await store.roomInvites.remove(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: true });
  }
}
