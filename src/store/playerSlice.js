import { createSlice } from '@reduxjs/toolkit'

function getInitialState() {
  return {
    playerId: null,
    displayName: '',
    wordsFound: [],
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

      if (Array.isArray(payload.words_found)) {
        state.wordsFound = payload.words_found
      } else if (Array.isArray(payload.wordsFound)) {
        state.wordsFound = payload.wordsFound
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
      }
    },
    removeWord(state, action) {
      const word = String(action.payload ?? '').trim().toLowerCase()

      if (!word) {
        return
      }

      state.wordsFound = state.wordsFound.filter((entry) => entry !== word)
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
