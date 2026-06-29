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
  pauseGame,
  resetGameToWaiting,
  restartGame,
  resumeGame,
  startGame,
  submitWords,
  subscribeToGame,
  updateWaitingGameSettings,
} from '../supabase/gameApi'
import { loadDictionary } from '../utils/dictionary'
import { findAllWordsWithPaths } from '../utils/boardSolver'
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

const HOVER_HIGHLIGHT_STEP_MS = 200

function GamePage() {
  const { gameCode } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const game = useSelector((state) => state.game)
  const player = useSelector((state) => state.player)

  const [dictionary, setDictionary] = useState(null)
  const [loadingError, setLoadingError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false)
  const [isControllerActionPending, setIsControllerActionPending] = useState(false)
  const [controllerActionError, setControllerActionError] = useState('')
  const [isPlayAgainPending, setIsPlayAgainPending] = useState(false)
  const [playAgainError, setPlayAgainError] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [animatedHighlightedPath, setAnimatedHighlightedPath] = useState([])
  const [highlightedRoundKey, setHighlightedRoundKey] = useState(null)
  const [isKeyboardLikelyOpen, setIsKeyboardLikelyOpen] = useState(false)

  const activatedRef = useRef(false)
  const endingRef = useRef(false)
  const pauseSourceStatusRef = useRef(null)
  const highlightTimeoutIdsRef = useRef([])

  const normalizedGameCode = String(gameCode ?? '').trim().toUpperCase()
  const currentRoundKey = `${game.gameId ?? ''}:${game.startedAt ?? ''}`

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
  const isController = Boolean(player.playerId && player.playerId === hostId)
  const canEditSettings = isController && game.status === 'waiting'
  const canPauseGame = isController && (game.status === 'countdown' || game.status === 'playing')

  const solvedWordData = useMemo(() => {
    if (
      game.status !== 'finished' ||
      !dictionary ||
      !Array.isArray(game.board) ||
      game.board.length === 0 ||
      game.boardSize <= 0
    ) {
      return {
        allWords: [],
        wordPathByWord: {},
      }
    }

    return findAllWordsWithPaths(game.board, game.boardSize, dictionary)
  }, [dictionary, game.board, game.boardSize, game.status])

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

        if (nextGame.status !== 'finished') {
          setIsPlayAgainPending(false)
          setPlayAgainError('')
        }

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
    if (game.status !== 'finished') {
      for (const timeoutId of highlightTimeoutIdsRef.current) {
        clearTimeout(timeoutId)
      }
      highlightTimeoutIdsRef.current = []
      return
    }

    if (!dictionary || !Array.isArray(game.board) || game.board.length === 0 || game.boardSize <= 0) {
      return
    }

    dispatch(setAllWords(solvedWordData.allWords))
  }, [dictionary, dispatch, game.board, game.boardSize, game.status, solvedWordData.allWords])

  useEffect(
    () => () => {
      for (const timeoutId of highlightTimeoutIdsRef.current) {
        clearTimeout(timeoutId)
      }
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const getViewportHeight = () => window.visualViewport?.height ?? window.innerHeight
    const getViewportWidth = () => window.visualViewport?.width ?? window.innerWidth

    let baselineHeight = getViewportHeight()

    const updateKeyboardState = () => {
      const viewportHeight = getViewportHeight()
      const viewportWidth = getViewportWidth()

      if (viewportHeight > baselineHeight) {
        baselineHeight = viewportHeight
      }

      const keyboardHeight = baselineHeight - viewportHeight
      const keyboardThreshold = Math.max(120, baselineHeight * 0.24)
      const isNarrowViewport = viewportWidth < 1024

      setIsKeyboardLikelyOpen(isNarrowViewport && keyboardHeight > keyboardThreshold)
    }

    const handleOrientationChange = () => {
      baselineHeight = getViewportHeight()
      updateKeyboardState()
    }

    updateKeyboardState()

    window.addEventListener('resize', updateKeyboardState)
    window.addEventListener('orientationchange', handleOrientationChange)

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateKeyboardState)
      window.visualViewport.addEventListener('scroll', updateKeyboardState)
    }

    return () => {
      window.removeEventListener('resize', updateKeyboardState)
      window.removeEventListener('orientationchange', handleOrientationChange)

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateKeyboardState)
        window.visualViewport.removeEventListener('scroll', updateKeyboardState)
      }
    }
  }, [])

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

  const handleSaveSettings = async ({ boardSize, durationSeconds }) => {
    if (!game.gameId || !canEditSettings || isSavingSettings) {
      return
    }

    setSettingsError('')
    setIsSavingSettings(true)

    try {
      const updatedGame = await updateWaitingGameSettings(game.gameId, {
        boardSize,
        durationSeconds,
      })
      dispatch(setGame(updatedGame))
    } catch (error) {
      setSettingsError(error.message || 'Unable to save game settings.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleAllWordsWordHover = (word) => {
    const normalizedWord = String(word ?? '').trim().toLowerCase()

    for (const timeoutId of highlightTimeoutIdsRef.current) {
      clearTimeout(timeoutId)
    }
    highlightTimeoutIdsRef.current = []
    setAnimatedHighlightedPath([])

    if (!normalizedWord) {
      setHighlightedRoundKey(null)
      return
    }

    const path = solvedWordData.wordPathByWord[normalizedWord]
    if (!Array.isArray(path) || path.length === 0) {
      setHighlightedRoundKey(null)
      return
    }

    setHighlightedRoundKey(currentRoundKey)

    path.forEach((tileIndex, stepIndex) => {
      const timeoutId = setTimeout(() => {
        setAnimatedHighlightedPath((previousPath) => {
          if (previousPath.includes(tileIndex)) {
            return previousPath
          }

          return [...previousPath, tileIndex]
        })
      }, stepIndex * HOVER_HIGHLIGHT_STEP_MS)

      highlightTimeoutIdsRef.current.push(timeoutId)
    })
  }

  const handleAllWordsWordHoverEnd = () => {
    for (const timeoutId of highlightTimeoutIdsRef.current) {
      clearTimeout(timeoutId)
    }
    highlightTimeoutIdsRef.current = []
    setHighlightedRoundKey(null)
    setAnimatedHighlightedPath([])
  }

  const runControllerAction = async (action) => {
    if (isControllerActionPending) {
      return
    }

    setControllerActionError('')
    setIsControllerActionPending(true)

    try {
      await action()
    } catch (error) {
      setControllerActionError(error.message || 'Unable to update game state.')
    } finally {
      setIsControllerActionPending(false)
    }
  }

  const handlePauseButtonClick = async () => {
    if (!game.gameId || !canPauseGame) {
      return
    }

    pauseSourceStatusRef.current = game.status
    setIsPauseModalOpen(true)

    await runControllerAction(async () => {
      await pauseGame(game.gameId)
    })
  }

  const handleResumeGame = async () => {
    if (!game.gameId || game.status !== 'paused') {
      return
    }

    const resumeStatus =
      pauseSourceStatusRef.current === 'countdown' || pauseSourceStatusRef.current === 'playing'
        ? pauseSourceStatusRef.current
        : game.timeRemaining > 0
          ? 'playing'
          : 'countdown'

    const remainingSeconds =
      resumeStatus === 'countdown'
        ? Math.max(1, Number(game.countdownRemaining) || 0)
        : Math.max(1, Number(game.timeRemaining) || 0)

    await runControllerAction(async () => {
      await resumeGame(game.gameId, {
        resumeStatus,
        remainingSeconds,
        durationSeconds: game.durationSeconds,
      })

      setIsPauseModalOpen(false)
      pauseSourceStatusRef.current = null
    })
  }

  const handlePlayAgain = async () => {
    if (!game.gameId || !isController || isPlayAgainPending) {
      return
    }

    setPlayAgainError('')
    setIsPlayAgainPending(true)

    try {
      const updatedGame = await resetGameToWaiting(game.gameId)
      dispatch(setGame(updatedGame))
      dispatch(setAllWords([]))
      dispatch(setPlayer({ id: player.playerId, words_found: [], score: 0 }))
      dispatch(setScore(0))
    } catch (error) {
      setPlayAgainError(error.message || 'Unable to start a new round.')
    } finally {
      setIsPlayAgainPending(false)
    }
  }

  const handleRestartGame = async () => {
    if (!game.gameId) {
      return
    }

    await runControllerAction(async () => {
      const updatedGame = await restartGame(game.gameId)
      dispatch(setGame(updatedGame))
      dispatch(
        startCountdown({
          startedAt: updatedGame.started_at,
          durationSeconds: updatedGame.duration_seconds,
        }),
      )
      dispatch(setAllWords([]))
      dispatch(setPlayer({ id: player.playerId, words_found: [], score: 0 }))
      dispatch(setScore(0))
      setIsPauseModalOpen(false)
      pauseSourceStatusRef.current = null
    })
  }

  const handleEndGameFromModal = async () => {
    if (!game.gameId) {
      return
    }

    await runControllerAction(async () => {
      await endGame(game.gameId)
      setIsPauseModalOpen(false)
      pauseSourceStatusRef.current = null
    })
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
  const showPauseNotice = game.status === 'paused'
  const showPauseModal = isPauseModalOpen && isController
  const shouldCompactBoardForKeyboard = showWordInput && isKeyboardLikelyOpen
  const compactBoardWidthPercent =
    game.boardSize >= 8 ? 72 : game.boardSize >= 6 ? 78 : game.boardSize >= 5 ? 84 : 90
  const compactBoardContainerStyle = shouldCompactBoardForKeyboard
    ? {
        width: `${compactBoardWidthPercent}%`,
        marginInline: 'auto',
        transition: 'width 150ms ease-out',
      }
    : undefined

  return (
    <main className="mx-auto grid w-full max-w-[1140px] gap-4 p-6 text-ui-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0">Game {game.gameCode || normalizedGameCode}</h1>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {canPauseGame ? (
            <button
              type="button"
              onClick={handlePauseButtonClick}
              disabled={isControllerActionPending}
              className="rounded-md border border-ui-border bg-ui-surface px-3 py-2 font-medium text-ui-text transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Pause
            </button>
          ) : null}

          {showResults ? (
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={!isController || isPlayAgainPending}
              className="rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlayAgainPending
                ? 'Starting next round...'
                : isController
                  ? 'Play Again'
                  : 'Waiting for host...'}
            </button>
          ) : null}
        </div>
      </div>

      {showPauseNotice ? (
        <p className="m-0 rounded-md border border-teal-500 bg-teal-900 px-3 py-2 text-sm font-medium text-ui-text">
          Game Paused
        </p>
      ) : null}

      {showResults && playAgainError ? <p className="m-0 text-ui-danger">{playAgainError}</p> : null}

      <div
        className={
          showBoard
            ? 'grid gap-4 lg:flex lg:items-start'
            : 'grid gap-4'
        }
      >
        {showBoard ? (
          <section
            className="min-w-0 w-full lg:basis-[60%] lg:flex-none"
            style={compactBoardContainerStyle}
          >
            <Board
              board={game.board}
              size={game.boardSize}
              status={game.status}
              countdownRemaining={game.countdownRemaining}
              isCompact={shouldCompactBoardForKeyboard}
              highlightedPath={
                showResults && highlightedRoundKey === currentRoundKey
                  ? animatedHighlightedPath
                  : []
              }
            />
          </section>
        ) : null}

        <section className="grid min-w-0 w-full content-start gap-4 overflow-x-hidden lg:basis-[40%] lg:flex-none">
          <Timer
            status={game.status}
            countdownRemaining={game.countdownRemaining}
            timeRemaining={game.timeRemaining}
            onTimeExpired={handleTimerExpired}
          />

          {showLobby ? (
            <Lobby
              key={`${game.gameId ?? 'game'}-${game.boardSize}-${game.durationSeconds}-${canEditSettings ? 'host' : 'guest'}`}
              gameCode={game.gameCode || normalizedGameCode}
              players={game.players}
              canStart={canStart}
              boardSize={game.boardSize}
              durationSeconds={game.durationSeconds}
              isHost={canEditSettings}
              isSavingSettings={isSavingSettings}
              settingsError={settingsError}
              onStartGame={handleStartGame}
              onSaveSettings={handleSaveSettings}
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
              boardSize={game.boardSize}
              onWordHover={handleAllWordsWordHover}
              onWordHoverEnd={handleAllWordsWordHoverEnd}
            />
          ) : null}
        </section>
      </div>

      {showPauseModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <section className="w-full max-w-md rounded-xl border border-ui-border bg-ui-surface p-5 text-ui-text shadow-xl">
            <h2 className="m-0 text-xl">Game Paused</h2>
            <p className="mb-4 mt-2 text-ui-muted">
              {game.status === 'paused'
                ? 'Choose what happens next.'
                : 'Pausing game...'}
            </p>

            {controllerActionError ? (
              <p className="mb-4 rounded-md border border-ui-danger/40 bg-ui-danger/10 px-3 py-2 text-sm text-ui-danger">
                {controllerActionError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleResumeGame}
                disabled={isControllerActionPending || game.status !== 'paused'}
                className="rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resume
              </button>

              <button
                type="button"
                onClick={handleRestartGame}
                disabled={isControllerActionPending}
                className="rounded-md border border-ui-border bg-ui-surface px-3 py-2 font-medium text-ui-text transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Restart
              </button>

              <button
                type="button"
                onClick={handleEndGameFromModal}
                disabled={isControllerActionPending}
                className="rounded-md border border-ui-danger bg-ui-surface px-3 py-2 font-medium text-ui-danger transition-colors hover:bg-ui-danger/10 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
              >
                End Game
              </button>

              {/* <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                disabled={isControllerActionPending}
                className="rounded-md border border-ui-border bg-transparent px-3 py-2 font-medium text-ui-muted transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
              >
                Close
              </button> */}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default GamePage
