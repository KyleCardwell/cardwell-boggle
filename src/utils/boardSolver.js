const trieCache = new WeakMap();

function createTrieNode() {
  return {
    children: new Map(),
    isWord: false,
  };
}

function buildTrie(dictionary) {
  if (!(dictionary instanceof Set)) {
    throw new Error('Dictionary must be a Set of words.');
  }

  const cachedTrie = trieCache.get(dictionary);
  if (cachedTrie) {
    return cachedTrie;
  }

  const root = createTrieNode();

  for (const rawWord of dictionary) {
    if (typeof rawWord !== 'string') {
      continue;
    }

    const word = rawWord.trim().toLowerCase();

    if (word.length < 3) {
      continue;
    }

    let node = root;

    for (const character of word) {
      if (!node.children.has(character)) {
        node.children.set(character, createTrieNode());
      }

      node = node.children.get(character);
    }

    node.isWord = true;
  }

  trieCache.set(dictionary, root);

  return root;
}

function buildNeighbors(size) {
  const neighbors = Array.from({ length: size * size }, () => []);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const index = row * size + col;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          if (rowOffset === 0 && colOffset === 0) {
            continue;
          }

          const nextRow = row + rowOffset;
          const nextCol = col + colOffset;

          if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) {
            continue;
          }

          neighbors[index].push(nextRow * size + nextCol);
        }
      }
    }
  }

  return neighbors;
}

function advanceTrie(node, tileValue) {
  let currentNode = node;

  for (const character of tileValue) {
    const nextNode = currentNode.children.get(character);

    if (!nextNode) {
      return null;
    }

    currentNode = nextNode;
  }

  return currentNode;
}

function normalizeTile(tile) {
  return String(tile ?? '').trim().toLowerCase();
}

function getMinimumWordLength(size) {
  return Number(size) === 4 ? 3 : 4;
}

export function findAllWordsWithPaths(board, size, dictionary) {
  const normalizedSize = Number(size);

  if (!Number.isInteger(normalizedSize) || normalizedSize <= 0) {
    throw new Error('Board size must be a positive integer.');
  }

  if (!Array.isArray(board)) {
    throw new Error('Board must be an array of tile strings.');
  }

  const totalCells = normalizedSize * normalizedSize;
  if (board.length !== totalCells) {
    throw new Error('Board length must equal size * size.');
  }

  const trieRoot = buildTrie(dictionary);
  const neighbors = buildNeighbors(normalizedSize);
  const visited = Array(totalCells).fill(false);
  const foundWords = new Set();
  const wordPathByWord = {};
  const currentPath = [];
  const minimumWordLength = getMinimumWordLength(normalizedSize);

  function dfs(index, trieNode, currentWord) {
    if (visited[index]) {
      return;
    }

    const tileValue = normalizeTile(board[index]);
    if (!tileValue) {
      return;
    }

    const nextTrieNode = advanceTrie(trieNode, tileValue);
    if (!nextTrieNode) {
      return;
    }

    const nextWord = `${currentWord}${tileValue}`;
    visited[index] = true;
    currentPath.push(index);

    if (nextTrieNode.isWord && nextWord.length >= minimumWordLength && !foundWords.has(nextWord)) {
      foundWords.add(nextWord);
      wordPathByWord[nextWord] = [...currentPath];
    }

    for (const neighborIndex of neighbors[index]) {
      if (!visited[neighborIndex]) {
        dfs(neighborIndex, nextTrieNode, nextWord);
      }
    }

    currentPath.pop();
    visited[index] = false;
  }

  for (let index = 0; index < totalCells; index += 1) {
    dfs(index, trieRoot, '');
  }

  const allWords = Array.from(foundWords).sort();

  return {
    allWords,
    wordPathByWord,
  };
}

export function findAllWords(board, size, dictionary) {
  return findAllWordsWithPaths(board, size, dictionary).allWords;
}
