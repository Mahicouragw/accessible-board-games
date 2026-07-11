import { db, isDbConfigured } from "@/db";
import { players, rooms, messages, type RoomMember } from "@/db/schema";
import { eq, ne, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// List open / playing rooms anyone can join or spectate.
export async function GET() {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, players: [], rooms: [], matches: [], invites: [], messages: [], scores: [] });
    }

    const rows = await db
      .select()
      .from(rooms)
      .where(ne(rooms.status, "closed"))
      .orderBy(desc(rooms.updatedAt))
      .limit(30);
    return Response.json({ rooms: rows });
  } catch (e) {
    console.error(e);
    return Response.json({ rooms: [] });
  }
}

// Create a new room.
export async function POST(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { code, game } = await req.json();
    const c = String(code ?? "").trim().toUpperCase();
    const g = String(game ?? "").trim();
    if (!c || !g) return Response.json({ error: "code and game required" }, { status: 400 });

    const [host] = await db.select().from(players).where(eq(players.code, c));
    if (!host) return Response.json({ error: "player not found" }, { status: 404 });

    let roomCode = genCode();
    for (let i = 0; i < 5; i++) {
      const [dup] = await db.select().from(rooms).where(eq(rooms.code, roomCode));
      if (!dup) break;
      roomCode = genCode();
    }

    const member: RoomMember = {
      id: host.id,
      name: host.name,
      avatar: host.avatar,
      role: "player",
    };

    const [room] = await db
      .insert(rooms)
      .values({
        code: roomCode,
        game: g,
        hostId: host.id,
        hostName: host.name,
        members: [member],
        status: "open",
      })
      .returning();

    await db.insert(messages).values({
      roomId: room.id,
      playerId: host.id,
      playerName: host.name,
      avatar: host.avatar,
      kind: "system",
      content: `${host.name} created the room`,
    });

    return Response.json({ room });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

// Close rooms that a host wants to end (kept for symmetry, not required).
export async function DELETE(req: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({ ok: true, message: "Demo mode - multiplayer requires DATABASE_URL, single-player works" });
    }

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    const code = String(searchParams.get("code") ?? "").trim().toUpperCase();
    const [host] = await db.select().from(players).where(eq(players.code, code));
    if (!host) return Response.json({ error: "player not found" }, { status: 404 });
    await db
      .update(rooms)
      .set({ status: "closed" })
      .where(and(eq(rooms.id, id), eq(rooms.hostId, host.id)));
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
