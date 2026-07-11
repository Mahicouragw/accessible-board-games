import { isDbConfigured } from "@/db";
import * as LocalDB from "@/lib/local-cloud-db";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Login via phone number - for Ludo/Snake phone multiplayer
export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const cleanPhone = String(phone ?? "").trim();
    if (!cleanPhone) return Response.json({ error: "Phone number required" }, { status: 400 });

    if (!isDbConfigured()) {
      // Search in local DB by phone
      const allPlayers = LocalDB.getAllPlayers();
      const found = allPlayers.find(p => p.phone && p.phone.includes(cleanPhone.slice(-10)) || p.phone === cleanPhone);
      if (found) {
        return Response.json({ player: found, scores: [] });
      }
      // If not found, create new player with phone
      const player = LocalDB.createPlayer(`Player ${cleanPhone.slice(-4)}`, cleanPhone);
      return Response.json({ player, scores: [] });
    }

    // With real DB, search by phone
    const [player] = await db.select().from(players).where(eq(players.phone as any, cleanPhone)).limit(1);
    if (!player) {
      // Try partial match last 10 digits
      const all = await db.select().from(players);
      const found = all.find((p: any) => p.phone && (p.phone.includes(cleanPhone.slice(-10)) || cleanPhone.includes(p.phone.slice(-10))));
      if (found) return Response.json({ player: found, scores: [] });
      return Response.json({ error: "No player found with that phone" }, { status: 404 });
    }

    return Response.json({ player, scores: [] });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to login with phone" }, { status: 500 });
  }
}
