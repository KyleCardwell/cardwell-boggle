import { findAllWords } from './boardSolver';
import { scoreWord } from './scoring';

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

const DEFAULT_PLAYABILITY_OPTIONS = Object.freeze({
  candidateBoardCount: 24,
  minimumCandidateBoardCount: 15,
  maximumCandidateBoardCount: 30,
  finalistRatio: 0.35,
  minimumWordCountsBySize: Object.freeze({
    4: 28,
    5: 45,
    6: 70,
  }),
  minimumLongWordCountsBySize: Object.freeze({
    4: 4,
    5: 8,
    6: 14,
  }),
});

const CURATED_DICE_BY_SIZE = Object.freeze({
  4: Object.freeze([
    Object.freeze(['A', 'A', 'E', 'E', 'G', 'N']),
    Object.freeze(['A', 'B', 'B', 'J', 'O', 'O']),
    Object.freeze(['A', 'C', 'H', 'O', 'P', 'S']),
    Object.freeze(['A', 'F', 'F', 'K', 'P', 'S']),
    Object.freeze(['A', 'O', 'O', 'T', 'T', 'W']),
    Object.freeze(['C', 'I', 'M', 'O', 'T', 'U']),
    Object.freeze(['D', 'E', 'I', 'L', 'R', 'X']),
    Object.freeze(['D', 'E', 'L', 'R', 'V', 'Y']),
    Object.freeze(['D', 'I', 'S', 'T', 'T', 'Y']),
    Object.freeze(['E', 'E', 'G', 'H', 'N', 'W']),
    Object.freeze(['E', 'E', 'I', 'N', 'S', 'U']),
    Object.freeze(['E', 'H', 'R', 'T', 'V', 'W']),
    Object.freeze(['E', 'I', 'O', 'S', 'S', 'T']),
    Object.freeze(['E', 'L', 'R', 'T', 'T', 'Y']),
    Object.freeze(['H', 'I', 'M', 'N', 'QU', 'U']),
    Object.freeze(['H', 'L', 'N', 'N', 'R', 'Z']),
  ]),
  5: Object.freeze([
    Object.freeze(['A', 'A', 'A', 'F', 'R', 'S']),
    Object.freeze(['A', 'A', 'E', 'E', 'E', 'E']),
    Object.freeze(['A', 'A', 'F', 'I', 'R', 'S']),
    Object.freeze(['A', 'D', 'E', 'N', 'N', 'N']),
    Object.freeze(['A', 'E', 'E', 'E', 'E', 'M']),
    Object.freeze(['A', 'E', 'E', 'G', 'M', 'U']),
    Object.freeze(['A', 'E', 'G', 'M', 'N', 'N']),
    Object.freeze(['A', 'F', 'I', 'R', 'S', 'Y']),
    Object.freeze(['B', 'J', 'K', 'QU', 'X', 'Z']),
    Object.freeze(['C', 'C', 'E', 'N', 'S', 'T']),
    Object.freeze(['C', 'E', 'I', 'I', 'L', 'T']),
    Object.freeze(['C', 'E', 'I', 'L', 'P', 'T']),
    Object.freeze(['C', 'E', 'I', 'P', 'S', 'T']),
    Object.freeze(['D', 'D', 'H', 'N', 'O', 'T']),
    Object.freeze(['D', 'H', 'H', 'L', 'O', 'R']),
    Object.freeze(['D', 'H', 'H', 'N', 'O', 'W']),
    Object.freeze(['D', 'H', 'L', 'N', 'O', 'R']),
    Object.freeze(['E', 'I', 'I', 'I', 'T', 'T']),
    Object.freeze(['E', 'M', 'O', 'T', 'T', 'T']),
    Object.freeze(['E', 'N', 'S', 'S', 'S', 'U']),
    Object.freeze(['F', 'I', 'P', 'R', 'S', 'Y']),
    Object.freeze(['G', 'O', 'R', 'R', 'V', 'W']),
    Object.freeze(['H', 'I', 'P', 'R', 'R', 'Y']),
    Object.freeze(['N', 'O', 'O', 'T', 'U', 'W']),
    Object.freeze(['O', 'O', 'O', 'T', 'T', 'U']),
  ]),
  6: Object.freeze([
    Object.freeze(['A', 'A', 'A', 'F', 'R', 'S']),
    Object.freeze(['A', 'A', 'E', 'E', 'E', 'E']),
    Object.freeze(['A', 'A', 'F', 'I', 'R', 'S']),
    Object.freeze(['A', 'D', 'E', 'N', 'N', 'N']),
    Object.freeze(['A', 'E', 'E', 'E', 'E', 'M']),
    Object.freeze(['A', 'E', 'E', 'G', 'M', 'U']),
    Object.freeze(['A', 'E', 'G', 'M', 'N', 'N']),
    Object.freeze(['A', 'F', 'I', 'R', 'S', 'Y']),
    Object.freeze(['B', 'J', 'K', 'QU', 'X', 'Z']),
    Object.freeze(['C', 'C', 'E', 'N', 'S', 'T']),
    Object.freeze(['C', 'E', 'I', 'I', 'L', 'T']),
    Object.freeze(['C', 'E', 'I', 'L', 'P', 'T']),
    Object.freeze(['C', 'E', 'I', 'P', 'S', 'T']),
    Object.freeze(['D', 'D', 'H', 'N', 'O', 'T']),
    Object.freeze(['D', 'H', 'H', 'L', 'O', 'R']),
    Object.freeze(['D', 'H', 'H', 'N', 'O', 'W']),
    Object.freeze(['D', 'H', 'L', 'N', 'O', 'R']),
    Object.freeze(['E', 'I', 'I', 'I', 'T', 'T']),
    Object.freeze(['E', 'M', 'O', 'T', 'T', 'T']),
    Object.freeze(['E', 'N', 'S', 'S', 'S', 'U']),
    Object.freeze(['F', 'I', 'P', 'R', 'S', 'Y']),
    Object.freeze(['G', 'O', 'R', 'R', 'V', 'W']),
    Object.freeze(['H', 'I', 'P', 'R', 'R', 'Y']),
    Object.freeze(['N', 'O', 'O', 'T', 'U', 'W']),
    Object.freeze(['O', 'O', 'O', 'T', 'T', 'U']),
    Object.freeze(['A', 'A', 'E', 'E', 'R', 'R']),
    Object.freeze(['A', 'D', 'H', 'N', 'O', 'T']),
    Object.freeze(['A', 'E', 'I', 'O', 'U', 'Y']),
    Object.freeze(['B', 'F', 'G', 'K', 'V', 'Z']),
    Object.freeze(['C', 'H', 'M', 'P', 'S', 'A']),
    Object.freeze(['C', 'L', 'N', 'R', 'T', 'Y']),
    Object.freeze(['D', 'G', 'P', 'R', 'S', 'T']),
    Object.freeze(['E', 'R', 'T', 'H', 'A', 'N']),
    Object.freeze(['I', 'N', 'G', 'S', 'T', 'R']),
    Object.freeze(['L', 'R', 'S', 'T', 'N', 'E']),
    Object.freeze(['QU', 'TH', 'IN', 'ER', 'HE', 'AN']),
  ]),
});

