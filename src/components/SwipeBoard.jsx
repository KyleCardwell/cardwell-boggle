import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import { canConstructWord, getMinimumWordLength } from '../utils/wordValidation'

function getTileIndexFromElement(element) {
  const tileElement = element?.closest?.('[data-tile-index]')
  if (!tileElement) {
    return null
  }

  const index = Number.parseInt(tileElement.getAttribute('data-tile-index') ?? '', 10)
  return Number.isInteger(index) ? index : null
}

function areAdjacent(fromIndex, toIndex, size) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) {
    return false
  }

  const fromRow = Math.floor(fromIndex / size)
  const fromCol = fromIndex % size
  const toRow = Math.floor(toIndex / size)
  const toCol = toIndex % size

  return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1
}

function getWordFromPath(board, path) {
  return path.map((index) => String(board[index] ?? '').trim().toLowerCase()).join('')
}

function getTracePoints(containerElement, path) {
  if (!containerElement || path.length === 0) {
    return []
  }

  const containerRect = containerElement.getBoundingClientRect()

  return path
    .map((index) => {
      const tileElement = containerElement.querySelector(`[data-tile-index="${index}"]`)

      if (!tileElement) {
        return null
      }

      const tileRect = tileElement.getBoundingClientRect()
      return {
        x: tileRect.left - containerRect.left + tileRect.width / 2,
        y: tileRect.top - containerRect.top + tileRect.height / 2,
      }
    })
    .filter(Boolean)
}

