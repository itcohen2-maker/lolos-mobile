-- ============================================================
-- 002_coins.sql — Coins persistence: event log, profile total,
-- per-match earnings. Run after 001_profiles_matches.sql.
-- ============================================================

-- 1. Add total_coins to profiles
alter table public.profiles
  add column if not exists total_coins integer not null default 0;

-- 2. Add coins_earned to match_participants
alter table public.match_participants
  add column if not exists coins_earned integer not null default 0;

-- 3. Create coin_events table
create table if not exists public.coin_events (
  id          uuid        primary key default gen_random_uuid(),
  player_id   uuid        not null references public.profiles(id) on delete cascade,
  amount      integer     not null,
  source      text        not null check (source in (
                'game_courage', 'tutorial_core', 'tutorial_advanced', 'tutorial_legacy'
              )),
  match_id    uuid        references public.matches(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 4. Index for idempotency guard and history queries
create index if not exists idx_coin_events_player_source_match
  on public.coin_events (player_id, source, match_id);

-- 5. RLS on coin_events
alter table public.coin_events enable row level security;

create policy "Players read own coin events"
  on public.coin_events for select
  using (auth.uid() = player_id);

create policy "Service role inserts coin events"
  on public.coin_events for insert
  with check (true);

-- 6. Server-side function (called via service-role, no SECURITY DEFINER needed)
create or replace function public.award_coins_for_player(
  p_player_id  uuid,
  p_amount     integer,
  p_source     text,
  p_match_id   uuid default null
) returns void as $$
begin
  if exists (
    select 1 from public.coin_events
    where player_id = p_player_id
      and source = p_source
      and (match_id = p_match_id or (match_id is null and p_match_id is null))
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id)
  values (p_player_id, p_amount, p_source, p_match_id);

  update public.profiles
  set total_coins = total_coins + p_amount
  where id = p_player_id;
end;
$$ language plpgsql;

-- 7. Client-side function (SECURITY DEFINER — derives player from auth.uid())
create or replace function public.award_coins(
  p_amount    integer,
  p_source    text,
  p_match_id  uuid default null
) returns void as $$
declare
  v_player_id uuid := auth.uid();
begin
  if v_player_id is null then return; end if;

  if exists (
    select 1 from public.coin_events
    where player_id = v_player_id
      and source = p_source
      and (match_id = p_match_id or (match_id is null and p_match_id is null))
  ) then return; end if;

  insert into public.coin_events (player_id, amount, source, match_id)
  values (v_player_id, p_amount, p_source, p_match_id);

  update public.profiles
  set total_coins = total_coins + p_amount
  where id = v_player_id;
end;
$$ language plpgsql security definer;
