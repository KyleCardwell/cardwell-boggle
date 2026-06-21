function Lobby({ gameCode, players, canStart, onStartGame }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <p className="m-0 text-[0.95rem] text-slate-600">Share code</p>
      <h2 className="mb-4 mt-1 tracking-[0.15em]">{gameCode || '----'}</h2>

      <h3 className="mb-2">Players ({players.length})</h3>
      <ul className="m-0 pl-5">
        {players.map((player) => (
          <li key={player.id}>{player.display_name}</li>
        ))}
      </ul>

      {canStart ? (
        <button type="button" onClick={onStartGame} className="mt-4">
          Start Game
        </button>
      ) : null}
    </section>
  )
}

export default Lobby
