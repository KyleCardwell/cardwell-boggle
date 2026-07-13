import { generateBoard, generatePlayableBoard } from '../utils/boardGenerator';
import { loadDictionary } from '../utils/dictionary';
import { scoreWord } from '../utils/scoring';
import { BOARD_SIZES } from '../constants/gameSettings';
import { getMinimumWordLength } from '../utils/wordValidation';
import { supabase } from './client';

const GAME_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GAME_CODE_LENGTH = 4;
const MAX_CREATE_GAME_ATTEMPTS = 10;
const COUNTDOWN_LEAD_MS = 10_000;

function isSupportedBoardSize(boardSize) {
  return Number.isInteger(boardSize) && BOARD_SIZES.includes(boardSize);
}

function normalizeWords(words, minimumWordLength) {
  if (!Array.isArray(words)) {
    return [];
  }

  return words
    .map((word) => String(word ?? '').trim().toLowerCase())
    .filter((word) => word.length >= minimumWordLength);
}

function getSharedWordSet(players, minimumWordLength) {
  const playerCountByWord = new Map();

  for (const player of Array.isArray(players) ? players : []) {
    const uniqueWords = new Set(normalizeWords(player?.words_found, minimumWordLength));

    for (const word of uniqueWords) {
      playerCountByWord.set(word, (playerCountByWord.get(word) ?? 0) + 1);
    }
  }

  return new Set(
    Array.from(playerCountByWord.entries())
      .filter(([, count]) => count > 1)
      .map(([word]) => word),
  );
}

function buildRoundPlayerSummaries(players, boardSize) {
  const minimumWordLength = getMinimumWordLength(boardSize);
  const sharedWordSet = getSharedWordSet(players, minimumWordLength);

  return (Array.isArray(players) ? players : [])
    .map((player) => {
      const validWords = normalizeWords(player?.words_found, minimumWordLength);
      const score = validWords.reduce(
        (total, word) => total + (sharedWordSet.has(word) ? 0 : scoreWord(word)),
        0,
      );

      return {
        player_id: player?.id,
        display_name: String(player?.display_name ?? '').trim(),
        score,
        words_found: validWords.length,
      };
    })
    .filter((summary) => summary.player_id && summary.display_name);
}

function generateGameCode() {
  let code = '';

  for (let index = 0; index < GAME_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * GAME_CODE_CHARACTERS.length);
    code += GAME_CODE_CHARACTERS[randomIndex];
  }

  return code;
}

async function generateFreshBoard(boardSize) {
  try {
    const dictionary = await loadDictionary();
    return generatePlayableBoard(boardSize, dictionary, { candidateBoardCount: 24 });
  } catch {
    return generateBoard(boardSize);
  }
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

export async function getGameByCode(gameCode) {
  const normalizedGameCode = String(gameCode ?? '').trim().toUpperCase();

  if (normalizedGameCode.length !== GAME_CODE_LENGTH) {
    throw new Error('Game code must be a 4-character code.');
  }

  const query = await supabase
    .from('boggle_games')
    .select('*')
    .eq('game_code', normalizedGameCode)
    .maybeSingle();

  if (query.error) {
    throw new Error(`Failed to load game: ${query.error.message}`);
  }

  if (!query.data) {
    throw new Error('Game not found.');
  }

  return query.data;
}

export async function getPlayersByGameId(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const query = await supabase
    .from('boggle_players')
    .select('*')
    .eq('game_id', normalizedGameId)
    .order('joined_at', { ascending: true });

  if (query.error) {
    throw new Error(`Failed to load players: ${query.error.message}`);
  }

  return Array.isArray(query.data) ? query.data : [];
}

export async function createGame(boardSize, durationSeconds) {
  const normalizedBoardSize = Number(boardSize);
  const normalizedDurationSeconds = Number(durationSeconds);

  if (!isSupportedBoardSize(normalizedBoardSize)) {
    throw new Error(`Board size must be one of: ${BOARD_SIZES.join(', ')}.`);
  }

  if (!Number.isInteger(normalizedDurationSeconds) || normalizedDurationSeconds <= 0) {
    throw new Error('Duration must be a positive integer (seconds).');
  }

  const board = await generateFreshBoard(normalizedBoardSize);

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

export async function updateWaitingGameSettings(gameId, { boardSize, durationSeconds }) {
  const normalizedGameId = String(gameId ?? '').trim();
  const normalizedBoardSize = Number(boardSize);
  const normalizedDurationSeconds = Number(durationSeconds);

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  if (!isSupportedBoardSize(normalizedBoardSize)) {
    throw new Error(`Board size must be one of: ${BOARD_SIZES.join(', ')}.`);
  }

  if (!Number.isInteger(normalizedDurationSeconds) || normalizedDurationSeconds <= 0) {
    throw new Error('Duration must be a positive integer (seconds).');
  }

  const board = await generateFreshBoard(normalizedBoardSize);

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      board,
      board_size: normalizedBoardSize,
      duration_seconds: normalizedDurationSeconds,
    })
    .eq('id', normalizedGameId)
    .eq('status', 'waiting')
    .select('*');

  if (updateResult.error) {
    throw new Error(`Failed to update game settings: ${updateResult.error.message}`);
  }

  const updatedGame = Array.isArray(updateResult.data) ? updateResult.data[0] : null;

  if (!updatedGame) {
    throw new Error('Game settings can only be updated while waiting.');
  }

  return updatedGame;
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

export async function pauseGame(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      status: 'paused',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to pause game');
}

export async function resumeGame(gameId, { resumeStatus, remainingSeconds, durationSeconds }) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  if (resumeStatus !== 'countdown' && resumeStatus !== 'playing') {
    throw new Error('Resume status must be countdown or playing.');
  }

  const normalizedRemainingSeconds = Math.max(0, Number(remainingSeconds) || 0);
  const normalizedDurationSeconds = Number(durationSeconds);
  const updatePayload = {
    status: resumeStatus,
  };

  if (resumeStatus === 'countdown') {
    const countdownStartAt = new Date(Date.now() + (normalizedRemainingSeconds * 1000)).toISOString();
    updatePayload.started_at = countdownStartAt;
  } else {
    if (!Number.isInteger(normalizedDurationSeconds) || normalizedDurationSeconds <= 0) {
      throw new Error('Duration is required to resume a playing game.');
    }

    const elapsedSeconds = Math.max(0, normalizedDurationSeconds - normalizedRemainingSeconds);
    const startedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();
    updatePayload.started_at = startedAt;
  }

  const updateResult = await supabase
    .from('boggle_games')
    .update(updatePayload)
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to resume game');
}

