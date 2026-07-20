// Cloud store — serverless multiplayer persistence via Supabase PostgREST.
// No DATABASE_URL or local DB needed: the API routes call these helpers and
// every Vercel instance shares the same live Postgres through the REST API.
// Tables are the bg_* tables created by supabase-setup.sql (one-time setup).

type Row = Record<string, any>;

const SUPA_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://zncepqzgsidqjvkayxdr.supabase.co"
).replace(/\/$/, "");
const SUPA_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_-AjL8yvjLCHyz0oO4yM3hg_61ZAwgRv";

const TABLES: Record<string, string> = {
  players: "bg_players",
  scores: "bg_scores",
  matches: "bg_matches",
  rooms: "bg_rooms",
  messages: "bg_messages",
  roomInvites: "bg_room_invites",
  signals: "bg_signals",
};

// camelCase (app) -> snake_case (Postgres) column maps.
const COLS: Record<string, Record<string, string>> = {
  players: {
    id: "id", name: "name", code: "code", avatar: "avatar", phone: "phone",
    wins: "wins", losses: "losses", draws: "draws",
    totalGames: "total_games", xp: "xp",
    createdAt: "created_at", lastSeen: "last_seen",
  },
  scores: {
    id: "id", playerId: "player_id", playerName: "player_name", game: "game",
    score: "score", meta: "meta", createdAt: "created_at",
  },
  matches: {
    id: "id", game: "game", status: "status", vsAi: "vs_ai",
    player1Id: "player1_id", player1Name: "player1_name",
    player2Id: "player2_id", player2Name: "player2_name",
    board: "board", turn: "turn", winner: "winner",
    createdAt: "created_at", updatedAt: "updated_at",
  },
  rooms: {
    id: "id", code: "code", game: "game", hostId: "host_id",
    hostName: "host_name", members: "members", status: "status",
    matchId: "match_id", createdAt: "created_at", updatedAt: "updated_at",
  },
  messages: {
    id: "id", roomId: "room_id", playerId: "player_id",
    playerName: "player_name", avatar: "avatar", kind: "kind",
    content: "content", createdAt: "created_at",
  },
  roomInvites: {
    id: "id", roomId: "room_id", fromName: "from_name",
    toId: "to_id", game: "game", createdAt: "created_at",
  },
  signals: {
    id: "id", roomId: "room_id", fromId: "from_id", toId: "to_id",
    kind: "kind", payload: "payload", createdAt: "created_at",
  },
};

function toSnake(table: string, obj: Row): Row {
  const map = COLS[table] ?? {};
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[map[k] ?? k] = v;
  }
  return out;
}

function toCamel(table: string, row: Row): Row {
  const map = COLS[table] ?? {};
  const inv: Record<string, string> = {};
  for (const [camel, snake] of Object.entries(map)) inv[snake] = camel;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[inv[k] ?? k] = v;
  return out;
}

/** Thrown when the bg_* tables have not been created yet (PGRST205). */
export class CloudNotReadyError extends Error {
  constructor(cause: string) {
    super(`cloud tables not ready: ${cause}`);
    this.name = "CloudNotReadyError";
  }
}

export function cloudSetupJson() {
  return {
    setup: true,
    error:
      "Live multiplayer is in setup mode — the host must run the one-time Supabase SQL (supabase-setup.sql). Solo games keep working.",
  };
}

