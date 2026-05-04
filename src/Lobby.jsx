function Lobby({ game, status, countdownRemaining, onStartGame }) {
  const board = Array.isArray(game?.board) ? game.board : []
  const boardSize = Number.isInteger(game?.board_size) ? game.board_size : 0
  const isCountdown = status === 'countdown'
  const canStart = status === 'waiting'

  return (
    <section style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2>Lobby</h2>
      <p>
        Code: <strong>{game?.game_code ?? '----'}</strong>
      </p>

      {canStart ? (
        <button type="button" onClick={onStartGame}>
          Start Game
        </button>
      ) : null}

      {(isCountdown || status === 'playing' || status === 'finished') && boardSize > 0 ? (
        <div style={{ position: 'relative', marginTop: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`,
              gap: 8,
              filter: isCountdown ? 'blur(2px)' : 'none',
              opacity: isCountdown ? 0.7 : 1,
              transition: 'filter 250ms ease, opacity 250ms ease',
            }}
          >
            {board.map((tile, index) => (
              <div
                key={`${tile}-${index}`}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  textAlign: 'center',
                  padding: '0.75rem 0.25rem',
                  fontWeight: 700,
                  background: '#ffffff',
                }}
              >
                {tile}
              </div>
            ))}
          </div>

          {isCountdown && countdownRemaining > 0 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                fontSize: '3rem',
                fontWeight: 800,
                color: '#0f172a',
                pointerEvents: 'none',
              }}
            >
              Game starts in {countdownRemaining}...
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default Lobby
