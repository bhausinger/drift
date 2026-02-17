const API_HOST = 'https://api.audius.co'
const APP_NAME = 'drift'

// Audius image CDN nodes — fallback when primary node images fail to load
const IMAGE_NODES = [
  'https://creatornode2.audius.co',
  'https://creatornode3.audius.co',
  'https://blockdaemon-audius-content-06.bdnodes.net',
  'https://blockdaemon-audius-content-07.bdnodes.net',
  'https://audius-content-14.cultur3stake.com',
  'https://cn1.stuffisup.com',
]

// Try to fix a broken image URL by swapping the node
export function getImageFallback(failedUrl) {
  if (!failedUrl) return null
  try {
    const url = new URL(failedUrl)
    const path = url.pathname // e.g. /content/.../150x150.jpg
    // Try each fallback node
    for (const node of IMAGE_NODES) {
      const nodeUrl = new URL(node)
      if (nodeUrl.host !== url.host) {
        return `${node}${path}`
      }
    }
  } catch {
    // Not a valid URL
  }
  return null
}

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

// Blocked artist handles persisted in localStorage
const BLOCKED_ARTISTS_KEY = 'drift:blocked-artists'

export function getBlockedArtists() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BLOCKED_ARTISTS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function blockArtist(handle) {
  const blocked = getBlockedArtists()
  blocked.add(handle)
  localStorage.setItem(BLOCKED_ARTISTS_KEY, JSON.stringify([...blocked]))
}

export function unblockArtist(handle) {
  const blocked = getBlockedArtists()
  blocked.delete(handle)
  localStorage.setItem(BLOCKED_ARTISTS_KEY, JSON.stringify([...blocked]))
}

// Recently-played track IDs to avoid repeats across sessions
const RECENT_KEY = 'drift:recent'
const MAX_RECENT = 200

export function getRecentlyPlayed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function addRecentlyPlayed(trackId) {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    arr.push(trackId)
    // Keep only the last MAX_RECENT entries
    if (arr.length > MAX_RECENT) arr.splice(0, arr.length - MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
  } catch {
    localStorage.setItem(RECENT_KEY, JSON.stringify([trackId]))
  }
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
    queries: [
      'lofi', 'lofi beats', 'lofi hip hop', 'lofi chill', 'chillhop',
      'study beats', 'lofi jazz', 'lofi ambient', 'chill lofi', 'mellow beats',
      'late night lofi', 'lofi vibes', 'bedroom beats', 'rain lofi', 'coffee shop beats',
    ],
    maxDuration: 6 * 60,
    genres: ['Lo-Fi'],
    apiGenre: 'Lo-Fi',
  },
  dnb: {
    label: 'dnb',
    queries: [
      'drum and bass', 'liquid dnb', 'dnb', 'jungle', 'liquid drum and bass',
      'neurofunk', 'atmospheric dnb', 'rollers', 'minimal dnb', 'deep dnb',
      'liquid bass', 'breakbeat', 'halfstep', 'jump up', 'intelligent dnb',
    ],
    maxDuration: 6 * 60,
    genres: ['Drum & Bass'],
    apiGenre: 'Drum & Bass',
  },
  bass: {
    label: 'bass',
    queries: [
      // Abstract/mood queries that find bass music by vibe, not title
      'heavy', 'dark', 'filthy', 'wobble', 'deep', 'melodic',
      'wave', 'experimental', 'chill', 'hard', 'hybrid',
      // Some genre queries for balance
      'bass music', 'trap', 'future bass', 'riddim',
    ],
    maxDuration: 6 * 60,
    genres: ['Dubstep', 'Trap', 'Future Bass', 'Electronic'],
    // Rotate through these genres on the API side for variety
    apiGenres: ['Trap', 'Future Bass', 'Dubstep', 'Electronic'],
  },
}

// Cycle through queries per vibe
const queryIndexes = {}

// Pick the API genre for a vibe — rotates through apiGenres array if present
function pickApiGenre(config, idx) {
  if (config.apiGenres) return config.apiGenres[idx % config.apiGenres.length]
  return config.apiGenre || null
}