const COMMON_TILE_PAIRS = new Set([
  'AN',
  'AR',
  'AT',
  'CH',
  'ED',
  'EN',
  'ER',
  'ES',
  'HE',
  'IN',
  'LE',
  'ON',
  'OR',
  'RE',
  'SH',
  'ST',
  'TE',
  'TH',
  'TO',
  'TR',
]);

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

function normalizeDicePool(dicePool) {
  return dicePool.map((die) => die.map((face) => normalizeTile(face)));
}

function getCuratedDicePool(size) {
  const curatedDice = CURATED_DICE_BY_SIZE[size];

  if (!curatedDice) {
    return null;
  }

  return normalizeDicePool(curatedDice);
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

function createDicePool(size, options = {}) {
  const normalizedSize = Number(size);
  const totalTiles = normalizedSize * normalizedSize;
  const { dicePreset = 'curated' } = options;

  if (dicePreset !== 'weighted') {
    const curatedDicePool = getCuratedDicePool(normalizedSize);

    if (curatedDicePool) {
      return curatedDicePool;
    }
  }

  const tileWeights = buildTileWeights(options);
  return buildDicePool(totalTiles, tileWeights);
}

function fisherYatesShuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

function rollBoardFromDicePool(dicePool) {
  const shuffledDicePool = [...dicePool];
  fisherYatesShuffle(shuffledDicePool);

  return shuffledDicePool.map((die) => {
    const faceIndex = Math.floor(Math.random() * 6);
    return die[faceIndex];
  });
}

function normalizePlayabilityOptions(size, options = {}) {
  const normalizedCandidateCount = Number(options.candidateBoardCount);
  const candidateBoardCount = Number.isInteger(normalizedCandidateCount)
    ? Math.min(
      DEFAULT_PLAYABILITY_OPTIONS.maximumCandidateBoardCount,
      Math.max(DEFAULT_PLAYABILITY_OPTIONS.minimumCandidateBoardCount, normalizedCandidateCount),
    )
    : DEFAULT_PLAYABILITY_OPTIONS.candidateBoardCount;

  const minimumWordCount = Number.isInteger(Number(options.minimumWordCount))
    ? Number(options.minimumWordCount)
    : DEFAULT_PLAYABILITY_OPTIONS.minimumWordCountsBySize[size] ?? 0;
  const minimumLongWordCount = Number.isInteger(Number(options.minimumLongWordCount))
    ? Number(options.minimumLongWordCount)
    : DEFAULT_PLAYABILITY_OPTIONS.minimumLongWordCountsBySize[size] ?? 0;

  return {
    candidateBoardCount,
    minimumWordCount,
    minimumLongWordCount,
    finalistRatio: DEFAULT_PLAYABILITY_OPTIONS.finalistRatio,
  };
}

function getWordSummary(words) {
  return words.reduce(
    (summary, word) => {
      const length = word.length;

      summary.totalScore += scoreWord(word);

      if (length >= 4) {
        summary.fourPlusCount += 1;
      }

      if (length >= 5) {
        summary.fivePlusCount += 1;
      }

      if (length >= 6) {
        summary.longWordCount += 1;
      }

      if (length >= 8) {
        summary.veryLongWordCount += 1;
      }

      return summary;
    },
    {
      totalScore: 0,
      fourPlusCount: 0,
      fivePlusCount: 0,
      longWordCount: 0,
      veryLongWordCount: 0,
    },
  );
}

function getNeighborIndexes(index, size) {
  const row = Math.floor(index / size);
  const column = index % size;
  const neighborIndexes = [];

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

      neighborIndexes.push((neighborRow * size) + neighborColumn);
    }
  }

  return neighborIndexes;
}

