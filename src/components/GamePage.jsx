import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import Board from './Board'
import Lobby from './Lobby'
import PlayerList from './PlayerList'
import Results from './Results'
import Timer from './Timer'
import WordInput from './WordInput'
import {
  activateGame,
  endGame,
  getGameByCode,
  getPlayersByGameId,
  startGame,
  submitWords,
  subscribeToGame,
} from '../supabase/gameApi'
import { loadDictionary } from '../utils/dictionary'
import { findAllWords } from '../utils/boardSolver'
import {
  removePlayer,
  setAllWords,
  setGame,
  setPlayers,
  startCountdown,
  syncCountdown,
  syncTimerFromStart,
  tickCountdown,
  updateGameStatus,
  updatePlayer,
} from '../store/gameSlice'
import { addWord, removeWord, setPlayer, setScore } from '../store/playerSlice'
import { scoreWords } from '../utils/scoring'

function GamePage() {
  const { gameCode } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const game = useSelector((state) => state.game)
  const player = useSelector((state) => state.player)

  const [dictionary, setDictionary] = useState(null)
  const [loadingError, setLoadingError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const activatedRef = useRef(false)
  const endingRef = useRef(false)

  const normalizedGameCode = String(gameCode ?? '').trim().toUpperCase()

  const hostId = useMemo(() => {
    const sorted = [...game.players].sort((a, b) => {
      const aTime = new Date(a.joined_at).getTime()
      const bTime = new Date(b.joined_at).getTime()
      return aTime - bTime
    })

    return sorted[0]?.id ?? null
  }, [game.players])

  const canStart =
    game.status === 'waiting' && game.players.length >= 1 && player.playerId && player.playerId === hostId

  useEffect(() => {
    let cancelled = false

    async function initializePage() {
      if (!normalizedGameCode) {
        setLoadingError('Missing game code.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadingError('')

      try {
        const [dictionarySet, gameRow] = await Promise.all([
          loadDictionary(),
          getGameByCode(normalizedGameCode),
        ])

        if (cancelled) {
          return
        }

        const players = await getPlayersByGameId(gameRow.id)

        if (cancelled) {
          return
        }

        setDictionary(dictionarySet)
        dispatch(setGame(gameRow))
        dispatch(setPlayers(players))

        if (gameRow.status === 'countdown') {
          dispatch(
            startCountdown({
              startedAt: gameRow.started_at,
              durationSeconds: gameRow.duration_seconds,
            }),
          )
        }

        setIsLoading(false)
      } catch (error) {
        if (!cancelled) {
          setLoadingError(error.message || 'Unable to load game.')
          setIsLoading(false)
        }
      }
    }

    initializePage()

    return () => {
      cancelled = true
    }
  }, [dispatch, normalizedGameCode])

  useEffect(() => {
    if (!game.gameId) {
      return undefined
    }

    const channel = subscribeToGame(
      game.gameId,
      (payload) => {
        const nextGame = payload.new

        if (!nextGame) {
          return
        }

        dispatch(setGame(nextGame))

        if (nextGame.status === 'countdown') {
          dispatch(
            startCountdown({
              startedAt: nextGame.started_at,
              durationSeconds: nextGame.duration_seconds,
            }),
          )
        }

        if (nextGame.status === 'playing') {
          dispatch(updateGameStatus('playing'))
        }

        if (nextGame.status === 'finished') {
          dispatch(updateGameStatus('finished'))
        }
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          dispatch(removePlayer(payload.old?.id))
          return
        }

        const updatedPlayer = payload.new

        if (!updatedPlayer) {
          return
        }

        dispatch(updatePlayer(updatedPlayer))

        if (updatedPlayer.id === player.playerId) {
          dispatch(setPlayer(updatedPlayer))
          dispatch(setScore(scoreWords(updatedPlayer.words_found)))
        }
      },
    )

    return () => {
      channel.unsubscribe()
    }
  }, [dispatch, game.gameId, player.playerId])

  useEffect(() => {
    if (game.status !== 'countdown' && game.status !== 'playing') {
      return undefined
    }

    const intervalId = setInterval(() => {
      if (game.status === 'countdown') {
        dispatch(tickCountdown())
        dispatch(syncCountdown())
      } else if (game.status === 'playing') {
        dispatch(syncTimerFromStart())
      }
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [dispatch, game.status])

  useEffect(() => {
    if (game.status === 'playing' && game.gameId && !activatedRef.current) {
      activatedRef.current = true
      activateGame(game.gameId).catch(() => {})
      return
    }

    if (game.status !== 'playing') {
      activatedRef.current = false
    }
  }, [game.gameId, game.status])

  useEffect(() => {
    if (
      game.status === 'finished' &&
      dictionary &&
      Array.isArray(game.board) &&
      game.board.length > 0 &&
      game.boardSize > 0 &&
      game.allWords.length === 0
    ) {
      const allWords = findAllWords(game.board, game.boardSize, dictionary)
      dispatch(setAllWords(allWords))
    }
  }, [dictionary, dispatch, game.allWords.length, game.board, game.boardSize, game.status])

  const handleStartGame = async () => {
    if (!game.gameId) {
      return
    }

    const updatedGame = await startGame(game.gameId)
    dispatch(setGame(updatedGame))
    dispatch(
      startCountdown({
        startedAt: updatedGame.started_at,
        durationSeconds: updatedGame.duration_seconds,
      }),
    )
  }

  const persistWords = async (nextWords) => {
    if (!player.playerId) {
      throw new Error('You must join the game before submitting words.')
    }

    await submitWords(player.playerId, nextWords)
  }

  const handleSubmitWord = async (word) => {
    const normalizedWord = String(word ?? '').trim().toLowerCase()

    if (!normalizedWord || player.wordsFound.includes(normalizedWord)) {
      return
    }

    const nextWords = [...player.wordsFound, normalizedWord]

    dispatch(addWord(normalizedWord))
    dispatch(setScore(scoreWords(nextWords)))

    try {
      await persistWords(nextWords)
    } catch (error) {
      dispatch(removeWord(normalizedWord))
      dispatch(setScore(scoreWords(player.wordsFound)))
      throw error
    }
  }

  const handleRemoveWord = async (word) => {
    const normalizedWord = String(word ?? '').trim().toLowerCase()

    if (!normalizedWord || !player.wordsFound.includes(normalizedWord)) {
      return
    }

    const nextWords = player.wordsFound.filter((entry) => entry !== normalizedWord)

    dispatch(removeWord(normalizedWord))
    dispatch(setScore(scoreWords(nextWords)))

    try {
      await persistWords(nextWords)
    } catch {
      dispatch(addWord(normalizedWord))
      dispatch(setScore(scoreWords(player.wordsFound)))
    }
  }

  const handleTimerExpired = async () => {
    if (endingRef.current || !game.gameId) {
      return
    }

    endingRef.current = true

    try {
      await endGame(game.gameId)
    } catch {
      endingRef.current = false
    }

    if (dictionary && game.board.length > 0 && game.boardSize > 0) {
      const allWords = findAllWords(game.board, game.boardSize, dictionary)
      dispatch(setAllWords(allWords))
    }

    dispatch(updateGameStatus('finished'))
  }

  useEffect(() => {
    if (game.status !== 'playing') {
      endingRef.current = false
    }
  }, [game.status])

  if (isLoading) {
    return <main className="p-6 text-ui-text">Loading game...</main>
  }

  if (loadingError) {
    return (
      <main className="mx-auto grid max-w-[720px] gap-4 p-6 text-ui-text">
        <p className="text-ui-danger">{loadingError}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="justify-self-start rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover"
        >
          Back Home
        </button>
      </main>
    )
  }

  const showBoard = game.status === 'countdown' || game.status === 'playing' || game.status === 'finished'
  const showLobby = game.status === 'waiting' || game.status === 'countdown'
  const showWordInput = game.status === 'playing'
  const showPlayerList = game.status !== 'idle' && game.status !== 'finished'
  const showResults = game.status === 'finished'

  return (
    <main className="mx-auto grid max-w-[1140px] gap-4 p-6 text-ui-text">
      <h1 className="m-0">Game {game.gameCode || normalizedGameCode}</h1>

      <div
        className={
          showBoard
            ? 'grid gap-4 lg:[grid-template-columns:minmax(0,60%)_minmax(0,40%)] lg:items-start'
            : 'grid gap-4'
        }
      >
        {showBoard ? (
          <section className="min-w-0">
            <Board
              board={game.board}
              size={game.boardSize}
              status={game.status}
              countdownRemaining={game.countdownRemaining}
            />
          </section>
        ) : null}

        <section className="grid min-w-0 content-start gap-4">
          <Timer
            status={game.status}
            countdownRemaining={game.countdownRemaining}
            timeRemaining={game.timeRemaining}
            onTimeExpired={handleTimerExpired}
          />

          {showLobby ? (
            <Lobby
              gameCode={game.gameCode || normalizedGameCode}
              players={game.players}
              canStart={canStart}
              onStartGame={handleStartGame}
            />
          ) : null}

          {showWordInput ? (
            <WordInput
              dictionary={dictionary}
              board={game.board}
              boardSize={game.boardSize}
              status={game.status}
              wordsFound={player.wordsFound}
              onSubmitWord={handleSubmitWord}
              onRemoveWord={handleRemoveWord}
            />
          ) : null}

          {showPlayerList ? <PlayerList players={game.players} /> : null}

          {showResults ? (
            <Results
              players={game.players}
              allWords={game.allWords}
              onPlayAgain={() => navigate('/')}
            />
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default GamePage
