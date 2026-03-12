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
const MAX_RECENT = 500

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

// Quality score combining engagement ratio, raw reach, recency, and artist credibility
function qualityScore(track) {
  const plays = track.play_count || 0
  const favs = track.favorite_count || 0
  const reposts = track.repost_count || 0
  const engagement = engagementRatio(track)

  // Reach: log-scaled play count (0–6 range)
  const reach = Math.log10(plays + 1)

  // Recency bonus: fresh tracks get surfaced more
  const released = track.release_date ? new Date(track.release_date) : null
  const ageMonths = released ? (Date.now() - released.getTime()) / (30 * 24 * 60 * 60 * 1000) : 18
  const recency = ageMonths < 3 ? 0.4 : ageMonths < 6 ? 0.3 : ageMonths < 12 ? 0.15 : 0

  // Artist credibility: followers indicate a real artist vs spam account
  const followers = track.user?.follower_count || 0
  const artistBonus = followers > 1000 ? 0.4 : followers > 200 ? 0.25 : followers > 50 ? 0.1 : 0

  // Favorite-heavy tracks = people really love it (not just repost bots)
  const loveRatio = plays > 0 ? favs / plays : 0
  const loveBonus = loveRatio > 0.05 ? 0.3 : loveRatio > 0.02 ? 0.15 : 0

  // Comment count signals genuine engagement (people don't comment on bad tracks)
  const comments = track.comment_count || 0
  const commentBonus = comments > 10 ? 0.3 : comments > 3 ? 0.15 : 0

  // Curated playlist tracks get a big boost — they're hand-picked quality
  const curatedBonus = track._curatedBoost ? 3.0 : 0

  // Engagement is king, but artist cred + love + freshness help surface gems
  return engagement * 4 + reach * 0.3 + recency + artistBonus + loveBonus + commentBonus + curatedBonus
}

// Keyword denylist — reject tracks with slurs, hate speech, or sexually explicit titles
const DENYLIST_PATTERNS = [
  // Slurs and hate speech
  /\bn[i1]gg[ae3]r?s?\b/i, /\bf[a@]gg?[o0]ts?\b/i, /\bk[i1]ke[s]?\b/i,
  /\bsp[i1]c[sk]?\b/i, /\bch[i1]nk[s]?\b/i, /\bwetback[s]?\b/i,
  /\btr[a@]nn[yie]+s?\b/i, /\bretard[s]?\b/i,
  // White supremacy / hate groups
  /\bwhite\s*power\b/i, /\bwhite\s*supremac/i, /\bsieg\s*heil\b/i,
  /\bheil\s*hitler\b/i, /\b14\s*88\b/, /\brace\s*war\b/i,
  // Sexually explicit
  /\bporn\b/i, /\bhentai\b/i, /\bxxx\b/i, /\bbukkake\b/i,
  /\bgangbang\b/i, /\bjailbait\b/i, /\blolicon\b/i,
]

function hasDeniedContent(track) {
  const title = (track.title || '').toLowerCase()
  const artistName = (track.user?.name || '').toLowerCase()
  const tags = (track.tags || '').toLowerCase()
  const fields = [title, artistName, tags]
  return fields.some(f => DENYLIST_PATTERNS.some(p => p.test(f)))
}

// Check if a track or artist name suggests AI-generated content
function isAIContent(track) {
  const title = (track.title || '').toLowerCase()
  const artistName = (track.user?.name || '').toLowerCase()
  const handle = (track.user?.handle || '').toLowerCase()
  const tags = (track.tags || '').toLowerCase()
  const aiPatterns = [
    /\bai\b/, /\ba\.i\./, /\bartificial intelligence\b/,
    /\bai.generated\b/, /\bai.music\b/, /\bai.made\b/,
    /\bsuno\b/, /\budio\b/, /\bai.cover\b/, /\bai.remix\b/,
  ]
  const fields = [title, artistName, handle, tags]
  return fields.some(f => aiPatterns.some(p => p.test(f)))
}

