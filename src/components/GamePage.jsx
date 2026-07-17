import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import Board from './Board'
import Lobby from './Lobby'
import PlayerList from './PlayerList'
import Results from './Results'
import SwipeBoard from './SwipeBoard'
import Timer from './Timer'
import WordInput from './WordInput'
import {
  activateGame,
  endGame,
  getGameByCode,
  getPlayersByGameId,
  getRoundHistory,
  pauseGame,
  resetGameToWaiting,
  restartGame,
  resumeGame,
  startGame,
  submitWords,
  subscribeToGame,
  updateWaitingGameSettings,
  updatePlayerReady,
} from '../supabase/gameApi'
import { loadDictionary } from '../utils/dictionary'
import { findAllWordsWithPaths } from '../utils/boardSolver'
import {
  removePlayer,
  setAllWords,
  setGame,
  setPlayers,
  setRoundHistory,
  startCountdown,
  syncCountdown,
  syncTimerFromStart,
  tickCountdown,
  updateGameStatus,
  updatePlayer,
} from '../store/gameSlice'
import { addWord, removeWord, resetPlayer, setPlayer, setScore } from '../store/playerSlice'
import { scoreWords } from '../utils/scoring'
import {
  addWordToRound,
  getWordText,
  getWordsForRound,
  getWordsKey,
  makeRoundWordEntry,
  removeWordFromRound,
  wordListIncludes,
} from '../utils/roundWords'
import {
  clearStoredPlayerSession,
  getStoredPlayerSession,
  savePlayerSession,
} from '../utils/playerSession'

const HOVER_HIGHLIGHT_STEP_MS = 200
const FINISH_RETRY_DELAY_MS = 1000
const ROUND_FINISH_GRACE_MS = 5000
const ROUND_FINISH_SAFETY_BUFFER_MS = 300
const WORD_PERSIST_DEBOUNCE_MS = 2000
const WORD_PERSIST_RETRY_DELAY_MS = 1000

function formatCompactTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function isSameRoundStartedAt(firstStartedAt, secondStartedAt) {
  const firstTime = new Date(firstStartedAt).getTime()
  const secondTime = new Date(secondStartedAt).getTime()

  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime === secondTime
}

function playerWordsBelongToRound(playerRow, gameId, roundStartedAt) {
  const words = Array.isArray(playerRow?.words_found) ? playerRow.words_found : []
  const wordCount = Number(playerRow?.word_count ?? 0)

  if (words.length === 0 && (!Number.isInteger(wordCount) || wordCount === 0)) {
    return true
  }

  if (getWordsForRound(words, gameId, roundStartedAt).length > 0) {
    return true
  }

  return isSameRoundStartedAt(playerRow?.words_round_started_at, roundStartedAt)
}

function getPlayerForRound(playerRow, gameId, roundStartedAt) {
  if (!playerRow) {
    return playerRow
  }

  if (playerWordsBelongToRound(playerRow, gameId, roundStartedAt)) {
    const roundWords = getWordsForRound(playerRow.words_found, gameId, roundStartedAt)

    return {
      ...playerRow,
      words_found: roundWords,
      word_count: roundWords.length,
      score: scoreWords(roundWords),
    }
  }

  return {
    ...playerRow,
    words_found: [],
    word_count: 0,
    score: 0,
  }
}

function isRoundStillAcceptingSubmissions(error) {
  return String(error?.message ?? '').includes('Round is still accepting submissions.')
}

function isWordSubmissionClosed(error) {
  const message = String(error?.message ?? '')

  return (
    message.includes('Words are from a stale round.') ||
    message.includes('Words can only be submitted while the round is playing.') ||
    message.includes('Round has ended.')
  )
}

