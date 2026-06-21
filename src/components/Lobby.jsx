function Lobby({ gameCode, players, canStart, onStartGame }) {
  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>Share code</p>
      <h2 style={{ margin: '0.25rem 0 1rem', letterSpacing: '0.15em' }}>{gameCode || '----'}</h2>

      <h3 style={{ marginBottom: '0.5rem' }}>Players ({players.length})</h3>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {players.map((player) => (
          <li key={player.id}>{player.display_name}</li>
        ))}
      </ul>

      {canStart ? (
        <button type="button" onClick={onStartGame} style={{ marginTop: '1rem' }}>
          Start Game
        </button>
      ) : null}
    </section>
  )
}

export default Lobby
