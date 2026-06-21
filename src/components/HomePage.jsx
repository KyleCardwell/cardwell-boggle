import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { createGame, getPlayersByGameId, joinGame } from '../supabase/gameApi'
import { setPlayer } from '../store/playerSlice'
import { setGame, setPlayers } from '../store/gameSlice'

const BOARD_SIZES = [3, 4, 5, 6, 7, 8, 9, 10]
const DEFAULT_DURATION_SECONDS = 180

function HomePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [newBoardSize, setNewBoardSize] = useState(4)
  const [newDisplayName, setNewDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      const createdGame = await createGame(newBoardSize, DEFAULT_DURATION_SECONDS)
      const { game, player } = await joinGame(createdGame.game_code, displayName)
      const players = await getPlayersByGameId(game.id)

      dispatch(setGame(game))
      dispatch(setPlayers(players))
      dispatch(setPlayer(player))

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

      navigate(`/game/${game.game_code}`)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to join game.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Cardwell Boggle</h1>

      {errorMessage ? (
        <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{errorMessage}</p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>New Game</h2>
          <form onSubmit={handleCreateGame} style={{ display: 'grid', gap: '0.75rem' }}>
            <label htmlFor="new-board-size">Board Size</label>
            <select
              id="new-board-size"
              value={newBoardSize}
              onChange={(event) => setNewBoardSize(Number(event.target.value))}
            >
              {BOARD_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} x {size}
                </option>
              ))}
            </select>

            <label htmlFor="new-display-name">Display Name</label>
            <input
              id="new-display-name"
              value={newDisplayName}
              onChange={(event) => setNewDisplayName(event.target.value)}
              placeholder="Enter your name"
              maxLength={30}
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create & Join'}
            </button>
          </form>
        </section>

        <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Join Game</h2>
          <form onSubmit={handleJoinGame} style={{ display: 'grid', gap: '0.75rem' }}>
            <label htmlFor="join-code">Game Code</label>
            <input
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCD"
              maxLength={4}
            />

            <label htmlFor="join-display-name">Display Name</label>
            <input
              id="join-display-name"
              value={joinDisplayName}
              onChange={(event) => setJoinDisplayName(event.target.value)}
              placeholder="Enter your name"
              maxLength={30}
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Joining...' : 'Join Game'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

export default HomePage
