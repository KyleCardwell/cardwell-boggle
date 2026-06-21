function Board({ board, size, status, countdownRemaining }) {
  if (!Array.isArray(board) || !Number.isInteger(size) || size <= 0) {
    return null
  }

  const isCountdown = status === 'countdown'

  return (
    <section className="relative">
      <div
        className={
          isCountdown
            ? 'grid gap-[0.45rem] blur-[4px] opacity-[0.58] transition-[filter,opacity] duration-200 ease-in-out'
            : 'grid gap-[0.45rem] transition-[filter,opacity] duration-200 ease-in-out'
        }
        style={{ gridTemplateColumns: `repeat(${size}, minmax(2.25rem, 1fr))` }}
      >
        {board.map((tile, index) => {
          const normalizedTile = String(tile ?? '').toUpperCase()
          const isSpecialTile = normalizedTile === 'QU'

          return (
            <div
              key={`${normalizedTile}-${index}`}
              className={
                isSpecialTile
                  ? 'grid aspect-square place-items-center rounded-[10px] border-2 border-ui-teal bg-ui-die text-[clamp(0.8rem,2.6vw,1.2rem)] font-bold uppercase text-ui-die-text'
                  : 'grid aspect-square place-items-center rounded-[10px] border border-ui-border bg-ui-die text-[clamp(0.8rem,2.6vw,1.2rem)] font-bold uppercase text-ui-die-text'
              }
            >
              {normalizedTile}
            </div>
          )
        })}
      </div>

      {isCountdown && countdownRemaining > 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[clamp(1.8rem,5.6vw,3.1rem)] font-extrabold text-ui-text [font-variant-numeric:tabular-nums]">
          {countdownRemaining}
        </div>
      ) : null}
    </section>
  )
}

export default Board
