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

// Engagement ratio: favorites+reposts per play — measures how much listeners care
// A track with 200 plays and 50 favs (25% ratio) is better than 10k plays and 20 favs (0.2%)
function engagementRatio(track) {
  const plays = track.play_count || 0
  if (plays === 0) return 0
  return ((track.favorite_count || 0) + (track.repost_count || 0)) / plays
}

// Quality score combining engagement ratio, raw reach, and recency
function qualityScore(track) {
  const engagement = engagementRatio(track)
  const reach = Math.log10((track.play_count || 0) + 1) // 0–6 range
  // Recency bonus: tracks < 6 months old get a boost
  const released = track.release_date ? new Date(track.release_date) : null
  const ageMonths = released ? (Date.now() - released.getTime()) / (30 * 24 * 60 * 60 * 1000) : 12
  const recency = ageMonths < 6 ? 0.3 : ageMonths < 12 ? 0.15 : 0
  // Engagement is the primary signal (weighted most), reach prevents total unknowns,
  // recency surfaces fresh music
  return engagement * 4 + reach * 0.3 + recency
}

// Minimum engagement ratio to filter out low-quality tracks
// Tracks need at least 1% engagement OR 500+ plays (established tracks get benefit of doubt)
function passesQualityGate(track) {
  const plays = track.play_count || 0
  if (plays < 20) return false // absolute floor
  if (!track.artwork?.['150x150']) return false // must have artwork
  if (plays >= 500) return true // established tracks pass
  return engagementRatio(track) >= 0.01 // smaller tracks need 1%+ engagement
}

// Weighted shuffle: higher quality bubbles up but randomness preserves discovery
function weightedShuffle(arr) {
  return arr
    .map((t) => ({ t, score: qualityScore(t) + Math.random() * 0.5 }))
    .sort((a, b) => b.score - a.score)
    .map(({ t }) => t)
}

export const VIBES = {
  lofi: {
    label: 'lo-fi',
    // Genre-locked to Lo-Fi — queries just vary the flavor
    queries: [
      'lofi', 'lofi beats', 'lofi hip hop', 'chillhop',
      'study beats', 'lofi jazz', 'mellow beats',
      'late night lofi', 'bedroom beats', 'coffee shop beats',
      'lofi chill', 'lofi vibes', 'lofi piano', 'lofi guitar',
      'lofi rain', 'lofi study', 'lofi sleep', 'lofi tape',
      'vinyl beats', 'dusty beats', 'lofi soul', 'calm beats',
    ],
    maxDuration: 6 * 60,
    genres: ['Lo-Fi'],
    apiGenre: 'Lo-Fi',
    palette: {
      '--c-deep': '#0f0808',
      '--c-navy': '#1a0e0a',
      '--c-indigo': '#6a3a2a',
      '--c-purple': '#70304a',
      '--c-violet': '#a04860',
      '--c-teal': '#6a4a0d',
    },
  },
  dnb: {
    label: 'dnb',
    // Genre-locked to Drum & Bass
    queries: [
      'drum and bass', 'liquid dnb', 'dnb', 'jungle',
      'neurofunk', 'atmospheric dnb', 'rollers', 'deep dnb',
      'liquid bass', 'breakbeat', 'halfstep', 'jump up',
      'dancefloor dnb', 'minimal dnb', 'vocal dnb', 'dark dnb',
      'liquid funk', 'intelligent dnb', 'sambass', 'ragga jungle',
    ],
    maxDuration: 7 * 60,
    genres: ['Drum & Bass'],
    apiGenre: 'Drum & Bass',
    palette: {
      '--c-deep': '#080508',
      '--c-navy': '#1a0a14',
      '--c-indigo': '#5a1a2a',
      '--c-purple': '#3a1040',
      '--c-violet': '#7a2040',
      '--c-teal': '#0a2848',
    },
  },
  bass: {
    label: 'bass',
    // Genre-locked to Dubstep/Trap/Future Bass — no Electronic catch-all
    queries: [
      'bass', 'bass music', 'dubstep', 'trap', 'future bass',
      'riddim', 'heavy', 'filthy', 'wobble', 'banger',
      'festival', 'drop', 'hard', 'hybrid',
      'wub', 'grime', 'halftime', 'midtempo', 'tearout',
      'color bass', 'experimental bass', 'space bass', 'wonky',
    ],
    maxDuration: 6 * 60,
    genres: ['Dubstep', 'Trap', 'Future Bass'],
    apiGenres: ['Dubstep', 'Trap', 'Future Bass'],
    palette: {
      '--c-deep': '#050510',
      '--c-navy': '#0a0a28',
      '--c-indigo': '#0a3a6a',
      '--c-purple': '#5a1070',
      '--c-violet': '#0ad0d0',
      '--c-teal': '#d020a0',
    },
  },
  chill: {
    label: 'chill',
    // Downtempo-only genre lock — no Electronic catch-all leaking in
    // Covers ambient, downtempo, chill electronic territory
    queries: [
      'chill', 'downtempo', 'ambient', 'atmospheric', 'ethereal',
      'dreamy', 'mellow', 'floating', 'sunset', 'peaceful',
      'meditative', 'relaxing', 'deep', 'organic',
      'zen', 'nature sounds', 'space ambient', 'drone',
      'new age', 'healing', 'cinematic', 'slow',
    ],
    maxDuration: 10 * 60,
    genres: ['Downtempo'],
    apiGenre: 'Downtempo',
    palette: {
      '--c-deep': '#040810',
      '--c-navy': '#081828',
      '--c-indigo': '#1a4a5a',
      '--c-purple': '#204060',
      '--c-violet': '#3a7080',
      '--c-teal': '#1a5a4a',
    },
  },
  house: {
    label: 'house',
    // All three house sub-genres in both API rotation and client filter
    queries: [
      'house', 'deep house', 'tech house', 'house music',
      'soulful house', 'funky house', 'vocal house', 'minimal house',
      'underground house', 'afro house', 'melodic house', 'disco house',
      'progressive house', 'organic house', 'jackin house', 'acid house',
      'tribal house', 'latin house', 'garage', 'uk garage',
    ],
    maxDuration: 8 * 60,
    genres: ['House', 'Deep House', 'Tech House'],
    apiGenres: ['House', 'Deep House', 'Tech House'],
    palette: {
      '--c-deep': '#0a0804',
      '--c-navy': '#1a1408',
      '--c-indigo': '#6a4a1a',
      '--c-purple': '#704820',
      '--c-violet': '#a06830',
      '--c-teal': '#5a3a0a',
    },
  },
}

