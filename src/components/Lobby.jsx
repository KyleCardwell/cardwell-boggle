import { useState } from 'react'
import {
  BOARD_SIZES,
  DURATION_OPTIONS,
  formatDurationLabel,
} from '../constants/gameSettings'
import ReadyStatusPanel from './ReadyStatusPanel'
import Scoreboard from './Scoreboard'

function Lobby({
  gameCode,
  players,
  roundHistory = [],
  canStart,
  boardSize,
  durationSeconds,
  currentPlayerId,
  isHost,
  isSavingSettings,
  settingsError,
  isReadyPending,
  readyError,
  onStartGame,
  onSaveSettings,
  onToggleReady,
}) {
  const [selectedBoardSize, setSelectedBoardSize] = useState(boardSize)
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState(durationSeconds)
  const showReadyStatus = Boolean(onToggleReady) || players.some((player) => player.ready_at ?? player.readyAt)

  const hasUnsavedChanges =
    Number(selectedBoardSize) !== Number(boardSize) ||
    Number(selectedDurationSeconds) !== Number(durationSeconds)

  const handleSettingsSubmit = async (event) => {
    event.preventDefault()

    if (!isHost || !onSaveSettings) {
      return
    }

    await onSaveSettings({
      boardSize: Number(selectedBoardSize),
      durationSeconds: Number(selectedDurationSeconds),
    })
  }

  return (
    <section className="rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
      <p className="m-0 text-[0.95rem] text-ui-muted">Share code</p>
      <h2 className="mb-4 mt-1 tracking-[0.15em]">{gameCode || '----'}</h2>

      <div className="mb-4 grid gap-1 rounded-md border border-ui-border bg-ui-input-bg p-3 text-sm">
        <p className="m-0">
          <span className="text-ui-muted">Board:</span> {boardSize} x {boardSize}
        </p>
        <p className="m-0">
          <span className="text-ui-muted">Round time:</span> {formatDurationLabel(durationSeconds)}
        </p>
      </div>

            {isHost ? (
        <form onSubmit={handleSettingsSubmit} className="mb-4 grid gap-3 rounded-md border border-ui-border p-3">
          <h3 className="m-0">Game Settings</h3>

          <label htmlFor="lobby-board-size" className="text-sm font-medium text-ui-muted">
            Board Size
          </label>
          <select
            id="lobby-board-size"
            value={selectedBoardSize}
            onChange={(event) => setSelectedBoardSize(Number(event.target.value))}
            disabled={isSavingSettings}
            className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            {BOARD_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} x {size}
              </option>
            ))}
          </select>

          <label htmlFor="lobby-round-time" className="text-sm font-medium text-ui-muted">
            Round Time
          </label>
          <select
            id="lobby-round-time"
            value={selectedDurationSeconds}
            onChange={(event) => setSelectedDurationSeconds(Number(event.target.value))}
            disabled={isSavingSettings}
            className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            {DURATION_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatDurationLabel(seconds)}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={isSavingSettings || !hasUnsavedChanges}
            className="justify-self-start rounded-md border border-ui-border bg-ui-surface px-3 py-2 font-medium text-ui-text transition-colors hover:bg-ui-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingSettings ? 'Saving settings...' : 'Save Settings'}
          </button>

          {settingsError ? <p className="m-0 text-sm text-ui-danger">{settingsError}</p> : null}
        </form>
      ) : null}

      <div className="mb-4 grid gap-3">
        {canStart ? (
          <button
            type="button"
            onClick={onStartGame}
            className="justify-self-start rounded-md bg-ui-primary px-3 py-2 font-medium text-ui-input-text transition-colors hover:bg-ui-primary-hover"
          >
            Start Game
          </button>
        ) : null}

        {showReadyStatus ? (
          <ReadyStatusPanel
            players={players}
            currentPlayerId={currentPlayerId}
            isReadyPending={isReadyPending}
            readyError={readyError}
            onToggleReady={onToggleReady}
          />
        ) : null}
      </div>

      {roundHistory.length > 0 ? <Scoreboard roundHistory={roundHistory} players={players} /> : null}

      
    </section>
  )
}

export default Lobby
