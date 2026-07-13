export const BOARD_SIZES = [4, 5, 6, 7, 8]
export const DURATION_OPTIONS = [60, 90, 120, 150, 180, 210, 240, 270, 300]
export const DEFAULT_DURATION_SECONDS = 180

export function formatDurationLabel(durationSeconds) {
  const minutes = Math.floor(durationSeconds / 60)
  const remainder = durationSeconds % 60

  if (remainder === 0) {
    return `${minutes} min`
  }

  return `${minutes} min ${remainder}s`
}
