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

// Weighted shuffle — higher play_count gets slight priority, recent tracks boosted
function weightedShuffle(arr) {
  const now = Date.now()
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000

  const scored = arr.map((t) => {
    // Play count weight: log scale so popular tracks get a nudge, not domination
    const playWeight = Math.log10(Math.max(t.play_count || 1, 1))

    // Freshness boost: tracks from last 90 days get 2x weight
    const uploadedAt = t.release_date ? new Date(t.release_date).getTime()
      : t.created_at ? new Date(t.created_at).getTime() : 0
    const freshness = (now - uploadedAt) < NINETY_DAYS ? 2 : 1

    const score = playWeight * freshness * (0.5 + Math.random())
    return { track: t, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.track)
}

export const VIBES = {
  lofi: {
    label: 'lo-fi',
    queries: ['lofi', 'lofi beats', 'lofi hip hop', 'lofi chill'],
    maxDuration: 6 * 60,
  },
  dnb: {
    label: 'dnb',
    queries: ['drum and bass', 'liquid dnb', 'dnb', 'jungle drum bass'],
    maxDuration: 8 * 60,
  },
  bass: {
    label: 'bass',
    queries: ['dubstep', 'bass music', 'trap', 'bass heavy'],
    maxDuration: 7 * 60,
  },
}

export async function fetchTracks({ vibe = 'lofi', limit = 50, offset = 0 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi
  const query = config.queries[Math.floor(Math.random() * config.queries.length)]
  const sorts = ['popular', 'recent', 'relevant']
  const sort = sorts[Math.floor(Math.random() * sorts.length)]

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
  const filtered = (json.data || []).filter(
    (t) => t.duration <= config.maxDuration && !blocked.has(t.id)
  )
  return weightedShuffle(filtered)
}

export function getStreamUrl(trackId) {
  return `${API_HOST}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export function getAudiusProfileUrl(handle) {
  return `https://audius.co/${handle}`
}