function SwipeBoard({
  board,
  size,
  status,
  countdownRemaining,
  highlightedPath = [],
  isCompact = false,
  dictionary,
  boardSize,
  wordsFound = [],
  onSubmitWord,
}) {
  const [tracePath, setTracePath] = useState([])
  const [tracePoints, setTracePoints] = useState([])
  const [feedback, setFeedback] = useState(null)

  const boardWrapperRef = useRef(null)
  const tracePathRef = useRef([])
  const isTracingRef = useRef(false)
  const feedbackTimeoutRef = useRef(null)

  const wordsSet = useMemo(() => new Set(wordsFound), [wordsFound])
  const activeBoardSize = Number.isInteger(boardSize) ? boardSize : size
  const minimumWordLength = getMinimumWordLength(activeBoardSize)
  const swipeGridGap = useMemo(() => {
    if (activeBoardSize >= 8) {
      return '0.35rem'
    }

    if (activeBoardSize >= 6) {
      return '0.5rem'
    }

    if (activeBoardSize >= 5) {
      return '0.6rem'
    }

    return '0.7rem'
  }, [activeBoardSize])
  const currentTracedWord = useMemo(() => getWordFromPath(board, tracePath), [board, tracePath])

  const activeHighlightedPath = tracePath.length > 0 ? tracePath : highlightedPath
  const tracePolylinePoints = tracePoints.map((point) => `${point.x},${point.y}`).join(' ')

  const wordBarClassName =
    feedback?.type === 'success'
      ? 'rounded-xl border border-ui-teal bg-ui-teal/20 px-3 py-2 text-center text-sm font-semibold text-ui-text animate-[pulse_220ms_ease-out_1]'
      : feedback?.type === 'error'
        ? 'rounded-xl border border-ui-danger bg-ui-danger/15 px-3 py-2 text-center text-sm font-semibold text-ui-danger animate-[pulse_220ms_ease-out_1]'
        : 'rounded-xl border border-ui-border bg-ui-surface px-3 py-2 text-center text-sm font-semibold text-ui-muted'

  const setTracePathState = (nextPathOrUpdater) => {
    setTracePath((previousPath) => {
      const nextPath =
        typeof nextPathOrUpdater === 'function' ? nextPathOrUpdater(previousPath) : nextPathOrUpdater
      tracePathRef.current = nextPath
      return nextPath
    })
  }

  const clearTracePath = () => {
    setTracePathState([])
    setTracePoints([])
  }

  const clearFeedbackTimeout = () => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }

  const showFeedback = (nextFeedback) => {
    clearFeedbackTimeout()
    setFeedback(nextFeedback)

    if (nextFeedback) {
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null)
      }, 900)
    }
  }

  const updateTracePoints = (path) => {
    setTracePoints(getTracePoints(boardWrapperRef.current, path))
  }

  useEffect(() => {
    updateTracePoints(tracePath)
  }, [tracePath, board, size, isCompact])

  useEffect(() => {
    if (tracePath.length === 0) {
      return undefined
    }

    const handleViewportResize = () => {
      updateTracePoints(tracePathRef.current)
    }

    window.addEventListener('resize', handleViewportResize)
    window.addEventListener('orientationchange', handleViewportResize)

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize)
    }

    return () => {
      window.removeEventListener('resize', handleViewportResize)
      window.removeEventListener('orientationchange', handleViewportResize)

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize)
      }
    }
  }, [tracePath.length])

  useEffect(
    () => () => {
      clearFeedbackTimeout()
    },
    [],
  )

  const handleTouchStart = (event) => {
    if (status !== 'playing') {
      return
    }

    const tileIndex = getTileIndexFromElement(event.target)

    if (tileIndex === null) {
      return
    }

    isTracingRef.current = true
    setFeedback(null)
    setTracePathState([tileIndex])
  }

  const handleTouchMove = useCallback((event) => {
    if (!isTracingRef.current || status !== 'playing') {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    const touch = event.touches?.[0]

    if (!touch) {
      return
    }

    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY)
    const tileIndex = getTileIndexFromElement(targetElement)

    if (tileIndex === null) {
      return
    }

    setTracePathState((previousPath) => {
      if (previousPath.length === 0) {
        return previousPath
      }

      const lastIndex = previousPath[previousPath.length - 1]

      if (tileIndex === lastIndex) {
        return previousPath
      }

      const secondToLastIndex = previousPath.length > 1 ? previousPath[previousPath.length - 2] : null

      if (secondToLastIndex !== null && tileIndex === secondToLastIndex) {
        return previousPath.slice(0, -1)
      }

      if (previousPath.includes(tileIndex)) {
        return previousPath
      }

      if (!areAdjacent(lastIndex, tileIndex, size)) {
        return previousPath
      }

      return [...previousPath, tileIndex]
    })
  }, [status, size])

  useEffect(() => {
    const element = boardWrapperRef.current
    if (!element) return

    element.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      element.removeEventListener('touchmove', handleTouchMove)
    }
  }, [status, size, handleTouchMove])

  const submitTraceWord = async () => {
    const tracedWord = getWordFromPath(board, tracePathRef.current)

    if (!tracedWord) {
      return
    }

    if (tracedWord.length < minimumWordLength) {
      showFeedback({
        type: 'error',
        message: `Word must be at least ${minimumWordLength} letters.`,
      })
      return
    }

    if (!dictionary?.has(tracedWord)) {
      showFeedback({
        type: 'error',
        message: 'Word is not in dictionary.',
      })
      return
    }

    if (wordsSet.has(tracedWord)) {
      showFeedback({
        type: 'error',
        message: 'You already found that word.',
      })
      return
    }

    if (!canConstructWord(board, size, tracedWord)) {
      showFeedback({
        type: 'error',
        message: 'Word is not constructable from this board.',
      })
      return
    }

    try {
      await onSubmitWord(tracedWord)
      showFeedback({
        type: 'success',
        message: `✓ ${tracedWord.toUpperCase()} added`,
      })
    } catch (error) {
      showFeedback({
        type: 'error',
        message: error.message || 'Unable to submit word.',
      })
    }
  }

  const handleTouchEnd = async () => {
    if (!isTracingRef.current) {
      clearTracePath()
      return
    }

    isTracingRef.current = false
    await submitTraceWord()
    clearTracePath()
  }

  const handleTouchCancel = () => {
    isTracingRef.current = false
    clearTracePath()
  }

  return (
    <section className="grid gap-3">
      <div className={wordBarClassName}>
        {feedback?.message ??
          (currentTracedWord ? currentTracedWord.toUpperCase() : 'Swipe across adjacent tiles to spell')}
      </div>

      <div
        ref={boardWrapperRef}
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <Board
          board={board}
          size={size}
          status={status}
          countdownRemaining={countdownRemaining}
          highlightedPath={activeHighlightedPath}
          isCompact={isCompact}
          gridGapOverride={swipeGridGap}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {tracePoints.length >= 2 ? (
            <polyline
              points={tracePolylinePoints}
              fill="none"
              stroke="rgba(20, 184, 166, 0.75)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {tracePoints.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="rgba(20, 184, 166, 0.9)"
            />
          ))}
        </svg>
      </div>
    </section>
  )
}

export default SwipeBoard
