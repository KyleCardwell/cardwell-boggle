alter table public.boggle_players
add column if not exists ready_at timestamptz;

drop function if exists public.start_boggle_round(uuid, jsonb, timestamptz);

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
    words_round_started_at = v_started_at,
    ready_at = null
  where game_id = p_game_id;

  return v_game;
end;
$$;