export async function fetchTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi

  // Cycle through queries in shuffled order for variety
  if (!(vibe in queryIndexes)) queryIndexes[vibe] = 0
  const idx = queryIndexes[vibe]
  queryIndexes[vibe]++

  // Pick query by cycling, pick sort randomly
  const query = config.queries[idx % config.queries.length]
  // Mix of sort strategies — 'recent' surfaces newer/lesser-known artists
  const sorts = ['relevant', 'relevant', 'popular', 'recent', 'recent']
  const sort = sorts[Math.floor(Math.random() * sorts.length)]

  // Wider offset range (0–250) for deeper discovery
  const offset = Math.floor(Math.random() * 11) * 25

  const params = new URLSearchParams({
    query,
    sort_method: sort,
    limit: String(limit),
    offset: String(offset),
    app_name: APP_NAME,
  })

  // Rotate API genre for vibes with multiple genres
  const apiGenre = pickApiGenre(config, idx)
  if (apiGenre) params.set('genre', apiGenre)

  const res = await fetch(`${API_HOST}/v1/tracks/search?${params}`)
  if (!res.ok) throw new Error(`Audius search failed: ${res.status}`)

  const json = await res.json()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const recentlyPlayed = getRecentlyPlayed()
  const allowedGenres = config.genres ? new Set(config.genres) : null
  const filtered = (json.data || []).filter(
    (t) => t.duration <= config.maxDuration
      && !blocked.has(t.id)
      && !blockedArtists.has(t.user?.handle)
      && !recentlyPlayed.has(t.id)
      && (!allowedGenres || allowedGenres.has(t.genre))
  )
  return shuffle(filtered)
}

