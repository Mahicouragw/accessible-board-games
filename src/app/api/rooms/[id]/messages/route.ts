import { store, CloudNotReadyError, cloudSetupJson } from "@/lib/cloud-store";

export const dynamic = "force-dynamic";

// Fetch messages after a given id (for polling).
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { searchParams } = new URL(req.url);
    const after = Number(searchParams.get("after") ?? 0);
    const messages = await store.messages.after(roomId, after);
    return Response.json({ messages, cloud: true });
  } catch (e) {
    if (!(e instanceof CloudNotReadyError)) console.error(e);
    return Response.json({ messages: [], cloud: false });
  }
}

// Send a text or voice message.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const roomId = Number(params.id);
    const { code, kind, content } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const k = kind === "voice" ? "voice" : "text";
    const body = String(content ?? "");

    if (!body) return Response.json({ error: "empty" }, { status: 400 });
    // Guard payload size (voice ~ base64). Limit to ~700KB.
    if (body.length > 950_000) {
      return Response.json({ error: "message too large" }, { status: 413 });
    }

    const player = await store.players.findByCode(c);
    if (!player) return Response.json({ error: "player not found" }, { status: 404 });

    const msg = await store.messages.insert({
      roomId, playerId: player.id, playerName: player.name,
      avatar: player.avatar, kind: k,
      content: k === "text" ? body.slice(0, 500) : body,
    });
    return Response.json({ message: msg, cloud: true });
  } catch (e) {
    if (e instanceof CloudNotReadyError) {
      return Response.json(cloudSetupJson(), { status: 503 });
    }
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
