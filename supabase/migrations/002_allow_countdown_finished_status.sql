alter table public.boggle_games
  drop constraint if exists boggle_games_status_check;

alter table public.boggle_games
  add constraint boggle_games_status_check
  check (status in ('waiting', 'countdown', 'playing', 'finished'));
