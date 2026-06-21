function PlayerList({ players }) {
  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Players</h3>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {players.map((player) => {
          const count = Array.isArray(player.words_found) ? player.words_found.length : 0

          return (
            <li key={player.id}>
              <strong>{player.display_name}</strong> — {count} word{count === 1 ? '' : 's'}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default PlayerList
