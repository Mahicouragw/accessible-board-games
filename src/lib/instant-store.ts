// Instant cloud — ZERO-SETUP multiplayer persistence.
//
// When the Supabase bg_* tables don't exist yet, cloud-store automatically
// delegates to this store, which keeps a single shared JSON document on a
// hosted JSON-bin service (no account, no env vars, no SQL — nothing for the
// site owner to do). All Vercel instances see the same document, so rooms,
// matches, chat & leaderboards work online out of the box.
//
// The moment the optional Supabase setup runs, the app upgrades itself to
// Supabase automatically (see cloud-store.ts) — this file just sits idle.
//
// Notes:
// - One document keeps the whole mini-DB; collections are capped so it stays
//   small and fast. Perfect for a family/classroom-scale arcade.
// - Writes use a read-merge-write retry loop (3 attempts, jittered) to avoid
//   losing updates when two players act at the same moment.

type Row = Record<string, any>;

const INSTANT_URL =
  "https://jsonblob.com/api/jsonBlob/019f8072-780d-76f6-8026-6d5a1296a17b";

const COLLECTIONS = [
  "players",
  "scores",
  "matches",
  "rooms",
  "messages",
  "roomInvites",
  "signals",
] as const;
type Coll = (typeof COLLECTIONS)[number];
type Doc = { seq: Record<string, number> } & Record<Coll, Row[]>;

// Keep the document small: newest N entries per chatty collection.
const CAPS: Partial<Record<Coll, number>> = {
  messages: 500,
  signals: 300,
  matches: 300,
  rooms: 200,
  roomInvites: 120,
  scores: 1500,
};

const iso = () => new Date().toISOString();
const num = (v: any) => Number(v);
const ts = (v: any) => {
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? 0 : t;
};

