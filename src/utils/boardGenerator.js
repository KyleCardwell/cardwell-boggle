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

export function generateBoard(size, options = {}) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize) || normalizedSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  const totalTiles = normalizedSize * normalizedSize;
  const tileWeights = buildTileWeights(options);
  const dicePool = buildDicePool(totalTiles, tileWeights);

  fisherYatesShuffle(dicePool);

  const board = dicePool.map((die) => {
    const faceIndex = Math.floor(Math.random() * 6);
    return die[faceIndex];
  });

  return board;
}
