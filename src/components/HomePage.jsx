import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createGame, getPlayersByGameId, joinGame } from '../supabase/gameApi'
import { setPlayer } from '../store/playerSlice'
import { setGame, setPlayers } from '../store/gameSlice'
import { getMostRecentStoredPlayerSession, savePlayerSession } from '../utils/playerSession'
import {
  BOARD_SIZES,
  DEFAULT_DURATION_SECONDS,
  DURATION_OPTIONS,
  formatDurationLabel,
} from '../constants/gameSettings'

function HomePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [newBoardSize, setNewBoardSize] = useState(4)
  const [newDurationSeconds, setNewDurationSeconds] = useState(DEFAULT_DURATION_SECONDS)
  const [newDisplayName, setNewDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [activeForm, setActiveForm] = useState('join')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentSession] = useState(() => getMostRecentStoredPlayerSession())

  const handleRejoinExistingGame = () => {
    if (!recentSession?.gameCode) {
      return
    }

    setErrorMessage('')
    navigate(`/game/${recentSession.gameCode}`)
  }

  const handleCreateGame = async (event) => {
    event.preventDefault()
    const displayName = newDisplayName.trim()

    if (!displayName) {
      setErrorMessage('Please enter a display name to create a game.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const createdGame = await createGame(newBoardSize, newDurationSeconds)
      const { game, player } = await joinGame(createdGame.game_code, displayName)
      const players = await getPlayersByGameId(game.id)

      dispatch(setGame(game))
      dispatch(setPlayers(players))
      dispatch(setPlayer(player))
      savePlayerSession(game.game_code, player)

      navigate(`/game/${game.game_code}`)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to create game.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinGame = async (event) => {
    event.preventDefault()

    const displayName = joinDisplayName.trim()
    const gameCode = joinCode.trim().toUpperCase()

    if (!displayName) {
      setErrorMessage('Please enter a display name to join a game.')
      return
    }

    if (gameCode.length !== 4) {
      setErrorMessage('Please enter a 4-letter game code.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const { game, player } = await joinGame(gameCode, displayName)
      const players = await getPlayersByGameId(game.id)

      dispatch(setGame(game))
      dispatch(setPlayers(players))
      dispatch(setPlayer(player))
      savePlayerSession(game.game_code, player)

      navigate(`/game/${game.game_code}`)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to join game.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 text-ui-text">
      <h1 className="mb-6">Cardwell Boggle</h1>

      {errorMessage ? (
        <p className="mb-4 text-ui-danger">{errorMessage}</p>
      ) : null}

      <div className="mx-auto mb-4 flex w-full max-w-md rounded-lg border border-ui-border bg-ui-surface p-1">
        <button
          type="button"
          onClick={() => {
            setActiveForm('join')
            setErrorMessage('')
          }}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeForm === 'join'
              ? 'bg-ui-surface-alt text-ui-text'
              : 'text-ui-muted hover:text-ui-text'
          }`}
        >
          Join Game
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveForm('new')
            setErrorMessage('')
          }}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeForm === 'new'
              ? 'bg-ui-surface-alt text-ui-text'
              : 'text-ui-muted hover:text-ui-text'
          }`}
        >
          New Game
        </button>
      </div>

      {activeForm === 'new' ? (
        <section className="mx-auto max-w-md rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
          <h2 className="mt-0">New Game</h2>
          <form onSubmit={handleCreateGame} className="grid gap-3">
            <label htmlFor="new-board-size" className="text-sm font-medium text-ui-muted">
              Board Size
            </label>
            <select
              id="new-board-size"
              value={newBoardSize}
              onChange={(event) => setNewBoardSize(Number(event.target.value))}
              className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text"
            >
              {BOARD_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} x {size}
                </option>
              ))}
            </select>

            <label htmlFor="new-round-time" className="text-sm font-medium text-ui-muted">
              Round Time
            </label>
            <select
              id="new-round-time"
              value={newDurationSeconds}
              onChange={(event) => setNewDurationSeconds(Number(event.target.value))}
              className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text"
            >
              {DURATION_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {formatDurationLabel(seconds)}
                </option>
              ))}
            </select>

            <label htmlFor="new-display-name" className="text-sm font-medium text-ui-muted">
              Display Name
            </label>
            <input
              id="new-display-name"
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
              placeholder="Enter your name"
              maxLength={30}
              className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text placeholder:text-ui-muted"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-emerald-600 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create & Join'}
            </button>
          </form>
        </section>
      ) : (
        <section className="mx-auto max-w-md rounded-xl border border-ui-border bg-ui-surface p-4 text-ui-text">
          <h2 className="mt-0">Join Game</h2>
          <form onSubmit={handleJoinGame} className="grid gap-3">
            <label htmlFor="join-code" className="text-sm font-medium text-ui-muted">
              Game Code
            </label>
            <input
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCD"
              maxLength={4}
              className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text placeholder:text-ui-muted"
            />

            <label htmlFor="join-display-name" className="text-sm font-medium text-ui-muted">
              Display Name
            </label>
            <input
              id="join-display-name"
              value={joinDisplayName}
              onChange={(event) => setJoinDisplayName(event.target.value)}
              placeholder="Enter your name"
              maxLength={30}
              className="rounded-md border border-ui-input-border bg-ui-input-bg px-3 py-2 text-ui-input-text placeholder:text-ui-muted"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Joining...' : 'Join Game'}
            </button>

            {recentSession?.gameCode ? (
              <div className="pt-2 text-center border-t border-ui-border mt-3 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ui-muted">
                  OR Rejoin existing game
                </p>
                <button
                  type="button"
                  onClick={handleRejoinExistingGame}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-ui-input-border px-3 py-2 text-sm font-medium text-ui-text transition-colors hover:bg-ui-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Rejoin {recentSession.gameCode}
                </button>
              </div>
            ) : null}
          </form>
        </section>
      )}
    </main>
  )
}

export default HomePage
