import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board from './Board'
import { getWordTexts } from '../utils/roundWords'
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

function appendTileToPath(previousPath, tileIndex, size) {
  if (!Number.isInteger(tileIndex)) {
    return previousPath
  }

  if (previousPath.length === 0) {
    return [tileIndex]
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

const SWIPE_INNER_ZONE_RATIO = 0.68
const SWIPE_MIN_DIRECTION_DISTANCE = 4
const SWIPE_DIRECTION_REJECTION_COSINE = -0.35

function getTouchPoint(event) {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0]

  if (!touch) {
    return null
  }

  return {
    x: touch.clientX,
    y: touch.clientY,
  }
}

function isPointInsideRect(point, rect) {
  if (!point || !rect) {
    return false
  }

  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

function getDistanceFromPointToSegment(point, segmentStart, segmentEnd) {
  if (!point || !segmentStart || !segmentEnd) {
    return Number.POSITIVE_INFINITY
  }

  const segmentDx = segmentEnd.x - segmentStart.x
  const segmentDy = segmentEnd.y - segmentStart.y
  const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y)
  }

  const projection =
    ((point.x - segmentStart.x) * segmentDx + (point.y - segmentStart.y) * segmentDy) /
    segmentLengthSquared
  const clampedProjection = Math.min(1, Math.max(0, projection))
  const projectedX = segmentStart.x + clampedProjection * segmentDx
  const projectedY = segmentStart.y + clampedProjection * segmentDy

  return Math.hypot(point.x - projectedX, point.y - projectedY)
}

function getTileGeometry(containerElement) {
  if (!containerElement) {
    return new Map()
  }

  const tileElements = containerElement.querySelectorAll('[data-tile-index]')
  const geometry = new Map()

  tileElements.forEach((tileElement) => {
    const index = Number.parseInt(tileElement.getAttribute('data-tile-index') ?? '', 10)

    if (!Number.isInteger(index)) {
      return
    }

    const rect = tileElement.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const innerWidth = rect.width * SWIPE_INNER_ZONE_RATIO
    const innerHeight = rect.height * SWIPE_INNER_ZONE_RATIO

    geometry.set(index, {
      rect: {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      },
      innerRect: {
        left: centerX - innerWidth / 2,
        right: centerX + innerWidth / 2,
        top: centerY - innerHeight / 2,
        bottom: centerY + innerHeight / 2,
      },
      centerX,
      centerY,
      width: rect.width,
      height: rect.height,
      innerRadius: Math.min(innerWidth, innerHeight) / 2,
    })
  })

  return geometry
}

function getTileIndexFromPoint(point, tileGeometry, requireInnerZone = false) {
  if (!point || !tileGeometry || tileGeometry.size === 0) {
    return null
  }

  let bestIndex = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [index, tileData] of tileGeometry.entries()) {
    const targetRect = requireInnerZone ? tileData.innerRect : tileData.rect

    if (!isPointInsideRect(point, targetRect)) {
      continue
    }

    const distanceToCenter = Math.hypot(point.x - tileData.centerX, point.y - tileData.centerY)

    if (distanceToCenter < bestDistance) {
      bestDistance = distanceToCenter
      bestIndex = index
    }
  }

  return bestIndex
}

function didSegmentTouchInnerZone(segmentStart, segmentEnd, tileData) {
  if (!segmentStart || !segmentEnd || !tileData) {
    return false
  }

  if (isPointInsideRect(segmentStart, tileData.innerRect) || isPointInsideRect(segmentEnd, tileData.innerRect)) {
    return true
  }

  const distanceToSegment = getDistanceFromPointToSegment(
    { x: tileData.centerX, y: tileData.centerY },
    segmentStart,
    segmentEnd,
  )

  return distanceToSegment <= tileData.innerRadius
}

