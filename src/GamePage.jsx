import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Lobby from './Lobby'
import Timer from './Timer'
import { activateGame, startGame, subscribeToGame } from './supabase/gameApi'
import {
  removePlayer,
  setGameData,
  setStatus,
  startCountdown,
  tick,
  tickCountdown,
  upsertPlayer,
} from './store/gameSlice'

function GamePage({ gameId }) {
  const dispatch = useDispatch()
  const gameState = useSelector((state) => state.game)
  const [game, setGame] = useState(null)
  const countdownIntervalRef = useRef(null)
  const gameIntervalRef = useRef(null)

  const currentGameId = game?.id ?? gameId ?? gameState.gameId

  useEffect(() => {
    dispatch(setStatus('waiting'))
  }, [dispatch])

  const boardPreview = useMemo(
    () => ({
      board: gameState.board,
      board_size: gameState.boardSize,
      game_code: game?.game_code,
    }),
    [game?.game_code, gameState.board, gameState.boardSize],
  )

  useEffect(() => {
    if (!currentGameId) {
      return undefined
    }

    const channel = subscribeToGame(
      currentGameId,
      (payload) => {
        const nextGame = payload.new

        if (!nextGame) {
          return
        }

        setGame(nextGame)
        dispatch(setGameData(nextGame))

        if (nextGame.status === 'countdown') {
          dispatch(
            startCountdown({
              startedAt: nextGame.started_at,
              durationSeconds: nextGame.duration_seconds,
            }),
          )
        }

        if (nextGame.status === 'playing') {
          dispatch(setStatus('playing'))
        }

        if (nextGame.status === 'finished') {
          dispatch(setStatus('finished'))
        }
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          dispatch(removePlayer(payload.old?.id))
          return
        }

        dispatch(upsertPlayer(payload.new))
      },
    )

    return () => {
      channel.unsubscribe()
    }
  }, [currentGameId, dispatch])

  useEffect(() => {
    if (gameState.status !== 'countdown') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }

      return undefined
    }

    if (!countdownIntervalRef.current) {
      countdownIntervalRef.current = setInterval(() => {
        dispatch(tickCountdown())
      }, 1000)
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [dispatch, gameState.status])

  useEffect(() => {
    if (gameState.status !== 'playing') {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current)
        gameIntervalRef.current = null
      }

      return undefined
    }

    if (!gameIntervalRef.current) {
      gameIntervalRef.current = setInterval(() => {
        dispatch(tick())
      }, 1000)
    }

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current)
        gameIntervalRef.current = null
      }
    }
  }, [dispatch, gameState.status])

  useEffect(() => {
    if (gameState.status === 'playing' && currentGameId) {
      activateGame(currentGameId).catch(() => {})
    }
  }, [currentGameId, gameState.status])

  const handleStartGame = async () => {
    if (!currentGameId) {
      return
    }

    const updatedGame = await startGame(currentGameId)
    setGame(updatedGame)
    dispatch(setGameData(updatedGame))

    if (updatedGame.status === 'countdown') {
      dispatch(
        startCountdown({
          startedAt: updatedGame.started_at,
          durationSeconds: updatedGame.duration_seconds,
        }),
      )
    }
  }

  return (
    <main style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <Lobby
        game={boardPreview}
        status={gameState.status}
        countdownRemaining={gameState.countdownRemaining}
        onStartGame={handleStartGame}
      />

      <Timer
        status={gameState.status}
        countdownRemaining={gameState.countdownRemaining}
        timeRemaining={gameState.timeRemaining}
      />
    </main>
  )
}

export default GamePage
