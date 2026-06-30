const STORAGE_KEY = 'cardwell-boggle.player-sessions'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeGameCode(gameCode) {
  return String(gameCode ?? '').trim().toUpperCase()
}

function normalizePlayerSession(player) {
  const playerId = String(player?.playerId ?? player?.id ?? '').trim()

  if (!playerId) {
    return null
  }

  return {
    playerId,
    displayName: String(player?.displayName ?? player?.display_name ?? '').trim(),
  }
}

function readSessions() {
  const storage = getStorage()

  if (!storage) {
    return {}
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY)

    if (!rawValue) {
      return {}
    }

    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeSessions(sessions) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // ignore storage errors
  }
}

export function getStoredPlayerSession(gameCode) {
  const normalizedGameCode = normalizeGameCode(gameCode)

  if (!normalizedGameCode) {
    return null
  }

  const sessions = readSessions()
  return normalizePlayerSession(sessions[normalizedGameCode])
}

export function savePlayerSession(gameCode, player) {
  const normalizedGameCode = normalizeGameCode(gameCode)
  const normalizedPlayerSession = normalizePlayerSession(player)

  if (!normalizedGameCode || !normalizedPlayerSession) {
    return
  }

  const sessions = readSessions()
  writeSessions({
    ...sessions,
    [normalizedGameCode]: normalizedPlayerSession,
  })
}

export function clearStoredPlayerSession(gameCode) {
  const normalizedGameCode = normalizeGameCode(gameCode)

  if (!normalizedGameCode) {
    return
  }

  const sessions = readSessions()

  if (!Object.prototype.hasOwnProperty.call(sessions, normalizedGameCode)) {
    return
  }

  delete sessions[normalizedGameCode]
  writeSessions(sessions)
}
