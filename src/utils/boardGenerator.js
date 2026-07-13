const BASE_TILE_WEIGHTS = [
  ['E', 12],
  ['T', 9],
  ['A', 8],
  ['O', 8],
  ['I', 7],
  ['N', 7],
  ['S', 6],
  ['H', 6],
  ['R', 6],
  ['D', 4],
  ['L', 4],
  ['C', 3],
  ['U', 3],
  ['M', 2],
  ['W', 2],
  ['F', 2],
  ['G', 2],
  ['Y', 2],
  ['P', 2],
  ['B', 1],
  ['V', 1],
  ['K', 1],
  ['J', 1],
  ['X', 1],
  ['Q', 1],
  ['Z', 1],
];

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const DEFAULT_GENERATION_CONSTRAINTS = Object.freeze({
  maxGenerationAttempts: 30,
  minimumVowelRatio: 0.3,
  maximumVowelRatio: 0.5,
  maxAdjacentSameTile: 2,
});

function normalizeTile(tile) {
  return String(tile ?? '').trim().toUpperCase();
}

function isVowelTile(tile) {
  const normalizedTile = normalizeTile(tile);

  for (const character of normalizedTile) {
    if (VOWELS.has(character)) {
      return true;
    }
  }

  return false;
}

function normalizeGenerationConstraints(options = {}) {
  const normalizedAttempts = Number(options.maxGenerationAttempts);
  const normalizedMinimumVowelRatio = Number(options.minimumVowelRatio);
  const normalizedMaximumVowelRatio = Number(options.maximumVowelRatio);
  const normalizedMaxAdjacentSameTile = Number(options.maxAdjacentSameTile);

  let minimumVowelRatio = Number.isFinite(normalizedMinimumVowelRatio)
    ? normalizedMinimumVowelRatio
    : DEFAULT_GENERATION_CONSTRAINTS.minimumVowelRatio;
  let maximumVowelRatio = Number.isFinite(normalizedMaximumVowelRatio)
    ? normalizedMaximumVowelRatio
    : DEFAULT_GENERATION_CONSTRAINTS.maximumVowelRatio;

  minimumVowelRatio = Math.min(0.9, Math.max(0.05, minimumVowelRatio));
  maximumVowelRatio = Math.min(0.9, Math.max(0.05, maximumVowelRatio));

  if (minimumVowelRatio > maximumVowelRatio) {
    minimumVowelRatio = DEFAULT_GENERATION_CONSTRAINTS.minimumVowelRatio;
    maximumVowelRatio = DEFAULT_GENERATION_CONSTRAINTS.maximumVowelRatio;
  }

  return {
    maxGenerationAttempts: Number.isInteger(normalizedAttempts) && normalizedAttempts > 0
      ? normalizedAttempts
      : DEFAULT_GENERATION_CONSTRAINTS.maxGenerationAttempts,
    minimumVowelRatio,
    maximumVowelRatio,
    maxAdjacentSameTile: Number.isInteger(normalizedMaxAdjacentSameTile)
      ? Math.max(0, normalizedMaxAdjacentSameTile)
      : DEFAULT_GENERATION_CONSTRAINTS.maxAdjacentSameTile,
  };
}

function hasBalancedVowelRatio(board, minimumVowelRatio, maximumVowelRatio) {
  const vowelCount = board.reduce((count, tile) => count + (isVowelTile(tile) ? 1 : 0), 0);
  const vowelRatio = vowelCount / board.length;

  return vowelRatio >= minimumVowelRatio && vowelRatio <= maximumVowelRatio;
}

function hasVowelCoverageByRowsAndColumns(board, size) {
  for (let row = 0; row < size; row += 1) {
    let rowHasVowel = false;

    for (let column = 0; column < size; column += 1) {
      if (isVowelTile(board[(row * size) + column])) {
        rowHasVowel = true;
        break;
      }
    }

    if (!rowHasVowel) {
      return false;
    }
  }

  for (let column = 0; column < size; column += 1) {
    let columnHasVowel = false;

    for (let row = 0; row < size; row += 1) {
      if (isVowelTile(board[(row * size) + column])) {
        columnHasVowel = true;
        break;
      }
    }

    if (!columnHasVowel) {
      return false;
    }
  }

  return true;
}