// Radio mode: fetch from multiple queries/sorts in parallel for a much wider pool
// Used by fetchTracks when the first call returns too few results after dedup
export async function fetchRadioTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi
  const queries = config.queries
  const sorts = ['relevant', 'popular', 'recent']

  // Pick 4 random queries across different API genres for variety
  const picks = []
  for (let i = 0; i < 4; i++) {
    const q = queries[Math.floor(Math.random() * queries.length)]
    const s = sorts[Math.floor(Math.random() * sorts.length)]
    const offset = Math.floor(Math.random() * 20) * 25 // 0–475
    const genre = pickApiGenre(config, i)
    picks.push({ q, s, offset, genre })
  }

  const fetches = picks.map(({ q, s, offset, genre }) => {
    const params = new URLSearchParams({
      query: q,
      sort_method: s,
      limit: String(limit),
      offset: String(offset),
      app_name: APP_NAME,
    })
    if (genre) params.set('genre', genre)
    return fetch(`${API_HOST}/v1/tracks/search?${params}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((j) => j.data || [])
      .catch(() => [])
  })

  const pages = await Promise.all(fetches)
  const allTracks = pages.flat()

  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const recentlyPlayed = getRecentlyPlayed()
  const allowedGenres = config.genres ? new Set(config.genres) : null

  const filtered = allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return t.duration <= config.maxDuration
      && !blocked.has(t.id)
      && !blockedArtists.has(t.user?.handle)
      && !recentlyPlayed.has(t.id)
      && (!allowedGenres || allowedGenres.has(t.genre))
  })
  return shuffle(filtered)
}

export const DJ_GENRES = [
  'Deep House', 'Disco', 'Downtempo', 'Drum & Bass', 'Dubstep',
  'Electronic', 'Experimental', 'Future Bass', 'Future House',
  'Hardstyle', 'House', 'Lo-Fi', 'Progressive House',
  'Tech House', 'Techno', 'Trance', 'Trap',
]

export const DJ_KEYS = [
  'C major', 'C minor', 'C# major', 'C# minor',
  'D major', 'D minor', 'D# major', 'D# minor',
  'E major', 'E minor',
  'F major', 'F minor', 'F# major', 'F# minor',
  'G major', 'G minor', 'G# major', 'G# minor',
  'A major', 'A minor', 'A# major', 'A# minor',
  'B major', 'B minor',
  'Db major', 'Db minor', 'Eb major', 'Eb minor',
  'Gb major', 'Gb minor', 'Ab major', 'Ab minor',
  'Bb major', 'Bb minor',
]

export const DJ_MOODS = [
  'Aggressive', 'Cool', 'Defiant', 'Easygoing', 'Empowering', 'Energizing',
  'Excited', 'Fiery', 'Gritty', 'Peaceful', 'Romantic', 'Sensual',
  'Sophisticated', 'Upbeat', 'Yearning',
]

async function fetchDJPage(query, sort, offset, extraParams = {}) {
  const params = new URLSearchParams({
    query,
    sort_method: sort,
    limit: '100',
    offset: String(offset),
    app_name: APP_NAME,
  })
  // Forward API-native params (mood, bpm_min, bpm_max, key)
  // Genre is handled separately since it can be an array
  for (const [k, v] of Object.entries(extraParams)) {
    if (k === 'genres' && Array.isArray(v)) {
      for (const g of v) params.append('genre', g)
    } else if (v) {
      params.set(k, String(v))
    }
  }
  const res = await fetch(`${API_HOST}/v1/full/tracks/search?${params}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

// Genre-specific discovery queries — abstract terms that find tracks *tagged* with the genre
// rather than tracks with the genre name in the title
const GENRE_DISCOVERY = {
  'Deep House': ['groove', 'sunset', 'soulful', 'melodic', 'underground', 'afterhours', 'late night', 'chill', 'warm', 'deep'],
  'Tech House': ['groove', 'minimal', 'warehouse', 'dark', 'rolling', 'hypnotic', 'peak time', 'underground', 'tools', 'driving'],
  'House': ['groove', 'dance', 'feel good', 'classic', 'vocal', 'funky', 'summer', 'party', 'uplifting', 'soulful'],
  'Techno': ['dark', 'industrial', 'warehouse', 'hypnotic', 'driving', 'minimal', 'hard', 'acid', 'underground', 'peak'],
  'Trance': ['euphoric', 'uplifting', 'melodic', 'progressive', 'energy', 'vocal', 'anthem', 'emotional', 'epic', 'journey'],
  'Drum & Bass': ['liquid', 'roller', 'jungle', 'dark', 'atmospheric', 'neurofunk', 'deep', 'minimal', 'vocal', 'dancefloor'],
  'Dubstep': ['heavy', 'dark', 'deep', 'riddim', 'experimental', 'melodic', 'wobble', 'bass', 'filthy', 'chill'],
  'Trap': ['heavy', 'dark', 'hybrid', 'festival', 'chill', 'wave', 'hard', 'melodic', 'bass', 'future'],
  'Lo-Fi': ['chill', 'study', 'beats', 'jazz', 'rain', 'ambient', 'mellow', 'late night', 'bedroom', 'coffee'],
  'Future Bass': ['melodic', 'chill', 'emotional', 'vocal', 'uplifting', 'dreamy', 'bright', 'kawaii', 'future', 'synth'],
  'Future House': ['bounce', 'groove', 'bass', 'vocal', 'melodic', 'festival', 'deep', 'funky', 'bright', 'energy'],
  'Progressive House': ['melodic', 'journey', 'epic', 'emotional', 'driving', 'deep', 'progressive', 'uplifting', 'atmospheric', 'vocal'],
  'Downtempo': ['chill', 'ambient', 'mellow', 'atmospheric', 'dreamy', 'organic', 'ethereal', 'smooth', 'relaxing', 'floating'],
  'Electronic': ['synth', 'experimental', 'ambient', 'beats', 'glitch', 'minimal', 'future', 'dark', 'melodic', 'atmospheric'],
  'Experimental': ['glitch', 'ambient', 'noise', 'abstract', 'weird', 'avant', 'textural', 'drone', 'modular', 'generative'],
  'Disco': ['groove', 'funky', 'boogie', 'classic', 'dance', 'soul', 'party', 'retro', 'nu disco', 'cosmic'],
  'Hardstyle': ['hard', 'euphoric', 'raw', 'kick', 'festival', 'energy', 'anthem', 'reverse bass', 'dark', 'intense'],
}

export async function searchDJTracks({ query = '', genres = [], mood = '', bpmMin = '', bpmMax = '', key = '', sortBias = '' } = {}) {
  // When there's a text query, use only that for API calls (artist/track search)
  // When no text query, use genre-specific discovery queries for variety
  const queries = []
  if (query.trim()) {
    queries.push(query.trim())
  } else if (genres.length > 0) {
    // Use abstract discovery queries per genre so results aren't all title-matches
    for (const g of genres) {
      const pool = GENRE_DISCOVERY[g] || [g]
      // Pick 3 random discovery queries from the pool
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      queries.push(...shuffled.slice(0, 3))
    }
    // Also include one genre name query for balance
    queries.push(genres[0])
  } else {
    queries.push('electronic', 'beats', 'synth', 'dance')
  }

  // Build API-native params for better server-side filtering
  const baseParams = {}
  if (mood) baseParams.mood = mood
  if (bpmMin) baseParams.bpm_min = bpmMin
  if (bpmMax) baseParams.bpm_max = bpmMax
  if (key) baseParams.key = key
  // Pass all genres as array — full API supports multiple genre params
  if (genres.length > 0) baseParams.genres = genres

  // Fire multiple pages in parallel across queries, sorts, and offsets
  const fetches = []
  // When a sort bias is active (e.g. 'recent' for date filtering), weight it heavily
  const sorts = sortBias
    ? [sortBias, sortBias, 'relevant']
    : ['relevant', 'popular', 'recent']
  for (const q of queries.slice(0, 4)) {
    for (const sort of sorts) {
      for (const offset of [0, 100, 200]) {
        fetches.push(fetchDJPage(q, sort, offset, baseParams))
      }
    }
  }

  const pages = await Promise.all(fetches)
  const allTracks = pages.flat()

  // Deduplicate by track ID
  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const genreSet = genres.length > 0 ? new Set(genres) : null
  const searchQuery = query.trim().toLowerCase()

  return allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    if (blocked.has(t.id)) return false
    if (blockedArtists.has(t.user?.handle)) return false
    // Genre filtering: if query matched via tags, keep it even if genre doesn't match
    if (genreSet && !genreSet.has(t.genre)) {
      // Check if the track's tags contain any of the selected genres
      const tags = (t.tags || '').toLowerCase()
      const hasMatchingTag = genres.some((g) => tags.includes(g.toLowerCase()))
      if (!hasMatchingTag) return false
    }
    // Client-side tags matching: if user query appears in tags, include the track
    if (searchQuery && t.tags) {
      const tags = t.tags.toLowerCase()
      if (tags.includes(searchQuery)) return true
    }
    return true
  })
}

// Randomizer — fetch a mix of tracks across random genres and queries
export async function fetchRandomMix() {
  const allGenres = Object.keys(GENRE_DISCOVERY)
  // Pick 4 random genres
  const picked = shuffle(allGenres).slice(0, 4)
  const fetches = []
  const sorts = ['relevant', 'popular', 'recent']

  for (const genre of picked) {
    const pool = GENRE_DISCOVERY[genre]
    const q = pool[Math.floor(Math.random() * pool.length)]
    const sort = sorts[Math.floor(Math.random() * sorts.length)]
    const offset = Math.floor(Math.random() * 4) * 25
    fetches.push(fetchDJPage(q, sort, offset, { genres: [genre] }))
  }

  const pages = await Promise.all(fetches)
  const allTracks = pages.flat()

  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const recentlyPlayed = getRecentlyPlayed()

  const filtered = allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    if (blocked.has(t.id)) return false
    if (blockedArtists.has(t.user?.handle)) return false
    if (recentlyPlayed.has(t.id)) return false
    return true
  })
  return shuffle(filtered)
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getStreamUrl(trackId) {
  return `${API_HOST}/v1/tracks/${trackId}/stream?app_name=${APP_NAME}`
}

