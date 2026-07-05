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
  const parsedLastSeenAt = Number(player?.lastSeenAt ?? player?.last_seen_at ?? 0)
  const lastSeenAt = Number.isFinite(parsedLastSeenAt) && parsedLastSeenAt > 0 ? parsedLastSeenAt : null

  if (!playerId) {
    return null
  }

  return {
    playerId,
    displayName: String(player?.displayName ?? player?.display_name ?? '').trim(),
    lastSeenAt,
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
    [normalizedGameCode]: {
      ...normalizedPlayerSession,
      lastSeenAt: Date.now(),
    },
  })
}

export function getMostRecentStoredPlayerSession() {
  const sessions = readSessions()
  const normalizedSessions = Object.entries(sessions)
    .map(([gameCode, session]) => {
      const normalizedSession = normalizePlayerSession(session)

      if (!normalizedSession) {
        return null
      }

      return {
        gameCode: normalizeGameCode(gameCode),
        ...normalizedSession,
      }
    })
    .filter((session) => Boolean(session?.gameCode))

  if (!normalizedSessions.length) {
    return null
  }

  normalizedSessions.sort((a, b) => {
    const aLastSeenAt = a.lastSeenAt ?? 0
    const bLastSeenAt = b.lastSeenAt ?? 0

    if (aLastSeenAt !== bLastSeenAt) {
      return bLastSeenAt - aLastSeenAt
    }

    return a.gameCode.localeCompare(b.gameCode)
  })

  return normalizedSessions[0]
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