function getSwipeCandidateTileIndex({ path, size, currentPoint, previousPoint, tileGeometry }) {
  if (!Array.isArray(path) || path.length === 0 || !currentPoint || !tileGeometry || tileGeometry.size === 0) {
    return null
  }

  const lastIndex = path[path.length - 1]
  const previousIndex = path.length > 1 ? path[path.length - 2] : null
  const lastTile = tileGeometry.get(lastIndex)

  if (!lastTile) {
    return null
  }

  const swipeDx = previousPoint ? currentPoint.x - previousPoint.x : 0
  const swipeDy = previousPoint ? currentPoint.y - previousPoint.y : 0
  const swipeMagnitude = Math.hypot(swipeDx, swipeDy)

  let bestCandidateIndex = null
  let bestCandidateScore = Number.NEGATIVE_INFINITY

  for (const [candidateIndex, candidateTile] of tileGeometry.entries()) {
    if (candidateIndex === lastIndex) {
      continue
    }

    if (!areAdjacent(lastIndex, candidateIndex, size)) {
      continue
    }

    if (path.includes(candidateIndex) && candidateIndex !== previousIndex) {
      continue
    }

    const isInsideInnerZone = isPointInsideRect(currentPoint, candidateTile.innerRect)
    const segmentTouchesInnerZone = didSegmentTouchInnerZone(previousPoint, currentPoint, candidateTile)

    if (!isInsideInnerZone && !segmentTouchesInnerZone) {
      continue
    }

    let score = 0

    if (isInsideInnerZone) {
      score += 3
    }

    if (segmentTouchesInnerZone) {
      score += 2
    }

    const distanceToCenter = Math.hypot(currentPoint.x - candidateTile.centerX, currentPoint.y - candidateTile.centerY)
    score -= distanceToCenter / Math.max(candidateTile.width, candidateTile.height)

    if (swipeMagnitude >= SWIPE_MIN_DIRECTION_DISTANCE) {
      const candidateDx = candidateTile.centerX - lastTile.centerX
      const candidateDy = candidateTile.centerY - lastTile.centerY
      const candidateMagnitude = Math.hypot(candidateDx, candidateDy)

      if (candidateMagnitude > 0) {
        const cosine = (swipeDx * candidateDx + swipeDy * candidateDy) / (swipeMagnitude * candidateMagnitude)

        if (cosine < SWIPE_DIRECTION_REJECTION_COSINE && !isInsideInnerZone) {
          continue
        }

        score += Math.max(cosine, -0.2) * 1.25
      }
    }

    if (candidateIndex === previousIndex) {
      score += 0.15
    }

    if (score > bestCandidateScore) {
      bestCandidateScore = score
      bestCandidateIndex = candidateIndex
    }
  }

  if (bestCandidateScore < 0.5) {
    return null
  }

  return bestCandidateIndex
}

