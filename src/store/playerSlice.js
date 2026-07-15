import { createSlice } from '@reduxjs/toolkit'

function getInitialState() {
  return {
    playerId: null,
    displayName: '',
    wordsFound: [],
    wordsRoundStartedAt: null,
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
      const word = String(action.payload ?? '').trim().toLowerCase()

      if (!word) {
        return
      }

      if (!state.wordsFound.includes(word)) {
        state.wordsFound.push(word)
        state.wordCount = state.wordsFound.length
      }
    },
    removeWord(state, action) {
      const word = String(action.payload ?? '').trim().toLowerCase()

      if (!word) {
        return
      }

      state.wordsFound = state.wordsFound.filter((entry) => entry !== word)
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
