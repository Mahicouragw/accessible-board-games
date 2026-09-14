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
-- Add realtime publication tables only with the authenticated backend migration.



-- ---------------------------------------------------------------------------
-- Row Level Security: safe lockdown, NOT a working internet-room backend.
-- Never grant public clients direct room-state writes. The previous demo policies
-- let any caller impersonate members and overwrite scores. Run this manually in
-- an existing project to remove those policies; no remote database was changed here.
-- Internet play requires authenticated membership, transactional commands,
-- server-generated outcomes and commit/reveal validation before it can be enabled.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','rooms','room_members','messages','matches'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','allow all '||t,t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  END LOOP;
END $$;
