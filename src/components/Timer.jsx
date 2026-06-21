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
      <section
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '1rem',
          textAlign: 'center',
          fontSize: '2rem',
          fontWeight: 700,
        }}
      >
        Game starts in {countdownRemaining}...
      </section>
    )
  }

  if (status === 'playing') {
    return (
      <section
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '1rem',
          textAlign: 'center',
          fontSize: '1.6rem',
          fontWeight: 700,
        }}
      >
        Time Remaining: {formatSeconds(timeRemaining)}
      </section>
    )
  }

  return null
}

export default Timer
