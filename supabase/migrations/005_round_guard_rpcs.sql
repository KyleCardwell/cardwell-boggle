alter table public.boggle_players
add column if not exists words_round_started_at timestamptz;

alter table public.boggle_players
add column if not exists word_count integer not null default 0 check (word_count >= 0);

create or replace function public.start_boggle_round(
  p_game_id uuid,
  p_board jsonb default null,
  p_started_at timestamptz default null
)
returns public.boggle_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz := coalesce(p_started_at, now() + interval '10 seconds');
  v_game public.boggle_games;
begin
  if p_game_id is null then
    raise exception 'Game ID is required.';
  end if;

  if p_board is not null and jsonb_typeof(p_board) <> 'array' then
    raise exception 'Board must be an array.';
  end if;

  update public.boggle_games
  set
    board = coalesce(p_board, board),
    started_at = v_started_at,
    status = 'countdown'
  where id = p_game_id
  returning * into v_game;

  if not found then
    raise exception 'Game not found.';
  end if;

  update public.boggle_players
  set
    words_found = '[]'::jsonb,
    score = 0,
    word_count = 0,
    words_round_started_at = v_started_at
  where game_id = p_game_id;

  return v_game;
end;
$$;

create or replace function public.submit_boggle_words_for_round(
  p_player_id uuid,
  p_game_id uuid,
  p_round_started_at timestamptz,
  p_words jsonb,
  p_grace_seconds integer default 5
)
returns public.boggle_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_started_at timestamptz;
  v_duration_seconds integer;
  v_status text;
  v_grace_seconds integer := greatest(coalesce(p_grace_seconds, 0), 0);
  v_normalized_words jsonb;
  v_player public.boggle_players;
begin
  if p_player_id is null then
    raise exception 'Player ID is required.';
  end if;

  if p_game_id is null then
    raise exception 'Game ID is required.';
  end if;

  if p_round_started_at is null then
    raise exception 'Round start is required.';
  end if;

  if p_words is null or jsonb_typeof(p_words) <> 'array' then
    raise exception 'Words must be an array.';
  end if;

  select g.started_at, g.duration_seconds, g.status
  into v_game_started_at, v_duration_seconds, v_status
  from public.boggle_games g
  join public.boggle_players p on p.game_id = g.id
  where g.id = p_game_id
    and p.id = p_player_id
  for update of p;

  if not found then
    raise exception 'Player is not in this game.';
  end if;

  if p_round_started_at <> v_game_started_at then
    raise exception 'Words are from a stale round.';
  end if;

  if v_status <> 'playing' then
    raise exception 'Words can only be submitted while the round is playing.';
  end if;

  if now() > v_game_started_at + make_interval(secs => v_duration_seconds + v_grace_seconds) then
    raise exception 'Round has ended.';
  end if;

  select coalesce(jsonb_agg(word order by first_seen_at), '[]'::jsonb)
  into v_normalized_words
  from (
    select lower(trim(value)) as word, min(ordinality) as first_seen_at
    from jsonb_array_elements_text(p_words) with ordinality
    where length(trim(value)) > 0
    group by lower(trim(value))
  ) normalized;

  update public.boggle_players
  set
    words_found = v_normalized_words,
    word_count = jsonb_array_length(v_normalized_words),
    words_round_started_at = v_game_started_at
  where id = p_player_id
    and game_id = p_game_id
  returning * into v_player;

  return v_player;
end;
$$;

create or replace function public.finish_boggle_round(
  p_game_id uuid,
  p_grace_seconds integer default 5,
  p_force boolean default false
)
returns public.boggle_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.boggle_games;
  v_grace_seconds integer := greatest(coalesce(p_grace_seconds, 0), 0);
begin
  if p_game_id is null then
    raise exception 'Game ID is required.';
  end if;

  select *
  into v_game
  from public.boggle_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if v_game.status = 'finished' then
    raise exception 'Round is already finished.';
  end if;

  if v_game.status not in ('countdown', 'playing', 'paused') then
    raise exception 'Round cannot be finished from the current status.';
  end if;

  if not p_force
    and now() < v_game.started_at + make_interval(secs => v_game.duration_seconds + v_grace_seconds)
  then
    raise exception 'Round is still accepting submissions.';
  end if;

  update public.boggle_games
  set status = 'finished'
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;