function getRoundFinishWaitMs(game) {
  const startedAtMs = new Date(game?.startedAt).getTime()
  const durationMs = Number(game?.durationSeconds) * 1000

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return 0
  }

  const finishAllowedAtMs = startedAtMs + durationMs + ROUND_FINISH_GRACE_MS + ROUND_FINISH_SAFETY_BUFFER_MS
  return Math.max(0, finishAllowedAtMs - Date.now())
}

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
  const [isReadyPending, setIsReadyPending] = useState(false)
  const [readyError, setReadyError] = useState('')
  const [animatedHighlightedPath, setAnimatedHighlightedPath] = useState([])
  const [highlightedRoundKey, setHighlightedRoundKey] = useState(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [inputMode, setInputMode] = useState('type')
  const [boardRotationDegrees, setBoardRotationDegrees] = useState(0)
  const [isRoundFinishing, setIsRoundFinishing] = useState(false)

  const activatedRef = useRef(false)
  const endingRef = useRef(false)
  const pauseSourceStatusRef = useRef(null)
  const highlightTimeoutIdsRef = useRef([])
  const playerIdRef = useRef(player.playerId)
  const gameIdRef = useRef(game.gameId)
  const gameStartedAtRef = useRef(game.startedAt)
  const latestLocalWordsRef = useRef(player.wordsFound)
  const pendingWordsPersistRef = useRef(null)
  const wordPersistTimerRef = useRef(null)
  const wordPersistInFlightRef = useRef(null)
  const flushQueuedWordPersistRef = useRef(null)
  const wasShowingInputModeToggleRef = useRef(false)
  const finishRetryTimeoutRef = useRef(null)

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

  useEffect(() => {
    playerIdRef.current = player.playerId
  }, [player.playerId])

  useEffect(() => {
    gameIdRef.current = game.gameId
  }, [game.gameId])

  useEffect(() => {
    gameStartedAtRef.current = game.startedAt
  }, [game.startedAt])

  useEffect(() => {
    latestLocalWordsRef.current = getWordsForRound(player.wordsFound, game.gameId, game.startedAt)
  }, [game.gameId, game.startedAt, player.wordsFound])

  const canStart =
    game.status === 'waiting' && game.players.length >= 1 && player.playerId && player.playerId === hostId
  const isController = Boolean(player.playerId && player.playerId === hostId)
  const canEditSettings = isController && game.status === 'waiting'
  const canPauseGame = isController && (game.status === 'countdown' || game.status === 'playing')
  const currentPlayerRow = useMemo(
    () => game.players.find((entry) => entry.id === player.playerId) ?? null,
    [game.players, player.playerId],
  )
  const currentPlayerReady = Boolean(currentPlayerRow?.ready_at ?? currentPlayerRow?.readyAt)

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

  const handleRotateBoardClockwise = () => {
    setBoardRotationDegrees((previousRotationDegrees) => previousRotationDegrees + 90)
  }

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

        const [players, roundHistory] = await Promise.all([
          getPlayersByGameId(gameRow.id),
          getRoundHistory(gameRow.id),
        ])

        if (cancelled) {
          return
        }

        setDictionary(dictionarySet)
        dispatch(setGame(gameRow))
        dispatch(setPlayers(players.map((entry) => getPlayerForRound(entry, gameRow.id, gameRow.started_at))))
        dispatch(setRoundHistory(roundHistory))

        const storedPlayerSession = getStoredPlayerSession(normalizedGameCode)
        const candidatePlayerId = String(
          storedPlayerSession?.playerId ?? playerIdRef.current ?? '',
        ).trim()

        if (candidatePlayerId) {
          const currentPlayer = players.find((entry) => entry.id === candidatePlayerId)

          if (currentPlayer) {
            const currentRoundPlayer = getPlayerForRound(currentPlayer, gameRow.id, gameRow.started_at)
            dispatch(setPlayer(currentRoundPlayer))
            dispatch(setScore(scoreWords(currentRoundPlayer.words_found)))
            savePlayerSession(normalizedGameCode, currentPlayer)
          } else {
            clearStoredPlayerSession(normalizedGameCode)
            dispatch(resetPlayer())
          }
        } else {
          dispatch(resetPlayer())
        }

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
    if (!game.gameId || (game.status !== 'finished' && game.status !== 'waiting')) {
      return undefined
    }

    let cancelled = false
    const retryTimeoutIds = []
    const finishedRefreshAttempts = 3
    const finishedRefreshDelayMs = 600

    const scheduleFinishedRefresh = (attemptNumber) => {
      if (game.status !== 'finished' || attemptNumber > finishedRefreshAttempts) {
        return
      }

      const timeoutId = setTimeout(async () => {
        if (cancelled) {
          return
        }

        try {
          const retriedHistory = await getRoundHistory(game.gameId)

          if (!cancelled) {
            dispatch(setRoundHistory(retriedHistory))
          }
        } catch {
          // ignore retry failures and keep current UI state
        }

        scheduleFinishedRefresh(attemptNumber + 1)
      }, finishedRefreshDelayMs)

      retryTimeoutIds.push(timeoutId)
    }

    const loadRoundHistory = async () => {
      try {
        const history = await getRoundHistory(game.gameId)

        if (cancelled) {
          return
        }

        dispatch(setRoundHistory(history))

        scheduleFinishedRefresh(1)
      } catch {
        // ignore history loading failures and keep current UI state
        scheduleFinishedRefresh(1)
      }
    }

    loadRoundHistory()

    return () => {
      cancelled = true

      for (const timeoutId of retryTimeoutIds) {
        clearTimeout(timeoutId)
      }
    }
  }, [dispatch, game.gameId, game.status])

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

        if (nextGame.status !== 'playing') {
          setIsRoundFinishing(false)
        }

        if (nextGame.status === 'countdown') {
          const nextStartedAt = String(nextGame.started_at ?? '').trim()
          const currentStartedAt = String(gameStartedAtRef.current ?? '').trim()
          const isNewRound = Boolean(nextStartedAt && nextStartedAt !== currentStartedAt)
          if (isNewRound) {
            if (wordPersistTimerRef.current) {
              clearTimeout(wordPersistTimerRef.current)
              wordPersistTimerRef.current = null
            }

            pendingWordsPersistRef.current = null
            latestLocalWordsRef.current = []
            setBoardRotationDegrees(0)
          }

          if (isNewRound && playerIdRef.current) {
            dispatch(
              setPlayer({
                id: playerIdRef.current,
                words_found: [],
                word_count: 0,
                words_round_started_at: nextStartedAt,
                score: 0,
              }),
            )
            dispatch(setScore(0))
            dispatch(setAllWords([]))
          }

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
          const deletedPlayerId = payload.old?.id

          dispatch(removePlayer(deletedPlayerId))

          if (deletedPlayerId && deletedPlayerId === player.playerId) {
            clearStoredPlayerSession(normalizedGameCode)
            dispatch(resetPlayer())
          }

          return
        }

        const updatedPlayer = payload.new

        if (!updatedPlayer) {
          return
        }

        const currentRoundStartedAt = gameStartedAtRef.current
        const currentRoundPlayer = getPlayerForRound(updatedPlayer, gameIdRef.current, currentRoundStartedAt)

        if (updatedPlayer.id === player.playerId) {
          const incomingWordsKey = getWordsKey(currentRoundPlayer.words_found)
          const latestLocalWordsKey = getWordsKey(latestLocalWordsRef.current)
          const hasQueuedLocalSave = Boolean(
            pendingWordsPersistRef.current ||
              wordPersistInFlightRef.current ||
              wordPersistTimerRef.current,
          )
          const playerForDisplay =
            hasQueuedLocalSave && incomingWordsKey !== latestLocalWordsKey
              ? {
                  ...currentRoundPlayer,
                  words_found: latestLocalWordsRef.current,
                  word_count: latestLocalWordsRef.current.length,
                  score: scoreWords(latestLocalWordsRef.current),
                }
              : currentRoundPlayer

          dispatch(updatePlayer(playerForDisplay))
          dispatch(setPlayer(playerForDisplay))
          dispatch(setScore(scoreWords(playerForDisplay.words_found)))
          savePlayerSession(normalizedGameCode, updatedPlayer)
          return
        }

        dispatch(updatePlayer(currentRoundPlayer))
      },
    )

    return () => {
      channel.unsubscribe()
    }
  }, [dispatch, game.gameId, normalizedGameCode, player.playerId])

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

      if (finishRetryTimeoutRef.current) {
        clearTimeout(finishRetryTimeoutRef.current)
      }

      if (wordPersistTimerRef.current) {
        clearTimeout(wordPersistTimerRef.current)
        wordPersistTimerRef.current = null
      }

      pendingWordsPersistRef.current = null
    },
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const getViewportWidth = () => window.visualViewport?.width ?? window.innerWidth
    const updateViewportState = () => {
      const viewportWidth = getViewportWidth()
      setIsMobileViewport(viewportWidth <= 900)
    }

    updateViewportState()

    window.addEventListener('resize', updateViewportState)
    window.addEventListener('orientationchange', updateViewportState)

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportState)
    }

    return () => {
      window.removeEventListener('resize', updateViewportState)
      window.removeEventListener('orientationchange', updateViewportState)

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportState)
      }
    }
  }, [])

  useEffect(() => {
    const isShowingInputModeToggle = isMobileViewport && game.status === 'playing'

    if (isShowingInputModeToggle && !wasShowingInputModeToggleRef.current) {
      setInputMode('swipe')
    }

    wasShowingInputModeToggleRef.current = isShowingInputModeToggle
  }, [game.status, isMobileViewport])

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
    dispatch(setAllWords([]))
    clearQueuedWordPersist()
    latestLocalWordsRef.current = []
    dispatch(
      setPlayer({
        id: player.playerId,
        words_found: [],
        word_count: 0,
        words_round_started_at: updatedGame.started_at,
        score: 0,
      }),
    )
    dispatch(setScore(0))
    setBoardRotationDegrees(0)
  }

  const handleToggleReady = async (isReady) => {
    if (!player.playerId || isReadyPending) {
      return
    }

    setReadyError('')
    setIsReadyPending(true)

    try {
      const updatedPlayer = await updatePlayerReady(player.playerId, isReady)
      const currentRoundPlayer = getPlayerForRound(updatedPlayer, gameIdRef.current, gameStartedAtRef.current)
      dispatch(updatePlayer(currentRoundPlayer))
      dispatch(setPlayer(currentRoundPlayer))
      savePlayerSession(normalizedGameCode, updatedPlayer)
    } catch (error) {
      setReadyError(error.message || 'Unable to update ready status.')
    } finally {
      setIsReadyPending(false)
    }
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

  const clearQueuedWordPersist = () => {
    if (wordPersistTimerRef.current) {
      clearTimeout(wordPersistTimerRef.current)
      wordPersistTimerRef.current = null
    }

    pendingWordsPersistRef.current = null
  }

  const flushQueuedWordPersist = useCallback(async () => {
    if (wordPersistTimerRef.current) {
      clearTimeout(wordPersistTimerRef.current)
      wordPersistTimerRef.current = null
    }

    if (wordPersistInFlightRef.current) {
      return wordPersistInFlightRef.current
    }

    const persistPromise = (async () => {
      while (pendingWordsPersistRef.current) {
        const playerId = playerIdRef.current
        const gameId = gameIdRef.current
        const roundStartedAt = gameStartedAtRef.current
        const wordsToPersist = getWordsForRound(pendingWordsPersistRef.current, gameId, roundStartedAt)
        const wordsToPersistKey = getWordsKey(wordsToPersist)

        pendingWordsPersistRef.current = null

        if (!playerId || !gameId || !roundStartedAt) {
          return null
        }

        try {
          const updatedPlayer = await submitWords(playerId, gameId, roundStartedAt, wordsToPersist)
          const currentRoundPlayer = getPlayerForRound(updatedPlayer, gameIdRef.current, gameStartedAtRef.current)
          const latestLocalWordsKey = getWordsKey(latestLocalWordsRef.current)

          if (latestLocalWordsKey === wordsToPersistKey) {
            dispatch(updatePlayer(currentRoundPlayer))
            dispatch(setPlayer(currentRoundPlayer))
            dispatch(setScore(scoreWords(currentRoundPlayer.words_found)))
          }
        } catch (error) {
          if (isWordSubmissionClosed(error)) {
            return null
          }

          pendingWordsPersistRef.current = getWordsForRound(latestLocalWordsRef.current, gameIdRef.current, gameStartedAtRef.current)
          wordPersistTimerRef.current = setTimeout(() => {
            wordPersistTimerRef.current = null
            flushQueuedWordPersistRef.current?.().catch(() => {})
          }, WORD_PERSIST_RETRY_DELAY_MS)
          return null
        }
      }

      return null
    })()

    wordPersistInFlightRef.current = persistPromise

    try {
      return await persistPromise
    } finally {
      wordPersistInFlightRef.current = null

      if (pendingWordsPersistRef.current && !wordPersistTimerRef.current) {
        flushQueuedWordPersistRef.current?.().catch(() => {})
      }
    }
  }, [dispatch])

  useEffect(() => {
    flushQueuedWordPersistRef.current = flushQueuedWordPersist
  }, [flushQueuedWordPersist])

  const queueWordPersist = (nextWords, { immediate = false } = {}) => {
    pendingWordsPersistRef.current = getWordsForRound(nextWords, gameIdRef.current, gameStartedAtRef.current)

    if (wordPersistTimerRef.current) {
      clearTimeout(wordPersistTimerRef.current)
      wordPersistTimerRef.current = null
    }

    if (immediate) {
      flushQueuedWordPersist().catch(() => {})
      return
    }

    wordPersistTimerRef.current = setTimeout(() => {
      wordPersistTimerRef.current = null
      flushQueuedWordPersist().catch(() => {})
    }, WORD_PERSIST_DEBOUNCE_MS)
  }

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined
    }

    const flushWordsSoon = () => {
      if (game.status === 'playing') {
        flushQueuedWordPersist().catch(() => {})
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushWordsSoon()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', flushWordsSoon)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', flushWordsSoon)
    }
  }, [game.status, flushQueuedWordPersist])

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
      clearQueuedWordPersist()
      latestLocalWordsRef.current = []
      dispatch(setPlayer({ id: player.playerId, words_found: [], word_count: 0, words_round_started_at: null, score: 0 }))
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
      clearQueuedWordPersist()
      latestLocalWordsRef.current = []
      dispatch(
        setPlayer({
          id: player.playerId,
          words_found: [],
          word_count: 0,
          words_round_started_at: updatedGame.started_at,
          score: 0,
        }),
      )
      dispatch(setScore(0))
      setBoardRotationDegrees(0)
      setIsPauseModalOpen(false)
      pauseSourceStatusRef.current = null
    })
  }

  const handleEndGameFromModal = async () => {
    if (!game.gameId) {
      return
    }

    await runControllerAction(async () => {
      await flushQueuedWordPersist()
      await endGame(game.gameId, { force: true })
      setIsPauseModalOpen(false)
      pauseSourceStatusRef.current = null
    })
  }

  const ensureWordsCanBeQueued = () => {
    if (!player.playerId) {
      throw new Error('You must join the game before submitting words.')
    }

    if (!game.gameId || !game.startedAt) {
      throw new Error('Round is not ready for word submissions.')
    }
  }

  const handleSubmitWord = async (word) => {
    const normalizedWord = String(word ?? '').trim().toLowerCase()
    const currentWords = getWordsForRound(latestLocalWordsRef.current, game.gameId, game.startedAt)

    if (!normalizedWord || wordListIncludes(currentWords, normalizedWord)) {
      return
    }

    ensureWordsCanBeQueued()

    const nextWords = addWordToRound(currentWords, normalizedWord, game.gameId, game.startedAt)
    const nextWordEntry = makeRoundWordEntry(normalizedWord, game.gameId, game.startedAt)

    latestLocalWordsRef.current = nextWords
    dispatch(addWord(nextWordEntry))
    dispatch(setScore(scoreWords(nextWords)))
    queueWordPersist(nextWords)
  }

  const handleRemoveWord = async (word) => {
    const normalizedWord = getWordText(word)
    const currentWords = getWordsForRound(latestLocalWordsRef.current, game.gameId, game.startedAt)

    if (!normalizedWord || !wordListIncludes(currentWords, normalizedWord)) {
      return
    }

    ensureWordsCanBeQueued()

    const nextWords = removeWordFromRound(currentWords, normalizedWord)

    latestLocalWordsRef.current = nextWords
    dispatch(removeWord(normalizedWord))
    dispatch(setScore(scoreWords(nextWords)))
    queueWordPersist(nextWords)
  }

  const handleTimerExpired = async () => {
    if (endingRef.current || !game.gameId) {
      return
    }

    endingRef.current = true
    setIsRoundFinishing(true)

    const finishWaitMs = getRoundFinishWaitMs(game)

    if (finishWaitMs > 0) {
      await flushQueuedWordPersist()
      finishRetryTimeoutRef.current = setTimeout(() => {
        finishRetryTimeoutRef.current = null
        endingRef.current = false
        handleTimerExpired()
      }, finishWaitMs)
      return
    }

    let didFinish = false

    try {
      await flushQueuedWordPersist()
      await endGame(game.gameId)
      didFinish = true
    } catch (error) {
      if (isRoundStillAcceptingSubmissions(error)) {
        finishRetryTimeoutRef.current = setTimeout(() => {
          finishRetryTimeoutRef.current = null
          endingRef.current = false
          handleTimerExpired()
        }, FINISH_RETRY_DELAY_MS)
        return
      }

      endingRef.current = false
      setIsRoundFinishing(false)
    }

    if (didFinish) {
      setIsRoundFinishing(false)
      dispatch(updateGameStatus('finished'))
    }
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
  const showInputModeToggle = isMobileViewport && showWordInput
  const effectiveInputMode = showInputModeToggle ? inputMode : 'type'
  const isSwipeMode = effectiveInputMode === 'swipe'
  const isBoardTraceMode = isSwipeMode
  const effectivePlayStatus = isRoundFinishing ? 'finished' : game.status
  const shouldCompactBoardForMobile = isMobileViewport
  const compactBoardWidthPercent =
    game.boardSize >= 8 ? 62 : game.boardSize >= 6 ? 58 : game.boardSize >= 5 ? 54 : 50
  const compactBoardContainerStyle = shouldCompactBoardForMobile
    ? {
        width: isBoardTraceMode ? '100%' : `${compactBoardWidthPercent}%`,
        marginInline: 'auto',
        transition: 'width 180ms ease-out',
      }
    : undefined

  return (
    <main className="mx-auto grid w-full max-w-[1140px] gap-4 p-6 text-ui-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0">Game {game.gameCode || normalizedGameCode}</h1>

        <div className="flex flex-wrap items-center justify-end gap-2">
                   {showLobby || showResults ? (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-md border border-ui-border bg-ui-surface px-3 py-2 font-medium text-ui-text transition-colors hover:bg-ui-surface-hover"
            >
              Home
            </button>
          ) : null}

          {showBoard ? (
            <button
              type="button"
              onClick={handleRotateBoardClockwise}
              className="rounded-md border border-ui-border bg-ui-surface px-3 py-2 font-medium text-ui-text transition-colors hover:bg-ui-surface-hover"
            >
              Rotate Board
            </button>
          ) : null}

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
              onClick={isController ? handlePlayAgain : () => handleToggleReady(!currentPlayerReady)}
              disabled={
                isController
                  ? isPlayAgainPending
                  : !player.playerId || isReadyPending
              }
              aria-pressed={!isController ? currentPlayerReady : undefined}
              className={`rounded-md px-3 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                !isController && currentPlayerReady
                  ? 'border border-emerald-400/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                  : 'bg-ui-primary text-ui-input-text hover:bg-ui-primary-hover'
              }`}
            >
              {isPlayAgainPending
                ? 'Starting next round...'
                : isController
                  ? 'Play Again'
                  : isReadyPending
                    ? 'Saving...'
                    : currentPlayerReady
                      ? 'Ready ✓'
                      : 'Ready for Next Round'}
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
            {showInputModeToggle ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-ui-border bg-ui-surface p-1">
                    <button
                      type="button"
                      onClick={() => setInputMode('type')}
                      aria-pressed={effectiveInputMode === 'type'}
                      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        effectiveInputMode === 'type'
                          ? 'bg-ui-primary text-ui-input-text hover:bg-ui-primary-hover'
                          : 'bg-ui-input-bg text-ui-muted hover:bg-ui-surface-hover'
                      }`}
                    >
                      Type
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputMode('swipe')}
                      aria-pressed={effectiveInputMode === 'swipe'}
                      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                        effectiveInputMode === 'swipe'
                          ? 'bg-ui-primary text-ui-input-text hover:bg-ui-primary-hover'
                          : 'bg-ui-input-bg text-ui-muted hover:bg-ui-surface-hover'
                      }`}
                    >
                      Swipe
                    </button>
                  </div>

                  {isRoundFinishing ? (
                    <span className="inline-flex items-center gap-2 text-lg font-bold text-ui-text">
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border-2 border-ui-muted border-t-ui-primary motion-safe:animate-spin"
                      />
                      <span>Time&apos;s up!</span>
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-ui-text [font-variant-numeric:tabular-nums]">
                      Time: {formatCompactTime(game.timeRemaining)}
                    </span>
                  )}
                </div>

                <div className="hidden">
                  <Timer
                    status={game.status}
                    countdownRemaining={game.countdownRemaining}
                    timeRemaining={game.timeRemaining}
                    isFinishing={isRoundFinishing}
                    onTimeExpired={handleTimerExpired}
                  />
                </div>
              </>
            ) : null}

            {isBoardTraceMode ? (
              <SwipeBoard
                board={game.board}
                size={game.boardSize}
                status={effectivePlayStatus}
                countdownRemaining={game.countdownRemaining}
                inputMode={effectiveInputMode}
                isCompact={shouldCompactBoardForMobile}
                highlightedPath={
                  showResults && highlightedRoundKey === currentRoundKey
                    ? animatedHighlightedPath
                    : []
                }
                dictionary={dictionary}
                boardSize={game.boardSize}
                wordsFound={player.wordsFound}
                rotationDegrees={boardRotationDegrees}
                onSubmitWord={handleSubmitWord}
              />
            ) : (
              <Board
                board={game.board}
                size={game.boardSize}
                status={effectivePlayStatus}
                countdownRemaining={game.countdownRemaining}
                isCompact={shouldCompactBoardForMobile}
                highlightedPath={
                  showResults && highlightedRoundKey === currentRoundKey
                    ? animatedHighlightedPath
                    : []
                }
                rotationDegrees={boardRotationDegrees}
              />
            )}
          </section>
        ) : null}

        <section className="grid min-w-0 w-full content-start gap-4 overflow-x-hidden lg:basis-[40%] lg:flex-none">
          {!showInputModeToggle ? (
            <Timer
              status={game.status}
              countdownRemaining={game.countdownRemaining}
              timeRemaining={game.timeRemaining}
              isFinishing={isRoundFinishing}
              onTimeExpired={handleTimerExpired}
            />
          ) : null}

          {showWordInput && isBoardTraceMode ? (
            <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
              <h3 className="mt-0 text-ui-text">{player.wordsFound.length} Word{player.wordsFound.length !== 1 ? 's' : ''} Found</h3>

              {player.wordsFound.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {player.wordsFound.map((word) => {
                    const displayWord = getWordText(word)

                    return (
                      <span
                        key={displayWord}
                        className="max-w-full truncate rounded-full border border-ui-input-border bg-ui-input-bg px-2.5 py-1 text-sm text-ui-input-text"
                      >
                        {displayWord}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="mb-0 mt-2 text-sm text-ui-muted">No words found yet.</p>
              )}
            </section>
          ) : null}

          {showLobby ? (
            <Lobby
              key={`${game.gameId ?? 'game'}-${game.boardSize}-${game.durationSeconds}-${canEditSettings ? 'host' : 'guest'}`}
              gameCode={game.gameCode || normalizedGameCode}
              players={game.players}
              roundHistory={game.roundHistory}
              canStart={canStart}
              boardSize={game.boardSize}
              durationSeconds={game.durationSeconds}
              currentPlayerId={player.playerId}
              isHost={canEditSettings}
              isSavingSettings={isSavingSettings}
              settingsError={settingsError}
              isReadyPending={isReadyPending}
              readyError={readyError}
              onStartGame={handleStartGame}
              onSaveSettings={handleSaveSettings}
              onToggleReady={game.status === 'waiting' ? handleToggleReady : undefined}
            />
          ) : null}

          {showWordInput && !isBoardTraceMode ? (
            <WordInput
              dictionary={dictionary}
              board={game.board}
              boardSize={game.boardSize}
              status={effectivePlayStatus}
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
              roundHistory={game.roundHistory}
              boardSize={game.boardSize}
              currentRoundStartedAt={game.startedAt}
              gameId={game.gameId}
              currentPlayerId={player.playerId}
              isReadyPending={isReadyPending}
              readyError={readyError}
              onToggleReady={handleToggleReady}
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
