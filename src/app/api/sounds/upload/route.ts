import { store } from "@/lib/cloud-store";
import { SFX_NAMES } from "@/lib/sfx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST { name, dataUrl, mime }  → store a player's own RECORDED sound effect
// (uploaded/recorded in /sound-studio). Published to every player via the
// cloud database (Supabase bg_sounds table, instant cloud as fallback).
// POST { name, reset: true }    → delete the override, back to built-in.
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB cap per recording

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const name = String(body?.name ?? "");
  if (!SFX_NAMES.includes(name as any)) {
    return Response.json({ ok: false, error: "unknown sound name" }, { status: 400 });
  }

  try {
    if (body.reset) {
      await store.sounds.remove(name);
      return Response.json({ ok: true, reset: true });
    }
    const dataUrl = String(body.dataUrl ?? "");
    const m = /^data:(audio\/[a-z0-9.+-]+|video\/webm|application\/octet-stream);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
    if (!m) return Response.json({ ok: false, error: "expected data:<audio/*>;base64,..." }, { status: 400 });
    const mime = m[1].toLowerCase();
    const b64 = m[2];
    const bytes = Math.floor(b64.length * 3 / 4);
    if (bytes > MAX_BYTES) {
      return Response.json({ ok: false, error: `file too large (${(bytes / 1048576).toFixed(1)} MB, max 6 MB)` }, { status: 413 });
    }
    const row = await store.sounds.set({ name, mime, data: b64, updatedAt: new Date().toISOString() });
    return Response.json({ ok: true, name, id: row?.id ?? null });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
