import { db, isDbConfigured } from "@/db";
import { cloudMode } from "@/lib/cloud-store";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // cloudMode: "supabase" = real Postgres database live, "instant" = zero-setup
  // fallback cloud (the app self-upgrades to Supabase automatically).
  const cloud = cloudMode();
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, cloud, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    await db.execute(sql`select 1`);
    return Response.json({ ok: true, cloud });
  } catch {
    return Response.json({ ok: false, cloud }, { status: 500 });
  }
}