export async function restartGame(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const gameQuery = await supabase
    .from('boggle_games')
    .select('board_size')
    .eq('id', normalizedGameId)
    .maybeSingle();

  if (gameQuery.error) {
    throw new Error(`Failed to load game: ${gameQuery.error.message}`);
  }

  const boardSize = Number(gameQuery.data?.board_size);

  if (!Number.isInteger(boardSize) || boardSize <= 0) {
    throw new Error('Unable to restart game: invalid board size.');
  }

  const board = await generateFreshBoard(boardSize);

  const playersResetResult = await supabase
    .from('boggle_players')
    .update({
      words_found: [],
      score: 0,
    })
    .eq('game_id', normalizedGameId);

  if (playersResetResult.error) {
    throw new Error(`Failed to reset player words: ${playersResetResult.error.message}`);
  }

  const countdownStartAt = new Date(Date.now() + COUNTDOWN_LEAD_MS).toISOString();

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      board,
      started_at: countdownStartAt,
      status: 'countdown',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to restart game');
}

export async function resetGameToWaiting(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const gameQuery = await supabase
    .from('boggle_games')
    .select('board_size')
    .eq('id', normalizedGameId)
    .maybeSingle();

  if (gameQuery.error) {
    throw new Error(`Failed to load game: ${gameQuery.error.message}`);
  }

  const boardSize = Number(gameQuery.data?.board_size);

  if (!Number.isInteger(boardSize) || boardSize <= 0) {
    throw new Error('Unable to reset game: invalid board size.');
  }

  const board = await generateFreshBoard(boardSize);

  const playersResetResult = await supabase
    .from('boggle_players')
    .update({
      words_found: [],
      score: 0,
    })
    .eq('game_id', normalizedGameId);

  if (playersResetResult.error) {
    throw new Error(`Failed to reset player words: ${playersResetResult.error.message}`);
  }

  const updateResult = await supabase
    .from('boggle_games')
    .update({
      board,
      started_at: new Date().toISOString(),
      status: 'waiting',
    })
    .eq('id', normalizedGameId)
    .select('*')
    .single();

  return parseSingleResult(updateResult.data, updateResult.error, 'Failed to reset game to waiting state');
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

export async function saveRoundResults(gameId, players, boardSize) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const playerSummaries = buildRoundPlayerSummaries(players, boardSize);

  if (playerSummaries.length === 0) {
    return [];
  }

  const maxRoundQuery = await supabase
    .from('boggle_rounds')
    .select('round_number')
    .eq('game_id', normalizedGameId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxRoundQuery.error) {
    throw new Error(`Failed to determine next round number: ${maxRoundQuery.error.message}`);
  }

  const latestRoundNumber = Number(maxRoundQuery.data?.round_number ?? 0);
  const nextRoundNumber = Number.isInteger(latestRoundNumber) && latestRoundNumber > 0
    ? latestRoundNumber + 1
    : 1;
  const highestScore = Math.max(...playerSummaries.map((summary) => summary.score));

  const roundRows = playerSummaries.map((summary) => ({
    game_id: normalizedGameId,
    round_number: nextRoundNumber,
    player_id: summary.player_id,
    display_name: summary.display_name,
    score: summary.score,
    words_found: summary.words_found,
    is_winner: summary.score === highestScore,
  }));

  const insertQuery = await supabase
    .from('boggle_rounds')
    .insert(roundRows)
    .select('*')
    .order('score', { ascending: false });

  if (insertQuery.error) {
    throw new Error(`Failed to save round results: ${insertQuery.error.message}`);
  }

  return Array.isArray(insertQuery.data) ? insertQuery.data : [];
}

export async function getRoundHistory(gameId) {
  const normalizedGameId = String(gameId ?? '').trim();

  if (!normalizedGameId) {
    throw new Error('Game ID is required.');
  }

  const query = await supabase
    .from('boggle_rounds')
    .select('*')
    .eq('game_id', normalizedGameId)
    .order('round_number', { ascending: true })
    .order('score', { ascending: false });

  if (query.error) {
    throw new Error(`Failed to load round history: ${query.error.message}`);
  }

  return Array.isArray(query.data) ? query.data : [];
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
    .in('status', ['countdown', 'playing', 'paused'])
    .select('*')
    .maybeSingle();

  const endedGame = parseSingleResult(
    updateResult.data,
    updateResult.error,
    'Failed to end game',
  );

  const players = await getPlayersByGameId(normalizedGameId);
  await saveRoundResults(normalizedGameId, players, endedGame.board_size);

  return endedGame;
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
