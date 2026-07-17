function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeId(value) {
  return String(value ?? '').trim()
}

function sameRoundId(firstRoundId, secondRoundId) {
  const firstTime = new Date(firstRoundId).getTime()
  const secondTime = new Date(secondRoundId).getTime()

  if (Number.isFinite(firstTime) && Number.isFinite(secondTime)) {
    return firstTime === secondTime
  }

  return normalizeId(firstRoundId) === normalizeId(secondRoundId)
}

export function getWordText(entry) {
  if (entry && typeof entry === 'object') {
    return normalizeText(entry.word ?? entry.text ?? entry.value)
  }

  return normalizeText(entry)
}

export function makeRoundWordEntry(word, gameId, roundId) {
  return {
    word: getWordText(word),
    gameId: normalizeId(gameId),
    roundId: normalizeId(roundId),
  }
}

export function wordEntryBelongsToRound(entry, gameId, roundId) {
  if (!entry || typeof entry !== 'object') {
    return false
  }

  const entryGameId = normalizeId(entry.gameId ?? entry.game_id)
  const entryRoundId = normalizeId(entry.roundId ?? entry.round_id ?? entry.roundStartedAt ?? entry.round_started_at)

  return Boolean(
    getWordText(entry) &&
      entryGameId &&
      entryRoundId &&
      entryGameId === normalizeId(gameId) &&
      sameRoundId(entryRoundId, roundId),
  )
}

export function getWordsForRound(words, gameId, roundId, { allowLegacyStrings = false } = {}) {
  if (!Array.isArray(words)) {
    return []
  }

  const seenWords = new Set()
  const roundWords = []

  for (const entry of words) {
    const word = getWordText(entry)

    if (!word || seenWords.has(word)) {
      continue
    }

    const isLegacyString = typeof entry === 'string'
    if (!wordEntryBelongsToRound(entry, gameId, roundId) && !(allowLegacyStrings && isLegacyString)) {
      continue
    }

    seenWords.add(word)
    roundWords.push(
      isLegacyString
        ? makeRoundWordEntry(word, gameId, roundId)
        : {
            ...entry,
            word,
            gameId: normalizeId(entry.gameId ?? entry.game_id),
            roundId: normalizeId(entry.roundId ?? entry.round_id ?? entry.roundStartedAt ?? entry.round_started_at),
          },
    )
  }

  return roundWords
}

export function getWordTexts(words) {
  if (!Array.isArray(words)) {
    return []
  }

  return words.map(getWordText).filter(Boolean)
}

export function getWordsKey(words) {
  return getWordTexts(words).join('\u0000')
}

export function wordListIncludes(words, word) {
  const normalizedWord = getWordText(word)

  return Boolean(normalizedWord && getWordTexts(words).includes(normalizedWord))
}

export function addWordToRound(words, word, gameId, roundId) {
  const normalizedWord = getWordText(word)

  if (!normalizedWord || wordListIncludes(words, normalizedWord)) {
    return Array.isArray(words) ? words : []
  }

  return [...(Array.isArray(words) ? words : []), makeRoundWordEntry(normalizedWord, gameId, roundId)]
}

export function removeWordFromRound(words, word) {
  const normalizedWord = getWordText(word)

  if (!normalizedWord || !Array.isArray(words)) {
    return []
  }

  return words.filter((entry) => getWordText(entry) !== normalizedWord)
}
