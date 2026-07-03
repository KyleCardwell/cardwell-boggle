import { useMemo } from 'react'

function buildScoreRows(roundHistory, players) {
  const currentNameById = new Map(
    (Array.isArray(players) ? players : []).map((player) => [player.id, player.display_name]),
  )
  const totalsByPlayerId = new Map()

  for (const roundRow of Array.isArray(roundHistory) ? roundHistory : []) {
    const playerId = roundRow?.player_id

    if (!playerId) {
      continue
    }

    const existing = totalsByPlayerId.get(playerId) ?? {
      playerId,
      displayName:
        currentNameById.get(playerId) || String(roundRow?.display_name ?? '').trim() || 'Unknown Player',
      wins: 0,
      totalScore: 0,
      totalWords: 0,
    }

    existing.displayName =
      currentNameById.get(playerId) || String(roundRow?.display_name ?? '').trim() || existing.displayName
    existing.wins += roundRow?.is_winner ? 1 : 0
    existing.totalScore += Number(roundRow?.score ?? 0)
    existing.totalWords += Number(roundRow?.words_found ?? 0)

    totalsByPlayerId.set(playerId, existing)
  }

  return Array.from(totalsByPlayerId.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins
    }

    if (b.totalWords !== a.totalWords) {
      return b.totalWords - a.totalWords
    }

    return a.displayName.localeCompare(b.displayName)
  })
}

function buildRounds(roundHistory, players) {
  const currentNameById = new Map(
    (Array.isArray(players) ? players : []).map((player) => [player.id, player.display_name]),
  )
  const roundMap = new Map()

  for (const roundRow of Array.isArray(roundHistory) ? roundHistory : []) {
    const roundNumber = Number(roundRow?.round_number)

    if (!Number.isInteger(roundNumber) || roundNumber <= 0) {
      continue
    }

    if (!roundMap.has(roundNumber)) {
      roundMap.set(roundNumber, [])
    }

    roundMap.get(roundNumber).push({
      ...roundRow,
      score: Number(roundRow?.score ?? 0),
      words_found: Number(roundRow?.words_found ?? 0),
      display_name:
        currentNameById.get(roundRow?.player_id) ||
        String(roundRow?.display_name ?? '').trim() ||
        'Unknown Player',
    })
  }

  return Array.from(roundMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([roundNumber, rows]) => ({
      roundNumber,
      rows: rows.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score
        }

        return a.display_name.localeCompare(b.display_name)
      }),
    }))
}

function Scoreboard({ roundHistory, players }) {
  const scoreRows = useMemo(() => buildScoreRows(roundHistory, players), [roundHistory, players])
  const rankedScoreRows = useMemo(
    () =>
      scoreRows.map((row) => ({
        ...row,
        rank: scoreRows.findIndex((entry) => entry.totalScore === row.totalScore) + 1,
      })),
    [scoreRows],
  )
  const rounds = useMemo(() => buildRounds(roundHistory, players), [roundHistory, players])

  if (scoreRows.length === 0) {
    return null
  }

  return (
    <section className="min-w-0 w-full overflow-hidden rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
      <h3 className="mt-0">Scoreboard</h3>

      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-center text-sm">
          <thead>
            <tr className="border-b border-ui-border text-ui-muted">
              <th className="px-2 py-2 font-semibold">Rank</th>
              <th className="px-2 py-2 font-semibold">Player</th>
              <th className="px-2 py-2 font-semibold">Wins</th>
              <th className="px-2 py-2 font-semibold">Total Words</th>
              <th className="px-2 py-2 font-semibold text-center">Total Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedScoreRows.map((row, index) => {
              const isLeader = index === 0

              return (
                <tr
                  key={row.playerId}
                  className={isLeader ? 'bg-ui-primary/10' : 'border-t border-ui-border/60'}
                >
                  <td className="px-2 py-2 font-semibold">{row.rank}</td>
                  <td className="px-2 py-2 break-words">{row.displayName}</td>
                  <td className="px-2 py-2">{row.wins}</td>
                  <td className="px-2 py-2">{row.totalWords}</td>
                  <td className="px-2 py-2 font-semibold bg-emerald-800">{row.totalScore}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <details className="mt-4 rounded-md border border-ui-border bg-ui-surface-alt p-3">
        <summary className="cursor-pointer font-semibold">Round-by-round</summary>

        <div className="mt-3 grid gap-3">
          {rounds.map((round) => {
            const winners = round.rows.filter((row) => row.is_winner).map((row) => row.display_name)

            return (
              <article key={round.roundNumber} className="min-w-0 rounded-md border border-ui-border bg-ui-surface p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <h4 className="m-0">Round {round.roundNumber}</h4>
                  <p className="m-0 min-w-0 break-words text-sm text-ui-muted">
                    Winner{winners.length === 1 ? '' : 's'}: {winners.join(', ') || '—'}
                  </p>
                </div>

                <div className="mt-2 w-full overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-center text-sm">
                    <thead>
                      <tr className="border-b border-ui-border text-ui-muted">
                        <th className="px-2 py-2 font-semibold">Player</th>
                        <th className="px-2 py-2 font-semibold">Points</th>
                        <th className="px-2 py-2 font-semibold">Words</th>
                        <th className="px-2 py-2 font-semibold">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {round.rows.map((row, index) => (
                        <tr
                          key={row.id ?? `${round.roundNumber}-${row.player_id}`}
                          className={index === 0 ? '' : 'border-t border-ui-border/60'}
                        >
                          <td className="px-2 py-2 break-words">{row.display_name}</td>
                          <td className="px-2 py-2">{row.score}</td>
                          <td className="px-2 py-2">{row.words_found}</td>
                          <td className="px-2 py-2 font-semibold">{row.is_winner ? 'winner' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )
          })}
        </div>
      </details>
    </section>
  )
}

export default Scoreboard
