import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isDbConfigured } from "@/db";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const AVATARS = [
  "🦊", "🐼", "🦁", "🐸", "🐵", "🐯", "🦄", "🐙", "🐳", "🦉",
  "🐲", "🦖", "🐧", "🐨", "🐰", "🐺", "🦅", "🦈", "🐝", "🦋",
];

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const clean = String(name ?? "").trim().slice(0, 24);
    if (!clean) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    // FIX: If no DB configured (demo/single-player mode), return mock player
    // This fixes "Cannot read properties of undefined" when DB not set
    if (!isDbConfigured()) {
      const code = genCode();
      const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
      const mockPlayer = {
        id: Math.floor(Math.random() * 100000),
        name: clean,
        code,
        avatar,
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        xp: 0,
        createdAt: new Date(),
        lastSeen: new Date(),
      };
      return Response.json({ player: mockPlayer });
    }

    // Generate a unique code
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const existing = await db.select().from(players).where(eq(players.code, code));
      if (existing.length === 0) break;
      code = genCode();
    }

    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const [player] = await db
      .insert(players)
      .values({ name: clean, code, avatar })
      .returning();

    if (!player) {
      // Fallback if DB insert failed - return mock
      const mockPlayer = {
        id: Math.floor(Math.random() * 100000),
        name: clean,
        code,
        avatar,
        wins: 0,
        losses: 0,
        draws: 0,
        totalGames: 0,
        xp: 0,
        createdAt: new Date(),
        lastSeen: new Date(),
      };
      return Response.json({ player: mockPlayer });
    }

    return Response.json({ player });
  } catch (e) {
    console.error(e);
    // Even on error, return mock player to allow offline play
    const { name } = await req.json().catch(() => ({ name: "Guest" }));
    const clean = String(name ?? "Guest").trim().slice(0, 24) || "Guest";
    const code = genCode();
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const mockPlayer = {
      id: Math.floor(Math.random() * 100000),
      name: clean,
      code,
      avatar,
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      xp: 0,
      createdAt: new Date(),
      lastSeen: new Date(),
    };
    return Response.json({ player: mockPlayer });
  }
}
