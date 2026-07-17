function isPlayerReady(player) {
  return Boolean(player?.ready_at ?? player?.readyAt)
}

function ReadyStatusPanel({
  players = [],
  currentPlayerId,
  isReadyPending = false,
  readyError = '',
  onToggleReady,
}) {
  const readyCount = players.filter(isPlayerReady).length
  const currentPlayer = players.find((player) => player.id === currentPlayerId)
  const currentPlayerReady = isPlayerReady(currentPlayer)
  const canToggleReady = Boolean(currentPlayerId && onToggleReady)

  return (
    <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-left">
          <h3 className="m-0">Next Round</h3>
          <p className="m-0 text-sm text-ui-muted">
            {readyCount} / {players.length} ready
          </p>
        </div>

        {canToggleReady ? (
          <button
            type="button"
            onClick={() => onToggleReady(!currentPlayerReady)}
            disabled={isReadyPending}
            aria-pressed={currentPlayerReady}
            className={`rounded-md px-3 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              currentPlayerReady
                ? 'border border-emerald-400/70 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                : 'bg-ui-primary text-ui-input-text hover:bg-ui-primary-hover'
            }`}
          >
            {isReadyPending ? 'Saving...' : currentPlayerReady ? 'Ready ✓' : 'Ready for Next Round'}
          </button>
        ) : null}
      </div>

      {readyError ? (
        <p className="mb-3 rounded-md border border-ui-danger/40 bg-ui-danger/10 px-3 py-2 text-sm text-ui-danger">
          {readyError}
        </p>
      ) : null}

      <ul className="m-0 grid list-none gap-2 p-0">
        {players.map((player) => {
          const playerReady = isPlayerReady(player)

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                playerReady
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-50'
                  : 'border-ui-border bg-ui-input-bg text-ui-text'
              }`}
            >
              <span className="min-w-0 truncate font-medium">{player.display_name}</span>
              <span
                aria-label={playerReady ? 'Ready' : 'Not ready'}
                title={playerReady ? 'Ready' : 'Not ready'}
                className={`grid h-7 w-7 flex-none place-items-center rounded-full border text-sm font-bold ${
                  playerReady
                    ? 'border-emerald-300 bg-emerald-400 text-emerald-950'
                    : 'border-ui-input-border text-ui-muted'
                }`}
              >
                {playerReady ? '✓' : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ReadyStatusPanel
