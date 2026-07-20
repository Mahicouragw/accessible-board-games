import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const clean = String(code ?? "").trim().toUpperCase();
    if (!clean) return Response.json({ error: "code required" }, { status: 400 });
    const player = await store.players.findByCode(clean);
    if (player) {
      await store.players.update(player.id, { lastSeen: new Date().toISOString() });
    }
    return Response.json({ ok: true, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ ok: true, cloud: false });
  }
}
