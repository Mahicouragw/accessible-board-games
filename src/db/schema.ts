import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// Players — login with name, receive a unique code (ID) to log back in with.
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  avatar: text("avatar").notNull().default("🎮"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  totalGames: integer("total_games").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

// Per-game best scores / progress for each player.
export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  game: text("game").notNull(),
  score: integer("score").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Online matches for turn-based games (Tic-Tac-Toe / Connect Four).
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  game: text("game").notNull(),
  status: text("status").notNull().default("waiting"), // waiting | active | finished
  vsAi: boolean("vs_ai").notNull().default(false),
  player1Id: integer("player1_id"),
  player1Name: text("player1_name"),
  player2Id: integer("player2_id"),
  player2Name: text("player2_name"),
  board: jsonb("board").notNull(),
  turn: integer("turn").notNull().default(1), // 1 or 2
  winner: integer("winner"), // 0 = draw, 1, 2, null = ongoing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RoomMember = {
  id: number;
  name: string;
  avatar: string;
  role: "player" | "spectator";
};

// Live game rooms / parties — anyone can join or spectate, up to 4 players.
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  game: text("game").notNull(),
  hostId: integer("host_id").notNull(),
  hostName: text("host_name").notNull(),
  members: jsonb("members").$type<RoomMember[]>().notNull().default([]),
  status: text("status").notNull().default("open"), // open | playing | closed
  matchId: integer("match_id"), // linked active match when playing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Chat + voice messages inside a room.
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  avatar: text("avatar").notNull().default("🎮"),
  kind: text("kind").notNull().default("text"), // text | voice | system
  content: text("content").notNull(), // text or base64 audio data URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Room invites — notify a player they've been invited to a live room.
export const roomInvites = pgTable("room_invites", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  fromName: text("from_name").notNull(),
  toId: integer("to_id").notNull(),
  game: text("game").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// WebRTC signaling for voice calls (offer/answer/ICE), polled by peers.
export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  fromId: integer("from_id").notNull(),
  toId: integer("to_id").notNull(), // 0 = broadcast
  kind: text("kind").notNull(), // offer | answer | ice | hangup
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
