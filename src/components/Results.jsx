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
    <section className="grid gap-4">
      <div className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
        <h2 className="mt-0">Results</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {players.map((player) => {
            const words = Array.isArray(player.words_found) ? player.words_found : []
            const score = scoreWords(words)

            return (
              <article key={player.id} className="rounded-[10px] border border-ui-border bg-ui-surface-alt p-3">
                <h3 className="mt-0">{player.display_name}</h3>
                <p className="mb-2">Score: {score}</p>
                <div className="max-h-44 overflow-y-auto pr-1.5">
                  <ul className="m-0 pl-5">
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

      <div className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
        <h3 className="mt-0">All Possible Words ({allWords.length})</h3>
        <div className="max-h-64 overflow-y-auto pr-1.5">
          {groupedAllWords.map(([length, words]) => (
            <div key={length} className="mb-3">
              <p className="mb-1.5 font-semibold">{length} letters</p>
              <p className="m-0 text-ui-muted">{words.join(', ')}</p>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onPlayAgain}
        className="justify-self-start rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover"
      >
        Play Again
      </button>
    </section>
  )
}

export default Results
