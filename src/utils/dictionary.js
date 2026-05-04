let dictionarySet = null;
let dictionaryLoadPromise = null;

export async function loadDictionary() {
  if (dictionarySet) {
    return dictionarySet;
  }

  if (!dictionaryLoadPromise) {
    dictionaryLoadPromise = fetch('/dictionary.txt')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load dictionary: ${response.status}`);
        }

        return response.text();
      })
      .then((text) => {
        dictionarySet = new Set(
          text
            .split(/\r?\n/)
            .map((word) => word.trim().toLowerCase())
            .filter((word) => word.length >= 3),
        );

        return dictionarySet;
      })
      .catch((error) => {
        dictionaryLoadPromise = null;
        throw error;
      });
  }

  return dictionaryLoadPromise;
}

export function isValidWord(word) {
  if (!dictionarySet) {
    return false;
  }

  return dictionarySet.has(word.trim().toLowerCase());
}