// Minimum engagement ratio to filter out low-quality tracks
// Tracks need at least 1% engagement OR 500+ plays (established tracks get benefit of doubt)
function passesQualityGate(track) {
  const plays = track.play_count || 0
  if (plays < 15) return false // absolute floor
  if (!track.artwork?.['150x150']) return false // must have artwork
  if (track.duration < 30) return false // skip tiny clips/samples
  // Spam filter: no title or suspiciously short title
  if (!track.title || track.title.trim().length < 2) return false
  // Artist must exist and have at least a few followers (filters bot accounts)
  if (!track.user || (track.user.follower_count || 0) < 3) return false
  // Reject NSFW, unlisted, or deleted tracks (Audius content flags)
  if (track.is_delete || track.is_unlisted || track.nsfw || track.is_premium) return false
  // Reject tracks with hateful or sexually explicit titles/tags
  if (hasDeniedContent(track)) return false
  // No AI-generated content
  if (isAIContent(track)) return false
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
      'nostalgia beats', 'rainy day', 'cozy', 'warm beats',
      'sunset lofi', 'anime lofi', 'jazzhop', 'boom bap lofi',
    ],
    minDuration: 90, // real lofi tracks are 1.5–5 min, skip short clips
    maxDuration: 6 * 60,
    genres: ['Lo-Fi'],
    apiGenre: 'Lo-Fi',
    // Only allow mellow/peaceful moods — filters out energetic tracks mis-tagged as lofi
    allowedMoods: ['Easygoing', 'Peaceful', 'Romantic', 'Yearning', 'Sensual', 'Sophisticated', 'Cool'],
    // Curated playlist: Bragi Collective "Lofi Morning" — guaranteed quality lofi
    curatedPlaylistId: '1972288554',
    // Artists that get mis-tagged as Lo-Fi but don't fit the vibe
    excludeHandles: ['chiefdijon', 'mollymcphaul'],
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
      'liquid drum and bass', 'dancefloor dnb', 'minimal dnb',
      'vocal dnb', 'dark dnb', 'liquid funk', 'intelligent dnb',
      'sambass', 'ragga jungle', 'amen break', 'autonomic',
      'soulful dnb', 'drumfunk', 'techstep', 'hospital records',
      'soul in motion', 'calibre dnb', 'lenzman', 'alix perez',
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
      'melodic bass', 'briddim', 'deathstep', 'freeform bass',
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
      'chillout', 'balearic', 'trip hop', 'psybient',
    ],
    maxDuration: 10 * 60,
    genres: ['Downtempo'],
    apiGenre: 'Downtempo',
    // Curated artists whose tracks bypass genre filter for this vibe
    curatedArtists: [
      { id: 'pG0opdo', handle: 'chiefdijon' },
      { id: '92pPakO', handle: 'mollymcphaul' },
    ],
    palette: {
      '--c-deep': '#040810',
      '--c-navy': '#081828',
      '--c-indigo': '#1a4a5a',
      '--c-purple': '#204060',
      '--c-violet': '#3a7080',
      '--c-teal': '#1a5a4a',
    },
  },
  '140': {
    label: '140',
    teamOnly: true,
    queries: [
      'bass', 'bass music', 'dubstep', 'trap', 'future bass',
      'riddim', 'heavy', 'filthy', 'wobble', 'banger',
      'grime', 'halftime', 'midtempo', 'tearout',
      'color bass', 'experimental bass', 'space bass', 'wonky',
      'melodic bass', 'briddim', 'deathstep', 'freeform bass',
      'uk bass', 'ukg', 'garage', 'bassline',
    ],
    minDuration: 60,
    maxDuration: 7 * 60,
    bpmMin: 140,
    bpmMax: 140,
    excludePlaylistId: 'l5Q60YO', // @Audius "140" playlist — exclude featured artists
    genres: ['Dubstep', 'Trap', 'Electronic'],
    apiGenres: ['Dubstep', 'Trap', 'Electronic'],
    palette: {
      '--c-deep': '#080310',
      '--c-navy': '#10082a',
      '--c-indigo': '#1a1a6a',
      '--c-purple': '#4a0870',
      '--c-violet': '#8a10d0',
      '--c-teal': '#d010a0',
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
      'italo house', 'piano house', 'speed garage', 'lo-fi house',
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

// ─── Trending Winners: past weekly chart-toppers ────────────────────────
// /v1/tracks/trending/winners?week=YYYY-MM-DD returns that week's top tracks
// We pull from random past weeks to get a pool of proven quality tracks
let winnersCache = null
let winnersCacheTime = 0
const WINNERS_CACHE_TTL = 30 * 60 * 1000 // 30 min cache

function getRandomPastFridays(count) {
  // Winners are set on Fridays — generate random past Friday dates
  const now = new Date()
  const fridays = []
  // Go back up to 52 weeks
  const d = new Date(now)
  d.setDate(d.getDate() - d.getDay() + 5) // This week's Friday
  if (d > now) d.setDate(d.getDate() - 7) // If Friday hasn't happened yet
  for (let i = 0; i < 52; i++) {
    fridays.push(new Date(d))
    d.setDate(d.getDate() - 7)
  }
  return shuffle(fridays).slice(0, count).map(f =>
    `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  )
}

async function fetchTrendingWinners() {
  if (winnersCache && Date.now() - winnersCacheTime < WINNERS_CACHE_TTL) return winnersCache

  // Pick 4 random past weeks and fetch both regular + underground winners
  const weeks = getRandomPastFridays(4)
  const fetches = weeks.flatMap(week => [
    fetch(`${API_HOST}/v1/tracks/trending/winners?app_name=${APP_NAME}&week=${week}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => j.data || [])
      .catch(() => []),
    fetch(`${API_HOST}/v1/tracks/trending/underground/winners?app_name=${APP_NAME}&week=${week}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => j.data || [])
      .catch(() => []),
  ])
  const pages = await Promise.all(fetches)
  winnersCache = pages.flat()
  winnersCacheTime = Date.now()
  return winnersCache
}

// ─── Curated playlist: direct playlist source for vibe-specific quality ─────
// Some vibes have a curatedPlaylistId — these tracks are hand-picked and bypass
// genre filtering since they're guaranteed to match the vibe
const curatedPlaylistCache = {}
const CURATED_CACHE_TTL = 30 * 60 * 1000

async function fetchCuratedPlaylist(playlistId) {
  if (!playlistId) return []
  const cached = curatedPlaylistCache[playlistId]
  if (cached && Date.now() - cached.time < CURATED_CACHE_TTL) return cached.tracks
  try {
    const res = await fetch(`${API_HOST}/v1/playlists/${playlistId}/tracks?app_name=${APP_NAME}`)
    if (!res.ok) return []
    const json = await res.json()
    const tracks = json.data || []
    curatedPlaylistCache[playlistId] = { tracks, time: Date.now() }
    return tracks
  } catch {
    return []
  }
}

// ─── Curated artists: fetch all tracks by specific artists for a vibe ───
const curatedArtistCache = {}
const CURATED_ARTIST_CACHE_TTL = 30 * 60 * 1000

async function fetchCuratedArtistTracks(artists) {
  if (!artists || artists.length === 0) return []
  const allTracks = []
  for (const artist of artists) {
    const cached = curatedArtistCache[artist.id]
    if (cached && Date.now() - cached.time < CURATED_ARTIST_CACHE_TTL) {
      allTracks.push(...cached.tracks)
      continue
    }
    try {
      // Fetch up to 200 tracks per artist (2 pages)
      const tracks = []
      for (let offset = 0; offset < 200; offset += 100) {
        const res = await fetch(`${API_HOST}/v1/users/${artist.id}/tracks?app_name=${APP_NAME}&limit=100&offset=${offset}`)
        if (!res.ok) break
        const json = await res.json()
        const page = json.data || []
        tracks.push(...page)
        if (page.length < 100) break
      }
      curatedArtistCache[artist.id] = { tracks, time: Date.now() }
      allTracks.push(...tracks)
    } catch {
      // Skip failed artist
    }
  }
  return allTracks
}

// ─── Curator accounts: playlist archives for discovery ──────────────────
// These accounts curate massive playlist libraries across genres
// We pull random playlists from each to fuel the discovery pipeline
const CURATOR_ACCOUNTS = [
  { id: 'jvRRz4a', name: 'Hot & New Archives' },
  { id: 'Mwvkx', name: 'Fly Moon Music' },
  { id: 'P8N85', name: 'Shrimply Pibbles' },
  { id: 'byOqP', name: 'Bragi Collective' },
]
let curatorCache = null
let curatorCacheTime = 0
const CURATOR_CACHE_TTL = 30 * 60 * 1000 // 30 min cache

async function fetchCuratorTracks() {
  if (curatorCache && Date.now() - curatorCacheTime < CURATOR_CACHE_TTL) return curatorCache

  try {
    // Fetch playlists from all curator accounts in parallel
    const playlistFetches = CURATOR_ACCOUNTS.map(async (account) => {
      let allPlaylists = []
      let offset = 0
      while (true) {
        const res = await fetch(`${API_HOST}/v1/users/${account.id}/playlists?app_name=${APP_NAME}&limit=100&offset=${offset}`)
        if (!res.ok) break
        const json = await res.json()
        const page = json.data || []
        allPlaylists.push(...page)
        if (page.length < 100) break
        offset += 100
      }
      return allPlaylists
    })

    const allResults = await Promise.all(playlistFetches)
    const allPlaylists = allResults.flat()
    if (allPlaylists.length === 0) return []

    // Pick 4 random playlists from the combined pool
    const picked = shuffle(allPlaylists).slice(0, 4)
    const trackFetches = picked.map(pl => {
      const id = pl.playlist_id || pl.id
      return fetch(`${API_HOST}/v1/playlists/${id}/tracks?app_name=${APP_NAME}`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then(j => j.data || [])
        .catch(() => [])
    })
    const pages = await Promise.all(trackFetches)
    curatorCache = pages.flat()
    curatorCacheTime = Date.now()
    return curatorCache
  } catch {
    return []
  }
}

// Backwards compat alias
const fetchHotNewTracks = fetchCuratorTracks

// Fetch genre-filtered trending tracks to sprinkle into the mix
// Rotates through week/month/allTime for variety across fetches
const trendingTimeframes = ['week', 'month', 'allTime']
let trendingTimeIdx = 0

async function fetchGenreTrending(genre) {
  if (!genre) return []
  const time = trendingTimeframes[trendingTimeIdx++ % trendingTimeframes.length]
  const params = new URLSearchParams({ app_name: APP_NAME, time })
  params.set('genre', genre)
  try {
    const res = await fetch(`${API_HOST}/v1/tracks/trending?${params}`)
    if (!res.ok) return []
    const json = await res.json()
    return json.data || []
  } catch { return [] }
}

// Underground trending — emerging artists with strong engagement
let undergroundCache = null
let undergroundCacheTime = 0
const UNDERGROUND_CACHE_TTL = 15 * 60 * 1000 // 15 min cache

async function fetchUndergroundTrending() {
  if (undergroundCache && Date.now() - undergroundCacheTime < UNDERGROUND_CACHE_TTL) return undergroundCache
  try {
    const res = await fetch(`${API_HOST}/v1/tracks/trending/underground?app_name=${APP_NAME}`)
    if (!res.ok) return []
    const json = await res.json()
    undergroundCache = json.data || []
    undergroundCacheTime = Date.now()
    return undergroundCache
  } catch { return [] }
}

// ─── Playlist artist exclusion (for 140 vibe) ──────────────────────────
// Fetches artist handles from a playlist to exclude from discovery results
const excludeCache = {}
const EXCLUDE_CACHE_TTL = 30 * 60 * 1000

export async function fetchExcludedArtists(playlistId) {
  if (!playlistId) return new Set()
  const cached = excludeCache[playlistId]
  if (cached && Date.now() - cached.time < EXCLUDE_CACHE_TTL) return cached.handles
  try {
    const res = await fetch(`${API_HOST}/v1/playlists/${playlistId}/tracks?app_name=${APP_NAME}`)
    if (!res.ok) return new Set()
    const json = await res.json()
    const handles = new Set((json.data || []).map(t => t.user?.handle?.toLowerCase()).filter(Boolean))
    excludeCache[playlistId] = { handles, time: Date.now() }
    return handles
  } catch {
    return new Set()
  }
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
  // Random start per session so different days surface different tracks
  if (!(vibe in queryIndexes)) queryIndexes[vibe] = Math.floor(Math.random() * config.queries.length)
  const startIdx = queryIndexes[vibe]
  queryIndexes[vibe] += 8

  // Pick 8 diverse query combos: different queries × different sorts × different offsets
  const sorts = ['relevant', 'popular', 'recent']
  const picks = []
  for (let i = 0; i < 8; i++) {
    const q = config.queries[(startIdx + i) % config.queries.length]
    const s = sorts[i % sorts.length]
    const offset = Math.floor(Math.random() * 12) * 25 // 0–275 (deeper pages)
    const genre = pickApiGenre(config, startIdx + i)
    picks.push({ q, s, offset, genre })
  }

  const searchFetches = picks.map(({ q, s, offset, genre }) => {
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

  // Sprinkle in trending + underground + winners + curated picks
  const trendingGenre = pickApiGenre(config, startIdx)
  const trendingFetch = fetchGenreTrending(trendingGenre)
  const undergroundFetch = fetchUndergroundTrending()
  const winnersFetch = fetchTrendingWinners()
  const hotNewFetch = fetchHotNewTracks()
  const excludeFetch = fetchExcludedArtists(config.excludePlaylistId)
  const curatedFetch = fetchCuratedPlaylist(config.curatedPlaylistId)
  const curatedArtistFetch = fetchCuratedArtistTracks(config.curatedArtists)

  const [searchPages, trendingTracks, undergroundTracks, winnersTracks, hotNewTracks, excludedArtists, curatedTracks, curatedArtistTracks] = await Promise.all([
    Promise.all(searchFetches),
    trendingFetch,
    undergroundFetch,
    winnersFetch,
    hotNewFetch,
    excludeFetch,
    curatedFetch,
    curatedArtistFetch,
  ])
  // Sample from each source so we get variety each time
  const undergroundSample = shuffle(undergroundTracks).slice(0, 10)
  const winnersSample = shuffle(winnersTracks).slice(0, 10)
  const hotNewSample = shuffle(hotNewTracks).slice(0, 15)
  const allTracks = [...searchPages.flat(), ...trendingTracks, ...undergroundSample, ...winnersSample, ...hotNewSample]

  // Per-vibe handle exclusion list (e.g. artists mis-tagged as Lo-Fi)
  const vibeExcludeHandles = config.excludeHandles
    ? new Set(config.excludeHandles.map(h => h.toLowerCase()))
    : null

  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const recentlyPlayed = getRecentlyPlayed()
  const allowedGenres = config.genres ? new Set(config.genres) : null
  const allowedMoods = config.allowedMoods ? new Set(config.allowedMoods) : null

  // Filter curated playlist + curated artist tracks (no genre check — they're vetted)
  const allCurated = [...curatedTracks, ...curatedArtistTracks]
  const filteredCurated = allCurated.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return !blocked.has(t.id)
      && !blockedArtists.has(t.user?.handle)
      && !recentlyPlayed.has(t.id)
      && t.duration <= config.maxDuration
  })

  const filtered = allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return t.duration <= config.maxDuration
      && (!config.minDuration || t.duration >= config.minDuration)
      && !blocked.has(t.id)
      && !blockedArtists.has(t.user?.handle)
      && !recentlyPlayed.has(t.id)
      && (!allowedGenres || allowedGenres.has(t.genre))
      && (!config.bpmMin || (t.bpm && t.bpm >= config.bpmMin))
      && (!config.bpmMax || (t.bpm && t.bpm <= config.bpmMax))
      && !excludedArtists.has(t.user?.handle?.toLowerCase())
      && (!vibeExcludeHandles || !vibeExcludeHandles.has(t.user?.handle?.toLowerCase()))
      && (!allowedMoods || !t.mood || allowedMoods.has(t.mood))
      && passesQualityGate(t)
  })

  // Curated tracks get a big quality boost so they surface prominently
  const boostedCurated = filteredCurated.map(t => ({ ...t, _curatedBoost: true }))
  return weightedShuffle([...boostedCurated, ...filtered])
}

// Fallback: even wider net when primary fetch returns too few
export async function fetchRadioTracks({ vibe = 'lofi', limit = 50 } = {}) {
  const config = VIBES[vibe] || VIBES.lofi
  const queries = config.queries
  const sorts = ['relevant', 'popular', 'recent']

  // 10 diverse combos with wider offsets for deeper pages
  const picks = []
  for (let i = 0; i < 10; i++) {
    const q = queries[Math.floor(Math.random() * queries.length)]
    const s = sorts[Math.floor(Math.random() * sorts.length)]
    const offset = Math.floor(Math.random() * 10) * 25 // 0–225
    const genre = pickApiGenre(config, i)
    picks.push({ q, s, offset, genre })
  }

  const searchFetches = picks.map(({ q, s, offset, genre }) => {
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

  // Pull trending from all 3 timeframes for maximum pool in fallback mode
  const genre = pickApiGenre(config, 0)
  const trendingFetches = trendingTimeframes.map(time => {
    const params = new URLSearchParams({ app_name: APP_NAME, time })
    if (genre) params.set('genre', genre)
    return fetch(`${API_HOST}/v1/tracks/trending?${params}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => j.data || [])
      .catch(() => [])
  })

  const excludeFetch = fetchExcludedArtists(config.excludePlaylistId)

  const [searchPages, excludedArtists, ...trendingPages] = await Promise.all([
    Promise.all(searchFetches),
    excludeFetch,
    ...trendingFetches,
  ])
  const allTracks = [...searchPages.flat(), ...trendingPages.flat()]

  const seen = new Set()
  const blocked = getBlockedIds()
  const blockedArtists = getBlockedArtists()
  const recentlyPlayed = getRecentlyPlayed()
  const allowedGenres = config.genres ? new Set(config.genres) : null

  const filtered = allTracks.filter((t) => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return t.duration <= config.maxDuration
      && (!config.minDuration || t.duration >= config.minDuration)
      && !blocked.has(t.id)
      && !blockedArtists.has(t.user?.handle)
      && !recentlyPlayed.has(t.id)
      && (!allowedGenres || allowedGenres.has(t.genre))
      && (!config.bpmMin || (t.bpm && t.bpm >= config.bpmMin))
      && (!config.bpmMax || (t.bpm && t.bpm <= config.bpmMax))
      && !excludedArtists.has(t.user?.handle?.toLowerCase())
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

// Persisted draft edits for existing playlists (server-backed via Upstash Redis)

export async function fetchPlaylistDraft(userId, playlistId) {
  try {
    const res = await fetch(`/api/playlist-draft?userId=${userId}&playlistId=${playlistId}`)
    if (!res.ok) return null
    const { draft } = await res.json()
    return draft ? (typeof draft === 'string' ? JSON.parse(draft) : draft) : null
  } catch {
    return null
  }
}

export async function savePlaylistDraft(userId, playlistId, tracks) {
  try {
    await fetch('/api/playlist-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, playlistId, tracks }),
    })
  } catch {
    // Silent fail — draft save is best-effort
  }
}

export async function clearPlaylistDraft(userId, playlistId) {
  try {
    await fetch('/api/playlist-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, playlistId, action: 'delete' }),
    })
  } catch {
    // Silent fail
  }
}

export async function fetchAllPlaylistDraftIds(userId) {
  try {
    const res = await fetch(`/api/playlist-draft?userId=${userId}`)
    if (!res.ok) return []
    const { playlistIds } = await res.json()
    return playlistIds || []
  } catch {
    return []
  }
}

// Fetch a user's playlists from Audius
// Uses the full API with userId param to include private playlists when the user is the owner
// Paginates to get all playlists (API returns max 100 per page)
export async function fetchUserPlaylists(userId) {
  const all = []
  let offset = 0
  const limit = 100
  while (true) {
    // Full API with userId= returns private playlists for the authenticated user
    const res = await fetch(
      `${API_HOST}/v1/full/users/${userId}/playlists?app_name=${APP_NAME}&limit=${limit}&offset=${offset}&userId=${userId}`
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