function getAdjacencyScore(board, size) {
  let consonantVowelEdges = 0;
  let commonPairEdges = 0;
  let rareTileIsolationPenalty = 0;

  for (let index = 0; index < board.length; index += 1) {
    const tile = normalizeTile(board[index]);
    const tileHasVowel = isVowelTile(tile);
    const neighborIndexes = getNeighborIndexes(index, size);
    let hasUsefulNeighbor = false;

    for (const neighborIndex of neighborIndexes) {
      const neighborTile = normalizeTile(board[neighborIndex]);
      const neighborHasVowel = isVowelTile(neighborTile);
      const isConsonantVowelEdge = tileHasVowel !== neighborHasVowel;
      const isCommonPairEdge = (
        COMMON_TILE_PAIRS.has(`${tile}${neighborTile}`) ||
        COMMON_TILE_PAIRS.has(`${neighborTile}${tile}`)
      );

      if (isConsonantVowelEdge || isCommonPairEdge) {
        hasUsefulNeighbor = true;
      }

      if (neighborIndex <= index) {
        continue;
      }

      if (isConsonantVowelEdge) {
        consonantVowelEdges += 1;
      }

      if (isCommonPairEdge) {
        commonPairEdges += 1;
      }
    }

    if (['J', 'K', 'V', 'X', 'Z'].includes(tile) && !hasUsefulNeighbor) {
      rareTileIsolationPenalty += 1;
    }
  }

  return (consonantVowelEdges * 0.25) + (commonPairEdges * 1.5) - (rareTileIsolationPenalty * 3);
}

function scoreBoardCandidate(board, size, dictionary) {
  const words = findAllWords(board, size, dictionary);
  const wordSummary = getWordSummary(words);

  return {
    board,
    words,
    totalWords: words.length,
    longWordCount: wordSummary.longWordCount,
    score: (
      words.length +
      (wordSummary.fourPlusCount * 1.5) +
      (wordSummary.fivePlusCount * 2.5) +
      (wordSummary.longWordCount * 4) +
      (wordSummary.veryLongWordCount * 8) +
      (wordSummary.totalScore * 0.4) +
      getAdjacencyScore(board, size)
    ),
  };
}

function chooseWeightedFinalist(candidates, finalistRatio) {
  const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
  const finalistCount = Math.max(1, Math.ceil(sortedCandidates.length * finalistRatio));
  const finalists = sortedCandidates.slice(0, finalistCount);
  const minimumScore = finalists[finalists.length - 1].score;
  const weights = finalists.map((candidate) => Math.max(1, candidate.score - minimumScore + 1));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (let index = 0; index < finalists.length; index += 1) {
    randomValue -= weights[index];

    if (randomValue <= 0) {
      return finalists[index];
    }
  }

  return finalists[0];
}

export function generateBoard(size, options = {}) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize) || normalizedSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  const dicePool = createDicePool(normalizedSize, options);
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

export function generatePlayableBoard(size, dictionary, options = {}) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize) || normalizedSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  if (!(dictionary instanceof Set)) {
    return generateBoard(normalizedSize, options);
  }

  const dicePool = createDicePool(normalizedSize, options);
  const constraints = normalizeGenerationConstraints(options);
  const playabilityOptions = normalizePlayabilityOptions(normalizedSize, options);
  const acceptableCandidates = [];
  const fallbackCandidates = [];

  for (let attempt = 0; attempt < playabilityOptions.candidateBoardCount; attempt += 1) {
    const board = rollBoardFromDicePool(dicePool);

    if (!hasAcceptableDistribution(board, normalizedSize, constraints)) {
      continue;
    }

    const candidate = scoreBoardCandidate(board, normalizedSize, dictionary);
    fallbackCandidates.push(candidate);

    if (
      candidate.totalWords >= playabilityOptions.minimumWordCount &&
      candidate.longWordCount >= playabilityOptions.minimumLongWordCount
    ) {
      acceptableCandidates.push(candidate);
    }
  }

  const candidates = acceptableCandidates.length > 0 ? acceptableCandidates : fallbackCandidates;

  if (candidates.length === 0) {
    return generateBoard(normalizedSize, options);
  }

  return chooseWeightedFinalist(candidates, playabilityOptions.finalistRatio).board;
}
