import { useMemo, useState } from 'react'

function normalizeTile(tile) {
  return String(tile ?? '').trim().toLowerCase()
}

function canConstructWord(board, size, word) {
  if (!Array.isArray(board) || !Number.isInteger(size) || size <= 0) {
    return false
  }

  const target = String(word ?? '').trim().toLowerCase()
  if (target.length < 3) {
    return false
  }

  const totalCells = size * size
  const tiles = board.map(normalizeTile)
  const visited = Array(totalCells).fill(false)

  function advanceIndex(currentIndex, tileValue) {
    if (!tileValue) {
      return -1
    }

    return target.startsWith(tileValue, currentIndex) ? currentIndex + tileValue.length : -1
  }

  function dfs(cellIndex, wordIndex) {
    if (visited[cellIndex]) {
      return false
    }

    const tileValue = tiles[cellIndex]
    const nextIndex = advanceIndex(wordIndex, tileValue)

    if (nextIndex < 0) {
      return false
    }

    if (nextIndex === target.length) {
      return true
    }

    visited[cellIndex] = true

    const row = Math.floor(cellIndex / size)
    const col = cellIndex % size

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) {
          continue
        }

        const nextRow = row + rowOffset
        const nextCol = col + colOffset

        if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
          continue
        }

        const nextCellIndex = nextRow * size + nextCol

        if (!visited[nextCellIndex] && dfs(nextCellIndex, nextIndex)) {
          visited[cellIndex] = false
          return true
        }
      }
    }

    visited[cellIndex] = false
    return false
  }

  for (let index = 0; index < totalCells; index += 1) {
    if (dfs(index, 0)) {
      return true
    }
  }

  return false
}

function WordInput({
  dictionary,
  board,
  boardSize,
  status,
  wordsFound,
  onSubmitWord,
  onRemoveWord,
}) {
  const [value, setValue] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const wordsSet = useMemo(() => new Set(wordsFound), [wordsFound])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (status !== 'playing') {
      return
    }

    const normalizedWord = value.trim().toLowerCase()

    if (normalizedWord.length < 3) {
      setErrorMessage('Word must be at least 3 letters.')
      return
    }

    if (!dictionary?.has(normalizedWord)) {
      setErrorMessage('Word is not in dictionary.')
      return
    }

    if (wordsSet.has(normalizedWord)) {
      setErrorMessage('You already found that word.')
      return
    }

    if (!canConstructWord(board, boardSize, normalizedWord)) {
      setErrorMessage('Word is not constructable from this board.')
      return
    }

    try {
      await onSubmitWord(normalizedWord)
      setValue('')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message || 'Unable to submit word.')
    }
  }

  const disabled = status !== 'playing'

  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Find Words</h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a word"
          disabled={disabled}
        />
        <button type="submit" disabled={disabled}>
          Submit
        </button>
      </form>

      {errorMessage ? <p style={{ color: '#b91c1c' }}>{errorMessage}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
        {wordsFound.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onRemoveWord(word)}
            disabled={disabled}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 999,
              background: '#f8fafc',
              padding: '0.25rem 0.65rem',
            }}
            title="Remove word"
          >
            {word}
          </button>
        ))}
      </div>
    </section>
  )
}

export default WordInput
