import { createSlice } from '@reduxjs/toolkit'
import { addWordToRound, getWordText, removeWordFromRound } from '../utils/roundWords'

function getInitialState() {
  return {
    playerId: null,
    displayName: '',
    wordsFound: [],
    wordsRoundStartedAt: null,
    readyAt: null,
    wordCount: 0,
    score: 0,
  }
}

const playerSlice = createSlice({
  name: 'player',
  initialState: getInitialState(),
  reducers: {
    setPlayer(state, action) {
      const payload = action.payload ?? {}

      state.playerId = payload.id ?? payload.playerId ?? state.playerId
      state.displayName = payload.display_name ?? payload.displayName ?? state.displayName
      if (
        Object.prototype.hasOwnProperty.call(payload, 'words_round_started_at') ||
        Object.prototype.hasOwnProperty.call(payload, 'wordsRoundStartedAt')
      ) {
        state.wordsRoundStartedAt = payload.words_round_started_at ?? payload.wordsRoundStartedAt ?? null
      }

      if (
        Object.prototype.hasOwnProperty.call(payload, 'ready_at') ||
        Object.prototype.hasOwnProperty.call(payload, 'readyAt')
      ) {
        state.readyAt = payload.ready_at ?? payload.readyAt ?? null
      }

      if (Array.isArray(payload.words_found)) {
        state.wordsFound = payload.words_found
      } else if (Array.isArray(payload.wordsFound)) {
        state.wordsFound = payload.wordsFound
      }

      const wordCount = Number(payload.word_count ?? payload.wordCount)
      if (Number.isInteger(wordCount) && wordCount >= 0) {
        state.wordCount = wordCount
      } else {
        state.wordCount = state.wordsFound.length
      }

      const score = Number(payload.score)
      if (Number.isInteger(score) && score >= 0) {
        state.score = score
      }
    },
    addWord(state, action) {
      const payload = action.payload
      const word = getWordText(payload)

      if (!word) {
        return
      }

      state.wordsFound = addWordToRound(
        state.wordsFound,
        word,
        payload?.gameId ?? payload?.game_id,
        payload?.roundId ?? payload?.round_id ?? payload?.roundStartedAt ?? payload?.round_started_at,
      )
      state.wordCount = state.wordsFound.length
    },
    removeWord(state, action) {
      const word = getWordText(action.payload)

      if (!word) {
        return
      }

      state.wordsFound = removeWordFromRound(state.wordsFound, word)
      state.wordCount = state.wordsFound.length
    },
    setScore(state, action) {
      const score = Number(action.payload)

      if (!Number.isInteger(score) || score < 0) {
        return
      }

      state.score = score
    },
    resetPlayer() {
      return getInitialState()
    },
  },
})

export const {
  setPlayer,
  addWord,
  removeWord,
  setScore,
  resetPlayer,
} = playerSlice.actions

export default playerSlice.reducer
