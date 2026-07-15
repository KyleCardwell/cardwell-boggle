import { useEffect, useRef } from 'react'

function formatSeconds(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function Timer({ status, countdownRemaining, timeRemaining, isFinishing = false, onTimeExpired }) {
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
    if (isFinishing) {
      return (
        <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-center text-[1.5rem] font-bold text-ui-text">
          <span className="inline-flex items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className="h-5 w-5 rounded-full border-2 border-ui-muted border-t-ui-primary motion-safe:animate-spin"
            />
            <span>Time&apos;s up!</span>
          </span>
        </section>
      )
    }

    return (
      <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-center text-[1.5rem] font-bold text-ui-text [font-variant-numeric:tabular-nums]">
        Time Remaining: {formatSeconds(timeRemaining)}
      </section>
    )
  }

  return null
}

export default Timer
