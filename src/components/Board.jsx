function Board({ board, size, status, countdownRemaining }) {
  if (!Array.isArray(board) || !Number.isInteger(size) || size <= 0) {
    return null
  }

  const isCountdown = status === 'countdown'

  return (
    <section style={{ position: 'relative' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, minmax(2.25rem, 1fr))`,
          gap: '0.45rem',
          filter: isCountdown ? 'blur(2px)' : 'none',
          opacity: isCountdown ? 0.72 : 1,
          transition: 'filter 200ms ease, opacity 200ms ease',
        }}
      >
        {board.map((tile, index) => {
          const normalizedTile = String(tile ?? '').toUpperCase()
          const isSpecialTile = normalizedTile === 'QU'

          return (
            <div
              key={`${normalizedTile}-${index}`}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 10,
                border: isSpecialTile ? '2px solid #0284c7' : '1px solid #94a3b8',
                background: isSpecialTile ? '#e0f2fe' : '#f8fafc',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 'clamp(0.8rem, 2.6vw, 1.2rem)',
                textTransform: 'uppercase',
              }}
            >
              {normalizedTile}
            </div>
          )
        })}
      </div>

      {isCountdown && countdownRemaining > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 'clamp(1.8rem, 5.6vw, 3.1rem)',
            fontWeight: 800,
            color: '#0f172a',
            pointerEvents: 'none',
          }}
        >
          {countdownRemaining}
        </div>
      ) : null}
    </section>
  )
}

export default Board