// Cycle through queries per vibe
const queryIndexes = {}

// Pick the API genre for a vibe — rotates through apiGenres array if present
function pickApiGenre(config, idx) {
  if (config.apiGenres) return config.apiGenres[idx % config.apiGenres.length]
  return config.apiGenre || null
}

// Always cast a wide net: multiple queries × sorts × genres in parallel
// This is the core discovery engine — bigger pool = better quality after filtering
export async function fetchTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi

  // Advance query index to rotate through different queries each call
  if (!(vibe in queryIndexes)) queryIndexes[vibe] = 0
  const startIdx = queryIndexes[vibe]
  queryIndexes[vibe] += 6

  // Pick 6 diverse query combos: different queries × different sorts × different offsets
  const sorts = ['relevant', 'popular', 'recent']
  const picks = []
  for (let i = 0; i < 6; i++) {
    const q = config.queries[(startIdx + i) % config.queries.length]
    const s = sorts[i % sorts.length]
    const offset = Math.floor(Math.random() * 6) * 25 // 0–125 (stay in productive range)
    const genre = pickApiGenre(config, startIdx + i)
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
      && passesQualityGate(t)
  })
  return weightedShuffle(filtered)
}

// Fallback: even wider net when primary fetch returns too few
export async function fetchRadioTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi
  const queries = config.queries
  const sorts = ['relevant', 'popular', 'recent']

  // 8 diverse combos with wider offsets for deeper pages
  const picks = []
  for (let i = 0; i < 8; i++) {
    const q = queries[Math.floor(Math.random() * queries.length)]
    const s = sorts[Math.floor(Math.random() * sorts.length)]
    const offset = Math.floor(Math.random() * 10) * 25 // 0–225
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
      && passesQualityGate(t)
  })
  return weightedShuffle(filtered)
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
  // Build API-native params — let the API do the heavy filtering
  const baseParams = {}
  if (mood) baseParams.mood = mood
  if (bpmMin) baseParams.bpm_min = bpmMin
  if (bpmMax) baseParams.bpm_max = bpmMax
  if (key) baseParams.key = key

  const sort = sortBias || 'recent'
  const textQuery = query.trim()

  // Strategy: fetch ALL matching tracks by paginating per genre
  // Each genre gets its own set of paginated requests so adding genres = more results
  const fetches = []

  if (genres.length > 0) {
    // Separate calls per genre so each genre gets full pagination
    for (const genre of genres) {
      const genreParams = { ...baseParams, genres: [genre] }
      // Paginate: 10 pages × 100 = up to 1000 tracks per genre
      for (let offset = 0; offset < 1000; offset += 100) {
        fetches.push(fetchDJPage(textQuery, sort, offset, genreParams))
      }
      // Also fetch with 'popular' sort for variety (5 pages)
      if (sort !== 'popular') {
        for (let offset = 0; offset < 500; offset += 100) {
          fetches.push(fetchDJPage(textQuery, 'popular', offset, genreParams))
        }
      }
    }
  } else {
    // No genre selected — just search by text query across all genres
    for (let offset = 0; offset < 1000; offset += 100) {
      fetches.push(fetchDJPage(textQuery, sort, offset, baseParams))
    }
    if (sort !== 'popular') {
      for (let offset = 0; offset < 500; offset += 100) {
        fetches.push(fetchDJPage(textQuery, 'popular', offset, baseParams))
      }
    }
  }

  const pages = await Promise.all(fetches)
  const allTracks = pages.flat()

  // Deduplicate by track ID
  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()

  return allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    if (blocked.has(t.id)) return false
    if (blockedArtists.has(t.user?.handle)) return false
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
  return weightedShuffle(filtered)
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Fetch tracks by a specific artist — search by name, filter to exact handle
export async function fetchArtistTracks(handle, artistName) {
  const query = artistName || handle
  const sorts = ['popular', 'recent', 'relevant']
  const fetches = sorts.map((sort) => {
    const params = new URLSearchParams({
      query,
      sort_method: sort,
      limit: '50',
      app_name: APP_NAME,
    })
    return fetch(`${API_HOST}/v1/tracks/search?${params}`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((j) => j.data || [])
      .catch(() => [])
  })

  const pages = await Promise.all(fetches)
  const allTracks = pages.flat()

  const seen = new Set()
  const blocked = getBlockedIds()
  const recentlyPlayed = getRecentlyPlayed()

  return allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    if (t.user?.handle !== handle) return false
    if (blocked.has(t.id)) return false
    if (recentlyPlayed.has(t.id)) return false
    if (!passesQualityGate(t)) return false
    return true
  }).slice(0, 20)
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
