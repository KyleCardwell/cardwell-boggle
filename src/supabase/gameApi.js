import { generateBoard } from '../utils/boardGenerator';
import { supabase } from './client';

const GAME_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GAME_CODE_LENGTH = 4;
const MAX_CREATE_GAME_ATTEMPTS = 10;
const COUNTDOWN_LEAD_MS = 10_000;

function generateGameCode() {
  let code = '';

  for (let index = 0; index < GAME_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * GAME_CODE_CHARACTERS.length);
    code += GAME_CODE_CHARACTERS[randomIndex];
  }

  return code;
}

function parseSingleResult(data, error, contextMessage) {
  if (error) {
    throw new Error(`${contextMessage}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`${contextMessage}: no data returned.`);
  }

  return data;
}

export async function createGame(boardSize, durationSeconds) {
  const normalizedBoardSize = Number(boardSize);
  const normalizedDurationSeconds = Number(durationSeconds);

  if (!Number.isInteger(normalizedBoardSize) || normalizedBoardSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  if (!Number.isInteger(normalizedDurationSeconds) || normalizedDurationSeconds <= 0) {
    throw new Error('Duration must be a positive integer (seconds).');
  }

  const board = generateBoard(normalizedBoardSize);

  for (let attempt = 0; attempt < MAX_CREATE_GAME_ATTEMPTS; attempt += 1) {
    const gameCode = generateGameCode();

    const { data, error } = await supabase
      .from('boggle_games')
      .insert({
        game_code: gameCode,
        board,
        board_size: normalizedBoardSize,
        duration_seconds: normalizedDurationSeconds,
        status: 'waiting',
      })
      .select('*')
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code !== '23505') {
      throw new Error(`Failed to create game: ${error?.message ?? 'unknown error'}`);
    }
  }

  throw new Error('Failed to create a unique game code after multiple attempts.');
}

export async function joinGame(gameCode, displayName) {
  const normalizedGameCode = String(gameCode ?? '').trim().toUpperCase();
  const normalizedDisplayName = String(displayName ?? '').trim();

  if (normalizedGameCode.length !== GAME_CODE_LENGTH) {
    throw new Error('Game code must be a 4-character code.');
  }

  if (!normalizedDisplayName) {
    throw new Error('Display name is required.');
  }

  const gameQuery = await supabase
    .from('boggle_games')
    .select('*')
    .eq('game_code', normalizedGameCode)
    .maybeSingle();

  if (gameQuery.error) {
    throw new Error(`Failed to load game: ${gameQuery.error.message}`);
  }

  if (!gameQuery.data) {
    throw new Error('Game not found.');
  }

  const playerInsert = await supabase
    .from('boggle_players')
    .insert({
      game_id: gameQuery.data.id,
      display_name: normalizedDisplayName,
    })
    .select('*')
    .single();

  const player = parseSingleResult(playerInsert.data, playerInsert.error, 'Failed to join game');

  return {
    game: gameQuery.data,
    player,
  };
}

export async function startGame(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const countdownStartAt = new Date(Date.now() + COUNTDOWN_LEAD_MS).toISOString();

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      started_at: countdownStartAt,
      status: 'countdown',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to start game');
}

export async function activateGame(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      status: 'playing',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to activate game');
}

export async function submitWords(playerId, words) {
  const normalizedPlayerId = String(playerId ?? '').trim();

  if (!normalizedPlayerId) {
    throw new Error('Player ID is required.');
  }

  if (!Array.isArray(words)) {
    throw new Error('Words must be an array.');
  }

  const normalizedWords = words
    .map((word) => String(word ?? '').trim().toLowerCase())
    .filter((word) => word.length > 0);

  const updateResult = await supabase
    .from('boggle_players')
    .update({
      words_found: normalizedWords,
    })
    .eq('id', normalizedPlayerId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to submit words');
}

export async function endGame(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      status: 'finished',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to end game');
}

export function subscribeToGame(gameId, onGameUpdate, onPlayersUpdate) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  if (typeof onGameUpdate !== 'function') {
    throw new Error('onGameUpdate must be a function.');
  }

  if (typeof onPlayersUpdate !== 'function') {
    throw new Error('onPlayersUpdate must be a function.');
  }

  const channel = supabase.channel(`game:${normalizedGameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boggle_games',
        filter: `id=eq.${normalizedGameId}`,
      },
      (payload) => {
        onGameUpdate(payload);
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boggle_players',
        filter: `game_id=eq.${normalizedGameId}`,
      },
      (payload) => {
        onPlayersUpdate(payload);
      },
    )
    .subscribe();

  return channel;
}
