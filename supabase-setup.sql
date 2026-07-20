-- ============================================================================
-- Accessible Board Games — OPTIONAL database upgrade (v3, schema-verified)
--
-- ⭐ IMPORTANT: you do NOT need to run this for multiplayer to work!
--    Rooms, matches, chat and leaderboards already work out-of-the-box via
--    the built-in zero-setup instant cloud. This file is only an OPTIONAL
--    upgrade to a full Postgres backend (faster, bigger capacity).
--    Once it runs successfully, the app upgrades itself automatically.
--
-- HOW TO RUN (only if you want the upgrade) — foolproof method:
--   1. Open this file's page on GitHub and tap the "Copy raw file" button
--      (overlapping-squares icon, top-right of the code box). It copies the
--      ENTIRE file — no text selecting needed:
--        https://github.com/Mahicouragw/accessible-board-games/blob/main/supabase-setup.sql
--   2. Open the SQL editor:
--        https://supabase.com/dashboard/project/zncepqzgsidqjvkayxdr/sql/new
--   3. Tap inside the editor, press Ctrl+A then Delete (must be EMPTY!),
--      then Ctrl+V to paste ONCE.
--   4. Press RUN. Look for "Success" + "✅ upgrade complete" + 7 bg_ tables.
--
-- SELF-DIAGNOSTIC: this file has fewer than 200 lines. If an error mentions
-- a much bigger line number, the editor had leftover text — clear it fully
-- (Ctrl+A → Delete) and paste ONCE.
--
-- Safe to re-run any number of times (idempotent). Column layout matches the
-- app's data layer exactly (cloud-store.ts ↔ these tables, verified).
-- ============================================================================

-- ============ 1. TABLES ============
create table if not exists public.bg_players (
  id          bigint generated always as identity primary key,
  name        text not null,
  code        text not null unique,
  avatar      text not null default '🎮',
  phone       text,
  wins        integer not null default 0,
  losses      integer not null default 0,
  draws       integer not null default 0,
  total_games integer not null default 0,
  xp          integer not null default 0,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists bg_players_seen_idx on public.bg_players (last_seen desc);

create table if not exists public.bg_scores (
  id          bigint generated always as identity primary key,
  player_id   bigint not null,
  player_name text not null,
  game        text not null,
  score       integer not null default 0,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists bg_scores_game_idx on public.bg_scores (game, score desc);

create table if not exists public.bg_matches (
  id           bigint generated always as identity primary key,
  game         text not null,
  status       text not null default 'waiting',  -- waiting | invited | active | finished
  vs_ai        boolean not null default false,
  player1_id   bigint,
  player1_name text,
  player2_id   bigint,
  player2_name text,
  board        jsonb,
  turn         integer not null default 1,       -- 1 = player1, 2 = player2
  winner       integer,                          -- null | 0 draw | 1 player1 | 2 player2
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bg_matches_status_idx on public.bg_matches (game, status, created_at desc);
create index if not exists bg_matches_invited_idx on public.bg_matches (player2_id, status);

create table if not exists public.bg_rooms (
  id         bigint generated always as identity primary key,
  code       text,
  game       text not null,
  host_id    bigint not null,
  host_name  text not null,
  members    jsonb not null default '[]'::jsonb,  -- [{id,name,avatar,role}]
  status     text not null default 'open',         -- open | playing | closed
  match_id   bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bg_rooms_code_idx on public.bg_rooms (code);
create index if not exists bg_rooms_status_idx on public.bg_rooms (status, updated_at desc);

create table if not exists public.bg_messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null,
  player_id   bigint,
  player_name text,
  avatar      text,
  kind        text not null default 'text',        -- text | emoji | system | dice | move
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists bg_messages_room_idx on public.bg_messages (room_id, id);

create table if not exists public.bg_room_invites (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  from_name  text not null,
  to_id      bigint not null,
  game       text,
  created_at timestamptz not null default now()
);
create index if not exists bg_room_invites_to_idx on public.bg_room_invites (to_id, id desc);

create table if not exists public.bg_signals (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  from_id    bigint not null,
  to_id      bigint not null default 0,            -- 0 = everyone in the room
  kind       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bg_signals_room_idx on public.bg_signals (room_id, id);

-- ============ 2. OPEN ARCADE POLICIES (public game data, same model as Nexus) ============
do $$
declare
  t text;
begin
  foreach t in array array['bg_players','bg_scores','bg_matches','bg_rooms','bg_messages','bg_room_invites','bg_signals']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "bg read"   on public.%I', t);
    execute format('create policy "bg read"   on public.%I for select using (true)', t);

    execute format('drop policy if exists "bg write"  on public.%I', t);
    execute format('create policy "bg write"  on public.%I for insert with check (true)', t);

    execute format('drop policy if exists "bg update" on public.%I', t);
    execute format('create policy "bg update" on public.%I for update using (true) with check (true)', t);

    execute format('drop policy if exists "bg delete" on public.%I', t);
    execute format('create policy "bg delete" on public.%I for delete using (true)', t);
  end loop;
end $$;

-- ============ 3. REALTIME (OPTIONAL, fully guarded — cannot fail the script) ============
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['bg_matches','bg_rooms','bg_messages','bg_signals','bg_room_invites']
    loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when others then
        null; -- already added or not allowed: either way, fine
      end;
    end loop;
  end if;
exception when others then
  null; -- realtime is a bonus, never a blocker
end $$;

-- ============ 4. VERIFY — you should see "✅ upgrade complete" and 7 tables ============
select '✅ upgrade complete — Supabase backend is LIVE' as status;
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like 'bg\_%'
order by table_name;