function SwipeBoard({
  board,
  size,
  status,
  countdownRemaining,
  inputMode = 'swipe',
  highlightedPath = [],
  isCompact = false,
  rotationDegrees = 0,
  dictionary,
  boardSize,
  wordsFound = [],
  onSubmitWord,
}) {
  const [tracePath, setTracePath] = useState([])
  const [tracePoints, setTracePoints] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [activeTraceMethod, setActiveTraceMethod] = useState(null)

  const boardWrapperRef = useRef(null)
  const tracePathRef = useRef([])
  const isTracingRef = useRef(false)
  const feedbackTimeoutRef = useRef(null)
  const activeTraceMethodRef = useRef(null)
  const suppressTileClickUntilRef = useRef(0)
  const tileGeometryRef = useRef(new Map())
  const lastTouchPointRef = useRef(null)

  const wordsSet = useMemo(() => new Set(getWordTexts(wordsFound)), [wordsFound])
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
  const isSwipeMode = inputMode === 'swipe'
  const isTapMode = inputMode === 'tap'
  const isTraceMode = isSwipeMode || isTapMode
  const isHybridTraceMode = isSwipeMode
  const isTapTraceActive = activeTraceMethod === 'tap'

  const activeHighlightedPath = tracePath.length > 0 ? tracePath : highlightedPath
  const tracePolylinePoints = tracePoints.map((point) => `${point.x},${point.y}`).join(' ')

  const wordBarClassName =
    feedback?.type === 'success'
      ? 'rounded-xl border border-ui-teal bg-ui-teal/20 px-3 py-2 text-center text-sm font-semibold text-ui-text animate-[pulse_220ms_ease-out_1]'
      : feedback?.type === 'warning'
        ? 'rounded-xl border border-yellow-400 bg-yellow-400/15 px-3 py-2 text-center text-sm font-semibold text-yellow-300 animate-[pulse_220ms_ease-out_1]'
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

  const setActiveTraceMethodState = (nextMethod) => {
    activeTraceMethodRef.current = nextMethod
    setActiveTraceMethod(nextMethod)
  }

  const clearTracePath = () => {
    isTracingRef.current = false
    lastTouchPointRef.current = null
    setActiveTraceMethodState(null)
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

  const refreshTileGeometry = useCallback(() => {
    tileGeometryRef.current = getTileGeometry(boardWrapperRef.current)
  }, [])

  useEffect(() => {
    updateTracePoints(tracePath)
  }, [tracePath, board, size, isCompact, rotationDegrees])

  useEffect(() => {
    refreshTileGeometry()
  }, [board, size, isCompact, rotationDegrees, refreshTileGeometry])

  useEffect(() => {
    if (tracePath.length === 0) {
      return undefined
    }

    const handleViewportResize = () => {
      refreshTileGeometry()
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
  }, [tracePath.length, refreshTileGeometry])

  useEffect(
    () => () => {
      clearFeedbackTimeout()
    },
    [],
  )

  const handleTouchStart = (event) => {
    if (!isTraceMode || status !== 'playing') {
      return
    }

    if (!isHybridTraceMode || activeTraceMethodRef.current === 'tap') {
      return
    }

    const touchPoint = getTouchPoint(event)

    if (!touchPoint) {
      return
    }

    lastTouchPointRef.current = touchPoint
    refreshTileGeometry()

    let tileIndex = getTileIndexFromElement(event.target)

    if (tileIndex === null) {
      tileIndex = getTileIndexFromPoint(touchPoint, tileGeometryRef.current)
    }

    if (tileIndex === null) {
      return
    }

    isTracingRef.current = true
    setFeedback(null)
    setTracePathState([tileIndex])
  }

  const handleTouchMove = useCallback((event) => {
    if (!isHybridTraceMode || !isTracingRef.current || status !== 'playing') {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    const touchPoint = getTouchPoint(event)

    if (!touchPoint) {
      return
    }

    const previousTouchPoint = lastTouchPointRef.current
    lastTouchPointRef.current = touchPoint

    if (!previousTouchPoint) {
      return
    }

    setTracePathState((previousPath) => {
      const tileIndex = getSwipeCandidateTileIndex({
        path: previousPath,
        size,
        currentPoint: touchPoint,
        previousPoint: previousTouchPoint,
        tileGeometry: tileGeometryRef.current,
      })

      if (tileIndex === null) {
        return previousPath
      }

      const nextPath = appendTileToPath(previousPath, tileIndex, size)

      if (nextPath.length > 1 && activeTraceMethodRef.current !== 'swipe') {
        setActiveTraceMethodState('swipe')
      }

      return nextPath
    })
  }, [isHybridTraceMode, status, size])

  useEffect(() => {
    if (!isTraceMode) {
      return undefined
    }

    const element = boardWrapperRef.current
    if (!element) return

    element.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      element.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isTraceMode, handleTouchMove])

  const handleTapTileClick = (event) => {
    if (!isTraceMode || status !== 'playing') {
      return
    }

    if (Date.now() < suppressTileClickUntilRef.current) {
      return
    }

    if (activeTraceMethodRef.current === 'swipe') {
      return
    }

    const tileIndex = getTileIndexFromElement(event.target)

    if (tileIndex === null) {
      return
    }

    setFeedback(null)

    if (activeTraceMethodRef.current === null) {
      setActiveTraceMethodState('tap')
    }

    setTracePathState((previousPath) => {
      const lastIndex = previousPath[previousPath.length - 1]

      if (tileIndex === lastIndex) {
        const nextPath = previousPath.slice(0, -1)

        if (nextPath.length === 0) {
          setActiveTraceMethodState(null)
        }

        return nextPath
      }

      const nextPath = appendTileToPath(previousPath, tileIndex, size)

      if (nextPath.length === 0) {
        setActiveTraceMethodState(null)
      }

      return nextPath
    })
  }

  const handleTraceCancel = () => {
    if (!isTraceMode) {
      return
    }

    setFeedback(null)
    clearTracePath()
  }

  const handleTraceSubmit = async () => {
    if (!isTraceMode || status !== 'playing') {
      return
    }

    await submitTraceWord()
    clearTracePath()
  }

  const submitTraceWord = async () => {
    const tracedWord = getWordFromPath(board, tracePathRef.current)

    if (!tracedWord) {
      return false
    }

    if (tracedWord.length < minimumWordLength) {
      showFeedback({
        type: 'error',
        message: `Word must be at least ${minimumWordLength} letters.`,
      })
      return false
    }

    if (!dictionary?.has(tracedWord)) {
      showFeedback({
        type: 'error',
        message: 'Word is not in dictionary.',
      })
      return false
    }

    if (wordsSet.has(tracedWord)) {
      showFeedback({
        type: 'warning',
        message: 'You already found that word.',
      })
      return false
    }

    if (!canConstructWord(board, size, tracedWord)) {
      showFeedback({
        type: 'error',
        message: 'Word is not constructable from this board.',
      })
      return false
    }

    try {
      await onSubmitWord(tracedWord)
      showFeedback({
        type: 'success',
        message: `✓ ${tracedWord.toUpperCase()} added`,
      })
      return true
    } catch (error) {
      showFeedback({
        type: 'error',
        message: error.message || 'Unable to submit word.',
      })
      return false
    }
  }

  const handleTouchEnd = async () => {
    if (!isTraceMode) {
      return
    }

    if (!isTracingRef.current) {
      if (activeTraceMethodRef.current === 'tap') {
        return
      }

      clearTracePath()
      return
    }

    isTracingRef.current = false

    if (activeTraceMethodRef.current !== 'swipe') {
      clearTracePath()
      return
    }

    suppressTileClickUntilRef.current = Date.now() + 500
    await submitTraceWord()
    clearTracePath()
  }

  const handleTouchCancel = () => {
    if (!isTraceMode) {
      return
    }

    isTracingRef.current = false
    lastTouchPointRef.current = null
    clearTracePath()
  }

  const cancelButtonClassName = isTapTraceActive
    ? 'grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-danger bg-ui-danger/15 text-base font-bold text-ui-danger transition-colors hover:bg-ui-danger/25 disabled:cursor-not-allowed disabled:opacity-50'
    : 'grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-input-border bg-ui-input-bg text-base font-bold text-ui-input-text transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-50'

  const submitButtonClassName = isTapTraceActive
    ? 'grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-teal bg-ui-teal/20 text-base font-bold text-ui-teal transition-colors hover:bg-ui-teal/30 disabled:cursor-not-allowed disabled:opacity-50'
    : 'grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-input-border bg-ui-input-bg text-base font-bold text-ui-input-text transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-50'

  const wordBarMessage = feedback?.message ??
    (currentTracedWord
      ? currentTracedWord.toUpperCase()
      : isTapMode || isTapTraceActive
        ? 'Tap adjacent tiles to spell'
        : isTraceMode
          ? 'Tap or swipe adjacent tiles to spell'
          : 'Swipe across adjacent tiles to spell')

  return (
    <section className="grid gap-3">
      <div className={`${wordBarClassName} flex items-center justify-between gap-2 text-left`}>
        <button
          type="button"
          onClick={handleTraceCancel}
          disabled={tracePath.length === 0}
          aria-label="Clear traced word"
          className={cancelButtonClassName}
        >
          ×
        </button>

        <span className="min-w-0 flex-1 text-center text-sm font-semibold text-inherit">{wordBarMessage}</span>

        <button
          type="button"
          onClick={handleTraceSubmit}
          disabled={tracePath.length === 0 || status !== 'playing'}
          aria-label="Submit traced word"
          className={submitButtonClassName}
        >
          ✓
        </button>
      </div>

      <div
        ref={boardWrapperRef}
        className="relative"
        onTouchStart={isTraceMode ? handleTouchStart : undefined}
        onTouchEnd={isTraceMode ? handleTouchEnd : undefined}
        onTouchCancel={isTraceMode ? handleTouchCancel : undefined}
        onClick={isTraceMode ? handleTapTileClick : undefined}
      >
        <Board
          board={board}
          size={size}
          status={status}
          countdownRemaining={countdownRemaining}
          highlightedPath={activeHighlightedPath}
          isCompact={isCompact}
          gridGapOverride={swipeGridGap}
          rotationDegrees={rotationDegrees}
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
