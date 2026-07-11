import { db, isDbConfigured } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { code } = await req.json();
    const clean = String(code ?? "").trim().toUpperCase();
    if (!clean) return Response.json({ error: "code required" }, { status: 400 });
    await db.update(players).set({ lastSeen: new Date() }).where(eq(players.code, clean));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
