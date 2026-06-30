function normalizeTile(tile) {
  return String(tile ?? '').trim().toLowerCase()
}

export function getMinimumWordLength(boardSize) {
  return Number(boardSize) === 4 ? 3 : 4
}

export function canConstructWord(board, size, word) {
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