export function getAudiusProfileUrl(handle) {
  return `https://audius.co/${handle}`
}

// Draft playlist persisted in localStorage (shared between Player and Playlist Mode)
const DRAFT_KEY = 'drift:playlist-draft'

export function getDraftPlaylist() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveDraftPlaylist(tracks) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(tracks))
}

export function addToDraftPlaylist(track) {
  const playlist = getDraftPlaylist()
  if (playlist.some((t) => t.id === track.id)) return playlist
  const updated = [...playlist, track]
  saveDraftPlaylist(updated)
  return updated
}

// Fetch a user's playlists from Audius (read-only, no secret needed)
// Paginates to get all playlists (API returns max 100 per page)
export async function fetchUserPlaylists(userId) {
  const all = []
  let offset = 0
  const limit = 100
  while (true) {
    const res = await fetch(
      `${API_HOST}/v1/users/${userId}/playlists?app_name=${APP_NAME}&limit=${limit}&offset=${offset}`
    )
    if (!res.ok) break
    const json = await res.json()
    const page = (json.data || []).filter((p) => !p.isAlbum && !p.is_album)
    all.push(...page)
    // If we got fewer than limit results, we've reached the end
    if (!json.data || json.data.length < limit) break
    offset += limit
  }
  return all
}

// Resolve an Audius URL to a track object
// Accepts URLs like https://audius.co/artist/track-name or audius.co/artist/track-name
export async function resolveTrackUrl(url) {
  // Normalize: ensure https:// prefix
  let normalized = url.trim()
  if (!normalized.startsWith('http')) normalized = `https://${normalized}`
  try {
    const res = await fetch(`${API_HOST}/v1/resolve?url=${encodeURIComponent(normalized)}&app_name=${APP_NAME}`)
    if (!res.ok) return null
    const json = await res.json()
    return json.data || null
  } catch {
    return null
  }
}

// Fetch tracks for a specific playlist (full track objects)
export async function fetchPlaylistTracks(playlistId) {
  const res = await fetch(
    `${API_HOST}/v1/playlists/${playlistId}/tracks?app_name=${APP_NAME}`
  )
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}
