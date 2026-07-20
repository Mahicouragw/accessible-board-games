-- ============================================================================
-- Accessible Board Games — ONE-TIME multiplayer cloud setup (v2, hardened)
-- Takes ~2 minutes, do it ONCE. Safe to re-run any number of times.
--
-- ✅ EASIEST METHOD (no selecting needed — one tap copies the whole file):
--   1. You are probably ALREADY on the file page. If not:
--        https://github.com/Mahicouragw/accessible-board-games/blob/main/supabase-setup.sql
--   2. Tap the "Copy raw file" button (the overlapping-squares icon at the
--      top-right of the code box). This copies 100% of the file perfectly.
--   3. Open your Supabase SQL editor:
--        https://supabase.com/dashboard/project/zncepqzgsidqjvkayxdr/sql/new
--   4. Tap inside the editor, press Ctrl+A then Delete (it must be EMPTY!),
--      then Ctrl+V to paste ONCE — no old text, no double paste.
--   5. Press RUN (or Ctrl+Enter).
--   6. Look for green "Success" + the "✅ setup complete" row + 7 bg_ tables.
--
-- 🧭 SELF-DIAGNOSTIC: this file has about 150 lines. If any error mentions
-- a much bigger line number (like 300 or 845), the editor had leftover or
-- repeated text — clear it completely (Ctrl+A → Delete) and paste ONCE.
-- If copy keeps failing, use the simpler twin file supabase-setup-lite.sql.
--
-- The realtime part at the end is fully optional-guarded: even if your
-- project handles realtime differently, it can NEVER make this script fail.
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
  player1_id   bigint,
  player2_id   bigint,
  challenger_id bigint,
  state        jsonb,
  winner_id    bigint,
  invite_code  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists bg_matches_status_idx on public.bg_matches (game, status);
create index if not exists bg_matches_players_idx on public.bg_matches (player1_id, player2_id);

create table if not exists public.bg_rooms (
  id         bigint generated always as identity primary key,
  name       text not null,
  game       text not null,
  host_id    bigint not null,
  host_name  text not null,
  status     text not null default 'open',       -- open | playing | closed
  code       text,
  max_players integer not null default 4,
  players    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bg_rooms_status_idx on public.bg_rooms (status, created_at desc);

create table if not exists public.bg_messages (
  id         bigint generated always as identity primary key,
  room_id    bigint not null default 0,
  match_id   bigint not null default 0,
  from_id    bigint not null,
  to_id      bigint not null default 0,
  from_name  text not null,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists bg_messages_room_idx on public.bg_messages (room_id, id);
create index if not exists bg_messages_inbox_idx on public.bg_messages (to_id, id);

create table if not exists public.bg_room_invites (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  room_name  text not null,
  game       text not null,
  from_id    bigint not null,
  from_name  text not null,
  to_id      bigint not null,
  status     text not null default 'pending',    -- pending | accepted | declined
  created_at timestamptz not null default now()
);
create index if not exists bg_room_invites_to_idx on public.bg_room_invites (to_id, status);

create table if not exists public.bg_signals (
  id         bigint generated always as identity primary key,
  room_id    bigint not null,
  from_id    bigint not null,
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
-- Broadcasts new rows to all open apps. If your project's realtime
-- publication is different, this block quietly does nothing and the app
-- still works perfectly (it also refreshes on its own).
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

-- ============ 4. VERIFY — you should see "✅ setup complete" and 7 tables ============
select '✅ setup complete — multiplayer is LIVE' as status;
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like 'bg\_%'
order by table_name;
