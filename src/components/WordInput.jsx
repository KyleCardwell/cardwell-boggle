import { useMemo, useState } from 'react'
import { getWordText, getWordTexts } from '../utils/roundWords'
import { canConstructWord, getMinimumWordLength } from '../utils/wordValidation'

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
  const [isDuplicateWarning, setIsDuplicateWarning] = useState(false)
  const minimumWordLength = getMinimumWordLength(boardSize)

  const displayWords = useMemo(() => getWordTexts(wordsFound), [wordsFound])
  const wordsSet = useMemo(() => new Set(displayWords), [displayWords])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (status !== 'playing') {
      return
    }

    const submittedValue = value
    const normalizedWord = submittedValue.trim().toLowerCase()
    setValue('')

    if (normalizedWord.length < minimumWordLength) {
      setIsDuplicateWarning(false)
      setErrorMessage(`Word must be at least ${minimumWordLength} letters.`)
      return
    }

    if (!dictionary?.has(normalizedWord)) {
      setIsDuplicateWarning(false)
      setErrorMessage('Word is not in dictionary.')
      return
    }

    if (wordsSet.has(normalizedWord)) {
      setIsDuplicateWarning(true)
      setErrorMessage('You already found that word.')
      return
    }

    if (!canConstructWord(board, boardSize, normalizedWord)) {
      setIsDuplicateWarning(false)
      setErrorMessage('Word is not constructable from this board.')
      return
    }

    try {
      await onSubmitWord(normalizedWord)
      setValue('')
      setIsDuplicateWarning(false)
      setErrorMessage('')
    } catch (error) {
      setIsDuplicateWarning(false)
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

      {errorMessage ? (
        <p className={`mt-2 ${isDuplicateWarning ? 'text-amber-400' : 'text-ui-danger'}`}>
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {wordsFound.map((word) => {
          const displayWord = getWordText(word)

          return (
            <button
              key={displayWord}
              type="button"
              onClick={() => onRemoveWord(word)}
              disabled={disabled}
              className="max-w-full truncate rounded-full border border-ui-input-border bg-ui-input-bg px-2.5 py-1 text-sm text-ui-input-text disabled:cursor-not-allowed disabled:opacity-60"
              title="Remove word"
            >
              {displayWord}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default WordInput
