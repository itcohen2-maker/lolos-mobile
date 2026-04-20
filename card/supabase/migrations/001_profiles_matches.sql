-- ============================================================
-- 001_profiles_matches.sql — Player profiles + match history
-- Run this in Supabase SQL Editor after creating the project.
-- ============================================================

-- profiles: extends Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 15),
  rating int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  abandons int not null default 0,
  created_at timestamptz not null default now()
);

-- Auto-create profile on sign-up via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'player_' || left(new.id::text, 6)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- matches: completed game records
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  difficulty text,
  player_count int not null default 2,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  winner_id uuid references public.profiles(id)
);

-- match_participants: per-player result in a match
create table public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  rating_before int not null,
  rating_after int not null,
  abandoned boolean not null default false,
  primary key (match_id, player_id)
);

-- ── Row Level Security ──

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;

-- Profiles: anyone can read, users update only their own
create policy "Anyone can read profiles"
  on public.profiles for select using (true);
create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Matches: server inserts via service-role, anyone can read
create policy "Server inserts matches"
  on public.matches for insert with check (true);
create policy "Anyone reads matches"
  on public.matches for select using (true);

-- Participants: server inserts, anyone reads
create policy "Server inserts participants"
  on public.match_participants for insert with check (true);
create policy "Anyone reads participants"
  on public.match_participants for select using (true);

-- ── Indexes ──

create index idx_profiles_rating on public.profiles(rating desc);
create index idx_matches_ended on public.matches(ended_at desc);
create index idx_participants_player on public.match_participants(player_id);
