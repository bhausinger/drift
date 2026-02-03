const API_HOST = 'https://api.audius.co'
const APP_NAME = 'drift'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
  const filtered = (json.data || []).filter((t) => t.duration <= config.maxDuration)
  return shuffle(filtered)
}

export function getStreamUrl(trackId) {
  return `${API_HOST}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export function getAudiusProfileUrl(handle) {
  return `https://audius.co/${handle}`
}
