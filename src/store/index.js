import { configureStore } from '@reduxjs/toolkit'
import gameReducer from './gameSlice'
import playerReducer from './playerSlice'

export const store = configureStore({
  reducer: {
    game: gameReducer,
    player: playerReducer,
  },
})
