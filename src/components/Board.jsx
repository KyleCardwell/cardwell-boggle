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
                  ? 'grid aspect-square place-items-center rounded-[10px] border-2 border-sky-600 bg-sky-100 text-[clamp(0.8rem,2.6vw,1.2rem)] font-bold uppercase'
                  : 'grid aspect-square place-items-center rounded-[10px] border border-slate-400 bg-slate-50 text-[clamp(0.8rem,2.6vw,1.2rem)] font-bold uppercase'
              }
            >
              {normalizedTile}
            </div>
          )
        })}
      </div>

      {isCountdown && countdownRemaining > 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[clamp(1.8rem,5.6vw,3.1rem)] font-extrabold text-slate-900 [font-variant-numeric:tabular-nums]">
          {countdownRemaining}
        </div>
      ) : null}
    </section>
  )
}

export default Board
