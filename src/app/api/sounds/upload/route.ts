import { store } from "@/lib/cloud-store";
import { SFX_NAMES } from "@/lib/sfx";
import { isAdminName } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ADMIN-ONLY: POST { code, name, dataUrl } → store a real RECORDED sound effect
// (recorded/uploaded in /sound-studio by the site owner). Published to every
// player via the cloud database (Supabase bg_sounds table, instant cloud as
// fallback). POST { code, name, reset: true } → back to built-in.
// Player IDs are login-only; admin is decided by the owner's NAME.
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
  // Admin check: resolve the caller by login ID, then verify the NAME is an
  // admin (owner) name. Guests and non-admin players cannot publish sounds.
  const code = String(body?.code ?? "").trim().toUpperCase();
  try {
    const me = code ? await store.players.findByCode(code) : null;
    if (!me || !isAdminName(me.name)) {
      return Response.json(
        { ok: false, error: "Sound Studio is admin-only — only the site owner can publish sounds." },
        { status: 403 },
      );
    }
  } catch {
    return Response.json({ ok: false, error: "could not verify admin" }, { status: 503 });
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
