import { store } from "@/lib/cloud-store";
import { SFX_NAMES } from "@/lib/sfx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/sounds/user/<name> → the player-uploaded recording for this
// effect (served to every device). 404 when only the built-in file exists.
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name ?? "");
  if (!SFX_NAMES.includes(name as any)) {
    return new Response("unknown sound", { status: 400 });
  }
  try {
    const row = await store.sounds.get(name);
    if (!row || !row.data) return new Response("no custom sound", { status: 404 });
    const buf = Buffer.from(String(row.data), "base64");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": String(row.mime || "audio/wav"),
        // Never cache: uploads must propagate immediately to all players.
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Content-Length": String(buf.length),
      },
    });
  } catch {
    // DB unreachable right now → behave as "no custom sound" so the sound
    // engine transparently falls back to the built-in recorded file.
    return new Response("no custom sound", { status: 404 });
  }
}
