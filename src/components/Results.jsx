import { scoreWord } from '../utils/scoring'
import { getWordText, getWordsForRound as getTaggedWordsForRound } from '../utils/roundWords'
import { getMinimumWordLength } from '../utils/wordValidation'
import ReadyStatusPanel from './ReadyStatusPanel'
import Scoreboard from './Scoreboard'

function groupWordsByLength(words) {
  const groups = new Map()

  for (const word of Array.isArray(words) ? words : []) {
    const normalized = getWordText(word)

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

function normalizeWords(words, minimumWordLength = 3) {
  if (!Array.isArray(words)) {
    return []
  }

  return words
    .map((word) => getWordText(word))
    .filter((word) => word.length >= minimumWordLength)
}

function getSharedWordSet(players, minimumWordLength) {
  const playerCountByWord = new Map()

  for (const player of players) {
    const uniqueWords = new Set(normalizeWords(player.words_found, minimumWordLength))

    for (const word of uniqueWords) {
      playerCountByWord.set(word, (playerCountByWord.get(word) ?? 0) + 1)
    }
  }

  return new Set(
    Array.from(playerCountByWord.entries())
      .filter(([, count]) => count > 1)
      .map(([word]) => word),
  )
}

function isSameRoundStartedAt(firstStartedAt, secondStartedAt) {
  const firstTime = new Date(firstStartedAt).getTime()
  const secondTime = new Date(secondStartedAt).getTime()

  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime === secondTime
}

function getWordsForRound(player, gameId, currentRoundStartedAt, minimumWordLength) {
  const words = Array.isArray(player?.words_found) ? player.words_found : []
  const taggedWords = getTaggedWordsForRound(words, gameId, currentRoundStartedAt)

  if (taggedWords.length > 0) {
    return normalizeWords(taggedWords, minimumWordLength)
  }

  if (words.length > 0 && !isSameRoundStartedAt(player?.words_round_started_at, currentRoundStartedAt)) {
    return []
  }

  return normalizeWords(words, minimumWordLength)
}

function Results({
  players,
  allWords,
  roundHistory = [],
  boardSize,
  currentRoundStartedAt,
  gameId,
  currentPlayerId,
  isReadyPending,
  readyError,
  onToggleReady,
  onWordHover,
  onWordHoverEnd,
}) {
  const minimumWordLength = getMinimumWordLength(boardSize)
  const filteredAllWords = normalizeWords(allWords, minimumWordLength)
  const groupedAllWords = groupWordsByLength(filteredAllWords)
  const playersForRound = players.map((player) => ({
    ...player,
    words_found: getWordsForRound(player, gameId, currentRoundStartedAt, minimumWordLength),
  }))
  const sharedWordSet = getSharedWordSet(playersForRound, minimumWordLength)

  return (
    <section className="grid gap-4">
      <div className="max-h-[50vh] overflow-y-auto pr-1.5">
        <div className="grid gap-4">
          <div className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
            <h2 className="mt-0">Results</h2>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {playersForRound.map((player) => {
                const words = normalizeWords(player.words_found, minimumWordLength)
                const score = words.reduce(
                  (total, word) => total + (sharedWordSet.has(word) ? 0 : scoreWord(word)),
                  0,
                )

                return (
                  <article key={player.id} className="rounded-[10px] border border-ui-border bg-ui-surface-alt p-3">
                    <div className="flex items-center justify-between border-b border-ui-border pb-1">
                      <h3 className="mt-0">{player.display_name}</h3>
                      <p className="mb-0 text-right">
                        {words.length} Word{words.length === 1 ? '' : 's'} · Score: {score}
                      </p>
                    </div>
                    <ul className="m-0 pl-5 grid grid-cols-3 gap-1">
                      {words.map((word, index) => (
                        <li
                          key={`${player.id}-${word}-${index}`}
                          className={sharedWordSet.has(word) ? 'text-ui-muted line-through' : undefined}
                        >
                          <button
                            type="button"
                            className="inline cursor-pointer border-none bg-transparent p-0 text-inherit underline-offset-2 transition-colors hover:text-ui-text hover:underline focus-visible:text-ui-text focus-visible:underline focus-visible:outline-none"
                            onMouseEnter={() => onWordHover?.(word)}
                            onMouseLeave={() => onWordHoverEnd?.()}
                            onFocus={() => onWordHover?.(word)}
                            onBlur={() => onWordHoverEnd?.()}
                          >
                            {word}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
            <h3 className="mt-0">All Possible Words ({filteredAllWords.length})</h3>
            {groupedAllWords.map(([length, words]) => (
              <div key={length} className="mb-3">
                <p className="mb-1.5 font-semibold">{length} letters</p>
                <p className="m-0 text-ui-muted leading-relaxed">
                  {words.map((word, index) => (
                    <span key={`${length}-${word}-${index}`}>
                      <button
                        type="button"
                        className="inline cursor-pointer border-none bg-transparent p-0 text-inherit underline-offset-2 transition-colors hover:text-ui-text hover:underline focus-visible:text-ui-text focus-visible:underline focus-visible:outline-none"
                        onMouseEnter={() => onWordHover?.(word)}
                        onMouseLeave={() => onWordHoverEnd?.()}
                        onFocus={() => onWordHover?.(word)}
                        onBlur={() => onWordHoverEnd?.()}
                      >
                        {word}
                      </button>
                      {index < words.length - 1 ? ', ' : null}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {roundHistory.length > 0 ? <Scoreboard roundHistory={roundHistory} players={players} /> : null}

      <ReadyStatusPanel
        players={players}
        currentPlayerId={currentPlayerId}
        isReadyPending={isReadyPending}
        readyError={readyError}
        onToggleReady={onToggleReady}
      />
    </section>
  )
}

export default Results
