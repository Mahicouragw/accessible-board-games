-- ============================================================================
-- Accessible Board Games — SIMPLE one-time setup (LITE version).
-- Only create tables + policies. No realtime extras. Run it ONCE.
--
-- EASIEST, ERROR-PROOF METHOD (one tap copies the whole file):
--   1. Open: https://github.com/Mahicouragw/accessible-board-games/blob/main/supabase-setup-lite.sql
--   2. Tap the "Copy raw file" button (overlapping-squares icon, top-right
--      of the code box). It copies the ENTIRE file — no selecting needed.
--   3. Open: https://supabase.com/dashboard/project/zncepqzgsidqjvkayxdr/sql/new
--   4. Tap inside the editor, press Ctrl+A then Delete (editor must be EMPTY),
--      then Ctrl+V to paste ONCE.
--   5. Press RUN. Wait for "Success" + the ✅ row in results. Done!
--
-- NOTE: run this file ONLY ONCE. If you already saw the ✅ banner before,
-- you are already set up — do not run it again.
-- ============================================================================

create table if not exists public.bg_players (
  id bigint generated always as identity primary key,
  name text not null,
  code text not null unique,
  avatar text not null default '🎮',
  phone text,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  total_games integer not null default 0,
  xp integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.bg_players enable row level security;
create policy "bg read"   on public.bg_players for select using (true);
create policy "bg write"  on public.bg_players for insert with check (true);
create policy "bg update" on public.bg_players for update using (true) with check (true);
create policy "bg delete" on public.bg_players for delete using (true);

create table if not exists public.bg_scores (
  id bigint generated always as identity primary key,
  player_id bigint not null,
  player_name text not null,
  game text not null,
  score integer not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);
alter table public.bg_scores enable row level security;
create policy "bg read"   on public.bg_scores for select using (true);
create policy "bg write"  on public.bg_scores for insert with check (true);
create policy "bg update" on public.bg_scores for update using (true) with check (true);
create policy "bg delete" on public.bg_scores for delete using (true);

create table if not exists public.bg_matches (
  id bigint generated always as identity primary key,
  game text not null,
  status text not null default 'waiting',
  player1_id bigint,
  player2_id bigint,
  challenger_id bigint,
  state jsonb,
  winner_id bigint,
  invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bg_matches enable row level security;
create policy "bg read"   on public.bg_matches for select using (true);
create policy "bg write"  on public.bg_matches for insert with check (true);
create policy "bg update" on public.bg_matches for update using (true) with check (true);
create policy "bg delete" on public.bg_matches for delete using (true);

create table if not exists public.bg_rooms (
  id bigint generated always as identity primary key,
  name text not null,
  game text not null,
  host_id bigint not null,
  host_name text not null,
  status text not null default 'open',
  code text,
  max_players integer not null default 4,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.bg_rooms enable row level security;
create policy "bg read"   on public.bg_rooms for select using (true);
create policy "bg write"  on public.bg_rooms for insert with check (true);
create policy "bg update" on public.bg_rooms for update using (true) with check (true);
create policy "bg delete" on public.bg_rooms for delete using (true);

create table if not exists public.bg_messages (
  id bigint generated always as identity primary key,
  room_id bigint not null default 0,
  match_id bigint not null default 0,
  from_id bigint not null,
  to_id bigint not null default 0,
  from_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.bg_messages enable row level security;
create policy "bg read"   on public.bg_messages for select using (true);
create policy "bg write"  on public.bg_messages for insert with check (true);
create policy "bg update" on public.bg_messages for update using (true) with check (true);
create policy "bg delete" on public.bg_messages for delete using (true);

create table if not exists public.bg_room_invites (
  id bigint generated always as identity primary key,
  room_id bigint not null,
  room_name text not null,
  game text not null,
  from_id bigint not null,
  from_name text not null,
  to_id bigint not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.bg_room_invites enable row level security;
create policy "bg read"   on public.bg_room_invites for select using (true);
create policy "bg write"  on public.bg_room_invites for insert with check (true);
create policy "bg update" on public.bg_room_invites for update using (true) with check (true);
create policy "bg delete" on public.bg_room_invites for delete using (true);

create table if not exists public.bg_signals (
  id bigint generated always as identity primary key,
  room_id bigint not null,
  from_id bigint not null,
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.bg_signals enable row level security;
create policy "bg read"   on public.bg_signals for select using (true);
create policy "bg write"  on public.bg_signals for insert with check (true);
create policy "bg update" on public.bg_signals for update using (true) with check (true);
create policy "bg delete" on public.bg_signals for delete using (true);

select '✅ setup complete — multiplayer is LIVE' as status;