function hasExcessiveSameTileAdjacency(board, size, maxAdjacentSameTile) {
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const tileIndex = (row * size) + column;
      const currentTile = normalizeTile(board[tileIndex]);
      let sameTileNeighbors = 0;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) {
            continue;
          }

          const neighborRow = row + rowOffset;
          const neighborColumn = column + columnOffset;

          if (
            neighborRow < 0 ||
            neighborRow >= size ||
            neighborColumn < 0 ||
            neighborColumn >= size
          ) {
            continue;
          }

          const neighborTile = normalizeTile(board[(neighborRow * size) + neighborColumn]);

          if (neighborTile === currentTile) {
            sameTileNeighbors += 1;

            if (sameTileNeighbors > maxAdjacentSameTile) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

function hasAcceptableDistribution(board, size, constraints) {
  return (
    hasBalancedVowelRatio(board, constraints.minimumVowelRatio, constraints.maximumVowelRatio) &&
    hasVowelCoverageByRowsAndColumns(board, size) &&
    !hasExcessiveSameTileAdjacency(board, size, constraints.maxAdjacentSameTile)
  );
}

function buildTileWeights(options = {}) {
  const { useQu = true, useTh = false, useIn = false } = options;

  const tileWeights = BASE_TILE_WEIGHTS.map(([tile, weight]) => ({ tile, weight }));

  if (useQu) {
    const qIndex = tileWeights.findIndex(({ tile }) => tile === 'Q');

    if (qIndex >= 0) {
      tileWeights[qIndex] = { tile: 'QU', weight: tileWeights[qIndex].weight };
    } else {
      tileWeights.push({ tile: 'QU', weight: 1 });
    }
  }

  if (useTh) {
    tileWeights.push({ tile: 'TH', weight: 3 });
  }

  if (useIn) {
    tileWeights.push({ tile: 'IN', weight: 2 });
  }

  return tileWeights;
}

function buildDie(tileWeights) {
  const totalWeight = tileWeights.reduce((total, { weight }) => total + weight, 0);
  const faces = [];

  for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
    let randomValue = Math.random() * totalWeight;

    for (const { tile, weight } of tileWeights) {
      randomValue -= weight;

      if (randomValue <= 0) {
        faces.push(tile);
        break;
      }
    }

    if (faces.length <= faceIndex) {
      faces.push(tileWeights[tileWeights.length - 1].tile);
    }
  }

  return faces;
}

function buildDicePool(totalTiles, tileWeights) {
  const totalFaces = totalTiles * 6;
  const totalWeight = tileWeights.reduce((total, { weight }) => total + weight, 0);
  const sortedByWeight = [...tileWeights].sort((a, b) => b.weight - a.weight);
  const facePool = [];

  for (const { tile, weight } of tileWeights) {
    const targetCount = Math.round((weight / totalWeight) * totalFaces);

    for (let count = 0; count < targetCount; count += 1) {
      facePool.push(tile);
    }
  }

  let adjustmentIndex = 0;
  while (facePool.length < totalFaces) {
    facePool.push(sortedByWeight[adjustmentIndex % sortedByWeight.length].tile);
    adjustmentIndex += 1;
  }

  adjustmentIndex = 0;
  while (facePool.length > totalFaces) {
    const tileToRemove = sortedByWeight[adjustmentIndex % sortedByWeight.length].tile;
    const removeIndex = facePool.lastIndexOf(tileToRemove);

    if (removeIndex >= 0) {
      facePool.splice(removeIndex, 1);
    } else {
      facePool.pop();
    }

    adjustmentIndex += 1;
  }

  fisherYatesShuffle(facePool);

  const dice = Array.from({ length: totalTiles }, () => buildDie(tileWeights));
  for (let dieIndex = 0; dieIndex < totalTiles; dieIndex += 1) {
    const start = dieIndex * 6;
    dice[dieIndex] = facePool.slice(start, start + 6);
  }

  return dice;
}

function fisherYatesShuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

function rollBoardFromDicePool(dicePool) {
  fisherYatesShuffle(dicePool);

  return dicePool.map((die) => {
    const faceIndex = Math.floor(Math.random() * 6);
    return die[faceIndex];
  });
}

export function generateBoard(size, options = {}) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize) || normalizedSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  const totalTiles = normalizedSize * normalizedSize;
  const tileWeights = buildTileWeights(options);
  const dicePool = buildDicePool(totalTiles, tileWeights);
  const constraints = normalizeGenerationConstraints(options);
  let fallbackBoard = rollBoardFromDicePool(dicePool);

  if (hasAcceptableDistribution(fallbackBoard, normalizedSize, constraints)) {
    return fallbackBoard;
  }

  for (let attempt = 1; attempt < constraints.maxGenerationAttempts; attempt += 1) {
    const candidateBoard = rollBoardFromDicePool(dicePool);
    fallbackBoard = candidateBoard;

    if (hasAcceptableDistribution(candidateBoard, normalizedSize, constraints)) {
      return candidateBoard;
    }
  }

  return fallbackBoard;
}
