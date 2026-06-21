function PlayerList({ players }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="mt-0">Players</h3>
      <ul className="m-0 pl-5">
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