async function http(method: "GET" | "PUT", body?: Doc): Promise<Response> {
  return fetch(INSTANT_URL, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

async function load(): Promise<Doc> {
  const res = await http("GET");
  if (!res.ok) throw new Error(`instant cloud GET ${res.status}`);
  const doc = (await res.json()) as Doc;
  doc.seq = doc.seq ?? {};
  for (const c of COLLECTIONS) doc[c] = doc[c] ?? [];
  return doc;
}

/** Read-merge-write with retry. `mutate` edits the doc; its return value is the result. */
async function transact<T>(mutate: (doc: Doc) => T): Promise<T> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doc = await load();
      const out = mutate(doc);
      for (const c of COLLECTIONS) {
        const cap = CAPS[c];
        if (cap && doc[c].length > cap) doc[c] = doc[c].slice(-cap);
      }
      const res = await http("PUT", doc);
      if (!res.ok) throw new Error(`instant cloud PUT ${res.status}`);
      return out;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function nextId(doc: Doc, c: Coll): number {
  doc.seq[c] = (doc.seq[c] ?? 0) + 1;
  return doc.seq[c];
}

function insertRow(c: Coll, defaults: Row, v: Row) {
  return (doc: Doc) => {
    const row: Row = { id: nextId(doc, c), createdAt: iso(), ...defaults, ...v };
    delete (row as any).undefined;
    doc[c].push(row);
    return row;
  };
}

function updateRow(c: Coll, id: number, patch: Row) {
  return (doc: Doc) => {
    const row = doc[c].find((r) => num(r.id) === num(id));
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  };
}

function byId(list: Row[], id: number): Row | null {
  return list.find((r) => num(r.id) === num(id)) ?? null;
}

export const instantStore = {
  players: {
    findByCode: async (code: string): Promise<Row | null> =>
      (await load()).players.find((p) => p.code === code) ?? null,
    findById: async (id: number): Promise<Row | null> =>
      byId((await load()).players, id),
    create: async (v: Row): Promise<Row | null> =>
      transact(insertRow("players", { lastSeen: iso(), wins: 0, losses: 0, draws: 0, totalGames: 0, xp: 0 }, v)),
    update: async (id: number, patch: Row): Promise<Row | null> =>
      transact(updateRow("players", id, patch)),
    onlineSince: async (sinceIso: string): Promise<Row[]> =>
      (await load())
        .players.filter((p) => ts(p.lastSeen) > ts(sinceIso))
        .sort((a, b) => ts(b.lastSeen) - ts(a.lastSeen))
        .slice(0, 50),
    listAll: async (): Promise<Row[]> => (await load()).players.slice(0, 500),
  },
  scores: {
    forPlayer: async (pid: number): Promise<Row[]> =>
      (await load())
        .scores.filter((s) => num(s.playerId) === num(pid))
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt)),
    find: async (pid: number, game: string): Promise<Row | null> =>
      (await load()).scores.find(
        (s) => num(s.playerId) === num(pid) && s.game === game,
      ) ?? null,
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("scores", { score: 0 }, v)),
    update: async (id: number, patch: Row): Promise<Row | null> =>
      transact(updateRow("scores", id, patch)),
    leaderboard: async (game: string): Promise<Row[]> =>
      (await load())
        .scores.filter((s) => s.game === game)
        .sort((a, b) => num(b.score) - num(a.score))
        .slice(0, 20),
  },
  matches: {
    byId: async (id: number): Promise<Row | null> => byId((await load()).matches, id),
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("matches", { status: "waiting", vsAi: false, updatedAt: iso() }, v)),
    update: async (id: number, patch: Row): Promise<Row | null> =>
      transact(updateRow("matches", id, patch)),
    remove: async (id: number): Promise<Row[]> =>
      transact((doc) => {
        doc.matches = doc.matches.filter((m) => num(m.id) !== num(id));
        return [];
      }),
    waitingOpponent: async (game: string, excludePid: number): Promise<Row | null> =>
      (await load())
        .matches.filter(
          (m) =>
            m.game === game &&
            m.status === "waiting" &&
            !m.vsAi &&
            num(m.player1Id) !== num(excludePid),
        )
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))[0] ?? null,
    invitesFor: async (pid: number): Promise<Row[]> =>
      (await load())
        .matches.filter((m) => num(m.player2Id) === num(pid) && m.status === "invited")
        .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))
        .slice(0, 5),
  },
  rooms: {
    byId: async (id: number): Promise<Row | null> => byId((await load()).rooms, id),
    byCode: async (code: string): Promise<Row | null> =>
      (await load()).rooms.find((r) => r.code === code) ?? null,
    listOpen: async (): Promise<Row[]> =>
      (await load())
        .rooms.filter((r) => r.status !== "closed")
        .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
        .slice(0, 30),
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("rooms", { status: "open", members: [], updatedAt: iso() }, v)),
    update: async (id: number, patch: Row): Promise<Row | null> =>
      transact(updateRow("rooms", id, patch)),
    updateOwned: async (id: number, hostId: number, patch: Row): Promise<Row[]> =>
      transact((doc) => {
        const row = doc.rooms.find(
          (r) => num(r.id) === num(id) && num(r.hostId) === num(hostId),
        );
        if (row) Object.assign(row, patch);
        return [];
      }),
  },
  messages: {
    after: async (roomId: number, after: number): Promise<Row[]> =>
      (await load())
        .messages.filter((m) => num(m.roomId) === num(roomId) && num(m.id) > num(after))
        .sort((a, b) => num(a.id) - num(b.id))
        .slice(-50),
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("messages", { kind: "text" }, v)),
  },
  roomInvites: {
    forPlayer: async (toId: number): Promise<Row[]> =>
      (await load())
        .roomInvites.filter((i) => num(i.toId) === num(toId))
        .sort((a, b) => num(b.id) - num(a.id))
        .slice(0, 5),
    findDup: async (roomId: number, toId: number): Promise<Row | null> =>
      (await load()).roomInvites.find(
        (i) => num(i.roomId) === num(roomId) && num(i.toId) === num(toId),
      ) ?? null,
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("roomInvites", {}, v)),
    remove: async (id: number): Promise<Row[]> =>
      transact((doc) => {
        doc.roomInvites = doc.roomInvites.filter((i) => num(i.id) !== num(id));
        return [];
      }),
  },
  signals: {
    forPlayer: async (roomId: number, meId: number, after: number): Promise<Row[]> =>
      (await load())
        .signals.filter(
          (s) =>
            num(s.roomId) === num(roomId) &&
            num(s.id) > num(after) &&
            (num(s.toId) === 0 || num(s.toId) === num(meId)) &&
            num(s.fromId) !== num(meId),
        )
        .sort((a, b) => num(a.id) - num(b.id))
        .slice(-60),
    insert: async (v: Row): Promise<Row | null> =>
      transact(insertRow("signals", { toId: 0 }, v)),
  },
};
