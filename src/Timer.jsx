function formatSeconds(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function Timer({ status, countdownRemaining, timeRemaining }) {
  if (status === 'countdown' && countdownRemaining > 0) {
    return (
      <div style={{ fontSize: '2.5rem', fontWeight: 700, textAlign: 'center' }}>
        Game starts in {countdownRemaining}...
      </div>
    )
  }

  if (status === 'playing') {
    return (
      <div style={{ fontSize: '2rem', fontWeight: 700, textAlign: 'center' }}>
        Time: {formatSeconds(timeRemaining)}
      </div>
    )
  }

  if (status === 'finished') {
    return (
      <div style={{ fontSize: '1.75rem', fontWeight: 700, textAlign: 'center' }}>
        Game finished
      </div>
    )
  }

  return (
    <div style={{ fontSize: '1.25rem', textAlign: 'center' }}>
      Waiting to start
    </div>
  )
}

export default Timer
