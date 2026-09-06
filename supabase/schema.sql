-- ============================================================================
-- HeroBoard — Supabase schema (Postgres)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It creates the tables the realtime layer uses for profiles, rooms, members,
-- chat messages and match results, plus row-level-security and realtime.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES  (unique usernames / Hero IDs, used for duplicate detection + stats)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          text primary key,
  username    text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ROOMS  (a live game room; `state` holds the authoritative game snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  code        text primary key,
  game        text not null,
  meta        jsonb not null default '{}'::jsonb,
  admin_id    text,
  state       jsonb,
  status      text not null default 'lobby',   -- lobby | in_progress | closed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ROOM MEMBERS  (who is in the room, their role + seat)
-- ---------------------------------------------------------------------------
create table if not exists public.room_members (
  room_code   text not null references public.rooms(code) on delete cascade,
  user_id     text not null,
  name        text not null,
  role        text not null default 'spectator', -- admin | player | spectator
  slot        integer,
  primary key (room_code, user_id)
);

-- ---------------------------------------------------------------------------
-- MESSAGES  (live chat in a room)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  room_code   text not null references public.rooms(code) on delete cascade,
  user_id     text,
  name        text,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- MATCHES  (optional: cross-device match results for persistent profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id          bigint generated always as identity primary key,
  game        text not null,
  room_code   text,
  winning_id  text,
  scores      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the hot query paths
-- ---------------------------------------------------------------------------
create index if not exists room_members_room_idx on public.room_members(room_code);
create index if not exists messages_room_idx     on public.messages(room_code, created_at);
create index if not exists profiles_username_idx on public.profiles(username);

-- ---------------------------------------------------------------------------
-- Realtime: publish the changing tables. The subscription client listens on
-- these so spectators + remote players see every change instantly.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- NOTE: this is a deliberately permissive demo policy so the anon key can
-- create/join rooms and chat. For production you should lock this down to
-- authenticated roles and scope reads to the user's own data.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.messages     enable row level security;
alter table public.matches      enable row level security;

create or replace policy "allow all profiles"     on public.profiles     for all using (true) with check (true);
create or replace policy "allow all rooms"        on public.rooms        for all using (true) with check (true);
create or replace policy "allow all room_members" on public.room_members for all using (true) with check (true);
create or replace policy "allow all messages"     on public.messages     for all using (true) with check (true);
create or replace policy "allow all matches"      on public.matches      for all using (true) with check (true);
