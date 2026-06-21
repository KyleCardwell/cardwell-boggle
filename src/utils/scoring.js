export function scoreWord(word) {
  const length = String(word ?? '').trim().length

  if (length <= 2) {
    return 0
  }

  if (length <= 4) {
    return 1
  }

  if (length === 5) {
    return 2
  }

  if (length === 6) {
    return 3
  }

  if (length === 7) {
    return 5
  }

  return 2 * length
}

export function scoreWords(words) {
  if (!Array.isArray(words)) {
    return 0
  }

  return words.reduce((total, word) => total + scoreWord(word), 0)
}
