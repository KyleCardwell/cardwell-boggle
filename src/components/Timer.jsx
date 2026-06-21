import { useEffect, useRef } from 'react'

function formatSeconds(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function Timer({ status, countdownRemaining, timeRemaining, onTimeExpired }) {
  const hasExpiredRef = useRef(false)

  useEffect(() => {
    if (status !== 'playing') {
      hasExpiredRef.current = false
      return
    }

    if (timeRemaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onTimeExpired?.()
      return
    }

    if (timeRemaining > 0) {
      hasExpiredRef.current = false
    }
  }, [onTimeExpired, status, timeRemaining])

  if (status === 'countdown' && countdownRemaining > 0) {
    return (
      <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-center text-[2rem] font-bold text-ui-text [font-variant-numeric:tabular-nums]">
        Game starts in {countdownRemaining}...
      </section>
    )
  }

  if (status === 'playing') {
    return (
      <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-center text-[1.6rem] font-bold text-ui-text [font-variant-numeric:tabular-nums]">
        Time Remaining: {formatSeconds(timeRemaining)}
      </section>
    )
  }

  return null
}

export default Timer
