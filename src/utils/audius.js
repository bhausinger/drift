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

export async function fetchChill({ limit = 50, offset = 0 } = {}) {
  // Rotate through queries and sort methods for variety between sessions
  const queries = ['lofi', 'lofi beats', 'lofi hip hop', 'lofi chill']
  const query = queries[Math.floor(Math.random() * queries.length)]
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
  const MAX_DURATION = 6 * 60 // 6 minutes in seconds
  const filtered = (json.data || []).filter((t) => t.duration <= MAX_DURATION)
  return shuffle(filtered)
}

export function getStreamUrl(trackId) {
  return `${API_HOST}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export function getAudiusProfileUrl(handle) {
  return `https://audius.co/${handle}`
}
