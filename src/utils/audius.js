const API_HOST = 'https://api.audius.co'
const APP_NAME = 'drift'

// Blocked track IDs persisted in localStorage
const BLOCKED_KEY = 'drift:blocked'

export function getBlockedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BLOCKED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function blockTrack(trackId) {
  const blocked = getBlockedIds()
  blocked.add(trackId)
  localStorage.setItem(BLOCKED_KEY, JSON.stringify([...blocked]))
}

// Fisher-Yates shuffle for true randomness
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const VIBES = {
  lofi: {
    label: 'lo-fi',
    queries: ['lofi', 'lofi beats', 'lofi hip hop', 'lofi chill'],
    maxDuration: 6 * 60,
    genres: ['Lo-Fi'],
  },
  dnb: {
    label: 'dnb',
    queries: ['drum and bass', 'liquid dnb', 'dnb'],
    maxDuration: 6 * 60,
    genres: ['Drum & Bass'],
  },
  bass: {
    label: 'bass',
    queries: ['dubstep', 'bass music', 'trap', 'bass heavy'],
    maxDuration: 6 * 60,
    genres: ['Dubstep', 'Trap'],
  },
}

// Cycle through queries per vibe
const queryIndexes = {}

export async function fetchTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi

  // Cycle through queries in shuffled order for variety
  if (!(vibe in queryIndexes)) queryIndexes[vibe] = 0
  const idx = queryIndexes[vibe]
  queryIndexes[vibe]++

  // Pick query by cycling, pick sort randomly
  const query = config.queries[idx % config.queries.length]
  // Favor 'relevant' to get a mix; 'popular' and 'recent' less often
  const sorts = ['relevant', 'relevant', 'relevant', 'popular', 'recent']
  const sort = sorts[Math.floor(Math.random() * sorts.length)]

  // Random offset (0-100) to get different pages of results
  const offset = Math.floor(Math.random() * 3) * 25

  const params = new URLSearchParams({
    query,
    sort_method: sort,
    limit: String(limit),
    offset: String(offset),
    app_name: APP_NAME,
  })

  const res = await fetch(`${API_HOST}/v1/tracks/search?${params}`)
  if (!res.ok) throw new Error(`Audius search failed: ${res.status}`)

  const json = await res.json()
  const blocked = getBlockedIds()
  const allowedGenres = config.genres ? new Set(config.genres) : null
  const filtered = (json.data || []).filter(
    (t) => t.duration <= config.maxDuration
      && !blocked.has(t.id)
      && (!allowedGenres || allowedGenres.has(t.genre))
  )
  return shuffle(filtered)
}

export function getStreamUrl(trackId) {
  return `${API_HOST}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export function getAudiusProfileUrl(handle) {
  return `https://audius.co/${handle}`
}
