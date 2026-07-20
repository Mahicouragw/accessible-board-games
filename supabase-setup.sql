-- Accessible Board Games — ONE-TIME multiplayer cloud setup (v1.4.0+)
-- HOW TO RUN (2 minutes, do it once):
--   1. COPY this file:  https://github.com/Mahicouragw/accessible-board-games/blob/main/supabase-setup.sql
--   2. PASTE it here:   https://supabase.com/dashboard/project/zncepqzgsidqjvkayxdr/sql/new
--   3. Press RUN (Ctrl+Enter). Done — rooms, matches, chat & leaderboards go live instantly.
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE / guarded blocks.

-- ============ TABLES ============
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
create index if not exists bg_players_code_idx on public.bg_players (code);
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
  board        jsonb not null,
  turn         integer not null default 1,
  winner       integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bg_matches_status_idx on public.bg_matches (status, game);

create table if not exists public.bg_rooms (
  id         bigint generated always as identity primary key,
  code       text not null unique,
  game       text not null,
  host_id    bigint not null,
  host_name  text not null,
  members    jsonb not null default '[]'::jsonb,
  status     text not null default 'open',       -- open | playing | closed
  match_id   bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bg_messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null,
  player_id   bigint not null,
  player_name text not null,
  avatar      text not null default '🎮',
  kind        text not null default 'text',      -- text | voice | system
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists bg_messages_room_idx on public.bg_messages (room_id, id);

create table if not exists public.bg_room_invites (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  from_name  text not null,
  to_id      bigint not null,
  game       text not null,
  created_at timestamptz not null default now()
);
create index if not exists bg_room_invites_to_idx on public.bg_room_invites (to_id);

create table if not exists public.bg_signals (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  from_id    bigint not null,
  to_id      bigint not null,                    -- 0 = broadcast
  kind       text not null,                      -- offer | answer | ice | hangup
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bg_signals_room_idx on public.bg_signals (room_id, id);

-- ============ OPEN ARCADE POLICIES (public game data, same model as Nexus) ============
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

-- ============ REALTIME: broadcast new rows to all open apps ============
do $$
declare
  t text;
begin
  foreach t in array array['bg_matches','bg_rooms','bg_messages','bg_signals','bg_room_invites']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- already published, fine
    end;
  end loop;
end $$;