async function rest(
  table: string,
  opts: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    query?: string;
    body?: Row;
    rep?: boolean; // return representation rows (camelized)
  } = {},
): Promise<Row[]> {
  const phys = TABLES[table];
  const url = `${SUPA_URL}/rest/v1/${phys}${opts.query ? `?${opts.query}` : ""}`;
  const method = opts.method ?? "GET";
  const wantRep = method === "GET" ? true : opts.rep === true;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json",
      Prefer: wantRep ? "return=representation" : "return=minimal",
    },
    body: opts.body ? JSON.stringify(toSnake(table, opts.body)) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes("PGRST205") || text.includes("schema cache")) {
      throw new CloudNotReadyError(`${phys}: ${text.slice(0, 120)}`);
    }
    throw new Error(`cloud ${table} ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!wantRep) return [];
  const data = text ? (JSON.parse(text) as Row[]) : [];
  return data.map((r) => toCamel(table, r));
}

const one = async (p: Promise<Row[]>): Promise<Row | null> => (await p)[0] ?? null;

export const store = {
  players: {
    findByCode: (code: string) =>
      one(rest("players", { query: `code=eq.${encodeURIComponent(code)}&limit=1` })),
    findById: (id: number) => one(rest("players", { query: `id=eq.${id}&limit=1` })),
    create: (v: Row) => one(rest("players", { method: "POST", body: v, rep: true })),
    update: (id: number, patch: Row) =>
      one(rest("players", { method: "PATCH", query: `id=eq.${id}`, body: patch, rep: true })),
    onlineSince: (sinceIso: string) =>
      rest("players", {
        query: `last_seen=gt.${encodeURIComponent(sinceIso)}&order=last_seen.desc&limit=50`,
      }),
    listAll: () => rest("players", { query: `limit=500` }),
  },
  scores: {
    forPlayer: (pid: number) =>
      rest("scores", { query: `player_id=eq.${pid}&order=created_at.desc` }),
    find: (pid: number, game: string) =>
      one(rest("scores", {
        query: `player_id=eq.${pid}&game=eq.${encodeURIComponent(game)}&limit=1`,
      })),
    insert: (v: Row) => one(rest("scores", { method: "POST", body: v, rep: true })),
    update: (id: number, patch: Row) =>
      one(rest("scores", { method: "PATCH", query: `id=eq.${id}`, body: patch, rep: true })),
    leaderboard: (game: string) =>
      rest("scores", { query: `game=eq.${encodeURIComponent(game)}&order=score.desc&limit=20` }),
  },
  matches: {
    byId: (id: number) => one(rest("matches", { query: `id=eq.${id}&limit=1` })),
    insert: (v: Row) => one(rest("matches", { method: "POST", body: v, rep: true })),
    update: (id: number, patch: Row) =>
      one(rest("matches", { method: "PATCH", query: `id=eq.${id}`, body: patch, rep: true })),
    remove: (id: number) => rest("matches", { method: "DELETE", query: `id=eq.${id}` }),
    waitingOpponent: (game: string, excludePid: number) =>
      one(rest("matches", {
        query:
          `game=eq.${encodeURIComponent(game)}&status=eq.waiting&vs_ai=eq.false` +
          `&player1_id=neq.${excludePid}&order=created_at.desc&limit=1`,
      })),
    invitesFor: (pid: number) =>
      rest("matches", {
        query: `player2_id=eq.${pid}&status=eq.invited&order=created_at.desc&limit=5`,
      }),
  },
  rooms: {
    byId: (id: number) => one(rest("rooms", { query: `id=eq.${id}&limit=1` })),
    byCode: (code: string) =>
      one(rest("rooms", { query: `code=eq.${encodeURIComponent(code)}&limit=1` })),
    listOpen: () =>
      rest("rooms", { query: `status=neq.closed&order=updated_at.desc&limit=30` }),
    insert: (v: Row) => one(rest("rooms", { method: "POST", body: v, rep: true })),
    update: (id: number, patch: Row) =>
      one(rest("rooms", { method: "PATCH", query: `id=eq.${id}`, body: patch, rep: true })),
    updateOwned: (id: number, hostId: number, patch: Row) =>
      rest("rooms", {
        method: "PATCH",
        query: `id=eq.${id}&host_id=eq.${hostId}`,
        body: patch,
      }),
  },
  messages: {
    after: async (roomId: number, after: number) => {
      const rows = await rest("messages", {
        query: `room_id=eq.${roomId}&id=gt.${after}&order=id.desc&limit=50`,
      });
      return rows.reverse();
    },
    insert: (v: Row) => one(rest("messages", { method: "POST", body: v, rep: true })),
  },
  roomInvites: {
    forPlayer: (toId: number) =>
      rest("roomInvites", { query: `to_id=eq.${toId}&order=id.desc&limit=5` }),
    findDup: (roomId: number, toId: number) =>
      one(rest("roomInvites", { query: `room_id=eq.${roomId}&to_id=eq.${toId}&limit=1` })),
    insert: (v: Row) => one(rest("roomInvites", { method: "POST", body: v, rep: true })),
    remove: (id: number) => rest("roomInvites", { method: "DELETE", query: `id=eq.${id}` }),
  },
  signals: {
    forPlayer: async (roomId: number, meId: number, after: number) => {
      const rows = await rest("signals", {
        query:
          `room_id=eq.${roomId}&id=gt.${after}` +
          `&or=(to_id.eq.0,to_id.eq.${meId})&order=id.desc&limit=60`,
      });
      return rows.filter((s) => s.fromId !== meId).reverse();
    },
    insert: (v: Row) => one(rest("signals", { method: "POST", body: v, rep: true })),
  },
};

export type { Row };
