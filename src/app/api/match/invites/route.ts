import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Pending challenges waiting for me to accept.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    if (!code) return Response.json({ invites: [] });

    const me = await store.players.findByCode(code);
    if (!me) return Response.json({ invites: [] });

    const invites = await store.matches.invitesFor(me.id);
    return Response.json({ invites, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ invites: [], cloud: false });
  }
}
