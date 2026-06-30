create table if not exists public.boggle_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.boggle_games(id) on delete cascade,
  round_number integer not null default 1 check (round_number > 0),
  player_id uuid not null references public.boggle_players(id) on delete cascade,
  display_name text not null,
  score integer not null default 0,
  words_found integer not null default 0,
  is_winner boolean not null default false,
  finished_at timestamptz not null default now()
);

create index if not exists boggle_rounds_game_id_idx on public.boggle_rounds (game_id);

alter table public.boggle_rounds enable row level security;

drop policy if exists "Allow all on boggle_rounds" on public.boggle_rounds;
create policy "Allow all on boggle_rounds"
on public.boggle_rounds
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
      and tablename = 'boggle_rounds'
  ) then
    alter publication supabase_realtime add table public.boggle_rounds;
  end if;
end;
$$;
