function Lobby({ gameCode, players, canStart, onStartGame }) {
  return (
    <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
      <p className="m-0 text-[0.95rem] text-ui-muted">Share code</p>
      <h2 className="mb-4 mt-1 tracking-[0.15em]">{gameCode || '----'}</h2>

      <h3 className="mb-2">Players ({players.length})</h3>
      <ul className="m-0 pl-5">
        {players.map((player) => (
          <li key={player.id}>{player.display_name}</li>
        ))}
      </ul>

      {canStart ? (
        <button
          type="button"
          onClick={onStartGame}
          className="mt-4 rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover"
        >
          Start Game
        </button>
      ) : null}
    </section>
  )
}

export default Lobby
