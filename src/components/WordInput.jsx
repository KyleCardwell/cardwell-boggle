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
    <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
      <h3 className="mt-0 text-ui-text">Find Words</h3>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a word"
          disabled={disabled}
          className="min-w-[180px] flex-1 rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text placeholder:text-ui-muted disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit
        </button>
      </form>

      {errorMessage ? <p className="mt-2 text-ui-danger">{errorMessage}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {wordsFound.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onRemoveWord(word)}
            disabled={disabled}
            className="rounded-full border border-ui-input-border bg-ui-input-bg px-2.5 py-1 text-sm text-ui-input-text disabled:cursor-not-allowed disabled:opacity-60"
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
