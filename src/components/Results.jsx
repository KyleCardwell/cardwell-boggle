import { scoreWords } from '../utils/scoring'

function groupWordsByLength(words) {
  const groups = new Map()

  for (const word of words) {
    const normalized = String(word ?? '').trim().toLowerCase()

    if (!normalized) {
      continue
    }

    const length = normalized.length

    if (!groups.has(length)) {
      groups.set(length, [])
    }

    groups.get(length).push(normalized)
  }

  return Array.from(groups.entries())
    .map(([length, groupedWords]) => [length, groupedWords.sort()])
    .sort((a, b) => a[0] - b[0])
}

function Results({ players, allWords, onPlayAgain }) {
  const groupedAllWords = groupWordsByLength(allWords)

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Results</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {players.map((player) => {
            const words = Array.isArray(player.words_found) ? player.words_found : []
            const score = scoreWords(words)

            return (
              <article key={player.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem' }}>
                <h3 style={{ marginTop: 0 }}>{player.display_name}</h3>
                <p style={{ margin: '0 0 0.5rem' }}>Score: {score}</p>
                <div style={{ maxHeight: '11rem', overflowY: 'auto', paddingRight: '0.35rem' }}>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {words.map((word) => (
                      <li key={`${player.id}-${word}`}>{word}</li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>All Possible Words ({allWords.length})</h3>
        <div style={{ maxHeight: '16rem', overflowY: 'auto', paddingRight: '0.35rem' }}>
          {groupedAllWords.map(([length, words]) => (
            <div key={length} style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>{length} letters</p>
              <p style={{ margin: 0, color: '#334155' }}>{words.join(', ')}</p>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={onPlayAgain} style={{ justifySelf: 'start' }}>
        Play Again
      </button>
    </section>
  )
}

export default Results
