create extension if not exists pgcrypto;

create table if not exists public.boggle_games (
  id uuid primary key default gen_random_uuid(),
  game_code text not null unique check (char_length(game_code) = 4),
  board jsonb not null check (jsonb_typeof(board) = 'array'),
  board_size integer not null check (board_size > 0),
  started_at timestamptz not null default now(),
  duration_seconds integer not null default 180 check (duration_seconds > 0),
  status text not null default 'waiting' check (status in ('waiting', 'playing'))
);

create index if not exists boggle_games_game_code_idx on public.boggle_games (game_code);

create table if not exists public.boggle_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.boggle_games(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) > 0),
  words_found jsonb not null default '[]'::jsonb check (jsonb_typeof(words_found) = 'array'),
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now()
);

alter table public.boggle_games enable row level security;
alter table public.boggle_players enable row level security;

drop policy if exists "Allow all on boggle_games" on public.boggle_games;
create policy "Allow all on boggle_games"
on public.boggle_games
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow all on boggle_players" on public.boggle_players;
create policy "Allow all on boggle_players"
on public.boggle_players
for all
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'boggle_games'
  ) then
    alter publication supabase_realtime add table public.boggle_games;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'boggle_players'
  ) then
    alter publication supabase_realtime add table public.boggle_players;
  end if;
end;
$$;
