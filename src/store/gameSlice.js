import { createSlice } from '@reduxjs/toolkit'

function getInitialState() {
  return {
    gameId: null,
    gameCode: null,
    board: [],
    boardSize: 0,
    status: 'idle',
    startedAt: null,
    durationSeconds: 180,
    allWords: [],
    roundHistory: [],
    players: [],
    countdownRemaining: null,
    timeRemaining: 0,
  }
}

function getSecondsUntil(timestampMs) {
  return Math.max(0, Math.ceil((timestampMs - Date.now()) / 1000))
}

function applyGamePayload(state, game) {
  if (!game) {
    return
  }

  state.gameId = game.id ?? game.gameId ?? state.gameId
  state.gameCode = game.game_code ?? game.gameCode ?? state.gameCode
  state.board = Array.isArray(game.board) ? game.board : state.board

  const boardSize = Number(game.board_size ?? game.boardSize)
  if (Number.isInteger(boardSize) && boardSize > 0) {
    state.boardSize = boardSize
  }

  const duration = Number(game.duration_seconds ?? game.durationSeconds)
  if (Number.isInteger(duration) && duration > 0) {
    state.durationSeconds = duration
  }

  if (typeof game.status === 'string') {
    state.status = game.status
  }

  const startedAt = game.started_at ?? game.startedAt
  if (startedAt) {
    state.startedAt = startedAt
  }

  if (Array.isArray(game.allWords)) {
    state.allWords = game.allWords
  }

  if (Array.isArray(game.players)) {
    state.players = game.players
  }

  const startedAtMs = new Date(state.startedAt).getTime()

  if (state.status === 'countdown' && !Number.isNaN(startedAtMs)) {
    state.countdownRemaining = getSecondsUntil(startedAtMs)
  }

  if (state.status === 'playing') {
    if (!Number.isNaN(startedAtMs)) {
      const endAtMs = startedAtMs + (state.durationSeconds * 1000)
      state.timeRemaining = getSecondsUntil(endAtMs)
    } else if (state.timeRemaining <= 0) {
      state.timeRemaining = state.durationSeconds
    }
  }
}

const gameSlice = createSlice({
  name: 'game',
  initialState: getInitialState(),
  reducers: {
    setGame(state, action) {
      applyGamePayload(state, action.payload)
    },
    setGameData(state, action) {
      applyGamePayload(state, action.payload)
    },
    updateGameStatus(state, action) {
      const nextStatus = action.payload

      if (typeof nextStatus !== 'string') {
        return
      }

      state.status = nextStatus

      if (nextStatus === 'playing' && state.timeRemaining <= 0) {
        state.timeRemaining = state.durationSeconds
      }
    },
    setStatus(state, action) {
      const nextStatus = action.payload

      if (typeof nextStatus !== 'string') {
        return
      }

      state.status = nextStatus

      if (nextStatus === 'playing' && state.timeRemaining <= 0) {
        state.timeRemaining = state.durationSeconds
      }
    },
    setPlayers(state, action) {
      state.players = Array.isArray(action.payload) ? action.payload : []
    },
    updatePlayer(state, action) {
      const player = action.payload

      if (!player || !player.id) {
        return
      }

      const existingIndex = state.players.findIndex((entry) => entry.id === player.id)

      if (existingIndex < 0) {
        state.players.push(player)
        return
      }

      state.players[existingIndex] = player
    },
    upsertPlayer(state, action) {
      const player = action.payload

      if (!player || !player.id) {
        return
      }

      const existingIndex = state.players.findIndex((entry) => entry.id === player.id)

      if (existingIndex < 0) {
        state.players.push(player)
        return
      }

      state.players[existingIndex] = player
    },
    removePlayer(state, action) {
      const playerId = action.payload

      if (!playerId) {
        return
      }

      state.players = state.players.filter((player) => player.id !== playerId)
    },
    setAllWords(state, action) {
      state.allWords = Array.isArray(action.payload) ? action.payload : []
    },
    setRoundHistory(state, action) {
      state.roundHistory = Array.isArray(action.payload) ? action.payload : []
    },
    startCountdown(state, action) {
      const payload = action.payload
      const startedAtValue = typeof payload === 'string' ? payload : payload?.startedAt
      const durationSecondsValue = payload?.durationSeconds
      const startedAtMs = new Date(startedAtValue).getTime()

      if (Number.isInteger(durationSecondsValue) && durationSecondsValue > 0) {
        state.durationSeconds = durationSecondsValue
      }

      state.status = 'countdown'
      state.startedAt = startedAtValue ?? null

      if (Number.isNaN(startedAtMs)) {
        state.countdownRemaining = 0
        return
      }

      state.countdownRemaining = Math.max(0, Math.ceil((startedAtMs - Date.now()) / 1000))
    },
    tickCountdown(state) {
      if (state.status !== 'countdown' || state.countdownRemaining == null) {
        return
      }

      if (state.countdownRemaining <= 1) {
        state.countdownRemaining = 0
        state.status = 'playing'
        state.timeRemaining = state.durationSeconds
        return
      }

      state.countdownRemaining -= 1
    },
    syncCountdown(state) {
      if (state.status !== 'countdown' || !state.startedAt) {
        return
      }

      const startedAtMs = new Date(state.startedAt).getTime()

      if (Number.isNaN(startedAtMs)) {
        return
      }

      const seconds = getSecondsUntil(startedAtMs)
      state.countdownRemaining = seconds

      if (seconds <= 0) {
        state.status = 'playing'
        state.timeRemaining = state.durationSeconds
      }
    },
    syncTimerFromStart(state) {
      if (state.status !== 'playing' || !state.startedAt) {
        return
      }

      const startedAtMs = new Date(state.startedAt).getTime()

      if (Number.isNaN(startedAtMs)) {
        return
      }

      const endAtMs = startedAtMs + (state.durationSeconds * 1000)
      state.timeRemaining = getSecondsUntil(endAtMs)
    },
    tick(state) {
      if (state.status !== 'playing') {
        return
      }

      if (state.timeRemaining <= 1) {
        state.timeRemaining = 0
        state.status = 'finished'
        return
      }

      state.timeRemaining -= 1
    },
    resetGame() {
      return getInitialState()
    },
  },
})

export const {
  setGame,
  setGameData,
  updateGameStatus,
  setStatus,
  setPlayers,
  updatePlayer,
  upsertPlayer,
  removePlayer,
  setAllWords,
  setRoundHistory,
  startCountdown,
  tickCountdown,
  syncCountdown,
  syncTimerFromStart,
  tick,
  resetGame,
} = gameSlice.actions

export default gameSlice.reducer
