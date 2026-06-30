function Board({
  board,
  size,
  status,
  countdownRemaining,
  highlightedPath = [],
  isCompact = false,
  gridGapOverride,
}) {
  if (!Array.isArray(board) || !Number.isInteger(size) || size <= 0) {
    return null
  }

  const isCountdown = status === 'countdown'
  const isFinished = status === 'finished'
  const highlightedTileIndexes = new Set(Array.isArray(highlightedPath) ? highlightedPath : [])
  const tileMinSize = isCompact ? '1.15rem' : '2.25rem'
  const gridGap = gridGapOverride ?? (isCompact ? '0.2rem' : '0.45rem')
  const tileFontSize =
    size <= 3
      ? 'clamp(1.35rem, 6.2vw, 2.7rem)'
      : size === 4
        ? 'clamp(1.1rem, 4.8vw, 2rem)'
        : size === 5
          ? 'clamp(1rem, 3.8vw, 1.55rem)'
          : 'clamp(0.9rem, 2.8vw, 1.25rem)'

  return (
    <section className="relative w-full">
      <div
        className={
          isCountdown
            ? 'grid w-full transition-[filter,opacity] duration-200 ease-in-out'
            : 'grid w-full transition-[filter,opacity] duration-200 ease-in-out'
        }
        style={{
          gap: gridGap,
          gridTemplateColumns: `repeat(${size}, minmax(${tileMinSize}, 1fr))`,
        }}
      >
        {board.map((tile, index) => {
          const normalizedTile = String(tile ?? '').toUpperCase()
          const isSpecialTile = normalizedTile === 'QU'
          const isHighlighted = highlightedTileIndexes.has(index)

          return (
            <div
              key={`${normalizedTile}-${index}`}
              data-tile-index={index}
              className={
                isHighlighted
                  ? 'grid aspect-square place-items-center rounded-[10px] border-2 border-ui-teal bg-ui-teal/20 font-bold uppercase text-ui-text shadow-[0_0_0_2px_rgba(20,184,166,0.28)] transition-colors duration-150 ease-out'
                  : isFinished
                    ? 'grid aspect-square place-items-center rounded-[10px] border border-red-400/40 bg-red-900/35 font-bold uppercase text-white'
                    : isSpecialTile
                      ? 'grid aspect-square place-items-center rounded-[10px] border-2 border-ui-teal bg-ui-die font-bold uppercase text-ui-die-text'
                      : 'grid aspect-square place-items-center rounded-[10px] border border-ui-border bg-ui-die font-bold uppercase text-ui-die-text'
              }
              style={{ fontSize: tileFontSize }}
            >
              <span
                className={
                  isCountdown
                    ? 'blur-[15px] opacity-[0.45] transition-[filter,opacity] duration-200 ease-in-out'
                    : 'transition-[filter,opacity] duration-200 ease-in-out'
                }
              >
                {normalizedTile}
              </span>
            </div>
          )
        })}
      </div>

      {isCountdown && countdownRemaining > 0 ? (
        <div
          className={
            isCompact
              ? 'pointer-events-none absolute inset-0 grid place-items-center text-[clamp(1.4rem,4.4vw,2.45rem)] font-extrabold text-ui-text [font-variant-numeric:tabular-nums]'
              : 'pointer-events-none absolute inset-0 grid place-items-center text-[clamp(1.8rem,5.6vw,3.1rem)] font-extrabold text-ui-text [font-variant-numeric:tabular-nums]'
          }
        >
          {countdownRemaining}
        </div>
      ) : null}
    </section>
  )
}

export default Board
