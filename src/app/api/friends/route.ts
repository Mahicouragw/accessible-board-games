import { store, CloudNotReadyError } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Friends: GET ?code= → { pending: [...], friends: [...] }
//          POST { code, toName } → send a friend request BY NAME
//          (Player IDs are only for logging in — friends invite each other by name.)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
  if (!code) return Response.json({ pending: [], friends: [] });
  try {
    const me = await store.players.findByCode(code);
    if (!me) return Response.json({ pending: [], friends: [] });
    const all = await store.friends.forPlayer(me.id);
    const pending = all.filter((f) => f.status === "pending" && Number(f.toId) === Number(me.id));
    const friends = all.filter((f) => f.status === "accepted");
    return Response.json({ pending, friends, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ pending: [], friends: [], cloud: false });
  }
}

export async function POST(req: Request) {
  try {
    const { code, toName } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const name = String(toName ?? "").trim().slice(0, 24);
    if (!c || !name) return Response.json({ error: "code and toName required" }, { status: 400 });

    const me = await store.players.findByCode(c);
    if (!me) return Response.json({ error: "register first" }, { status: 404 });
    // Resolve the friend by NAME (case-insensitive); fall back to exact ID match.
    let target = await store.players.findByName(name);
    if (!target) target = await store.players.findByCode(name.toUpperCase());
    if (!target) return Response.json({ error: `No player named "${name}" is registered yet.` }, { status: 404 });
    if (Number(target.id) === Number(me.id)) {
      return Response.json({ error: "You cannot add yourself" }, { status: 400 });
    }
    const dup = await store.friends.findDup(me.id, target.id);
    if (dup) {
      return Response.json({
        ok: true,
        already: true,
        status: dup.status,
        message: dup.status === "accepted" ? `You are already friends with ${target.name}.` : `Friend request to ${target.name} is already ${dup.status}.`,
      });
    }
    await store.friends.insert({
      fromId: me.id, fromName: me.name,
      toId: target.id, toName: target.name,
      status: "pending",
    });
    return Response.json({ ok: true, message: `Friend request sent to ${target.name}! They'll see it in Notifications.`, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json({ error: "Cloud not ready — try again in a moment." }, { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
