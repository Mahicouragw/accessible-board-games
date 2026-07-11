import { db } from "@/db";
import { isDbConfigured } from "@/db";
import * as LocalDB from "@/lib/local-cloud-db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const AVATARS = ["🦊","🐼","🦁","🐸","🐵","🐯","🦄","🐙","🐳","🦉","🐲","🦖","🐧","🐨"];

export async function POST(req: Request) {
  try {
    const { name, phone } = await req.json();
    const clean = String(name ?? "").trim().slice(0, 24);
    const cleanPhone = String(phone ?? "").trim().slice(0, 20);
    if (!clean) return Response.json({ error: "Name is required" }, { status: 400 });

    if (!isDbConfigured()) {
      // REAL Local Cloud DB with phone support - no Neon needed!
      const player = LocalDB.createPlayer(clean, cleanPhone);
      return Response.json({ player });
    }

    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const existing = await db.select().from(players).where(eq(players.code, code));
      if (existing.length === 0) break;
      code = genCode();
    }
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const [player] = await db.insert(players).values({ name: clean, code, avatar, phone: cleanPhone } as any).returning();
    return Response.json({ player });
  } catch (e) {
    console.error(e);
    const { name, phone } = await req.json().catch(() => ({ name: "Guest", phone: "" }));
    const player = LocalDB.createPlayer(String(name ?? "Guest"), String(phone ?? ""));
    return Response.json({ player });
  }
}
