import { describe, it, expect } from 'vitest'
import { VIBES } from '../utils/audius'

// Test the filtering logic that fetchTracks applies to tracks for each vibe.
// Since the filtering is inline in fetchTracks, we replicate it here to verify correctness.

function makeTrack(overrides = {}) {
  return {
    id: 'test-1',
    title: 'Test Track',
    duration: 180,
    play_count: 1000,
    favorite_count: 50,
    repost_count: 20,
    genre: 'Lo-Fi',
    mood: 'Peaceful',
    artwork: { '150x150': 'https://art.jpg' },
    user: { handle: 'artist1', name: 'Artist', follower_count: 100 },
    ...overrides,
  }
}

function filterForVibe(track, vibeKey) {
  const config = VIBES[vibeKey]
  if (!config) return false

  if (track.duration > config.maxDuration) return false
  if (config.minDuration && track.duration < config.minDuration) return false

  const allowedGenres = config.genres ? new Set(config.genres) : null
  if (allowedGenres && !allowedGenres.has(track.genre)) return false

  if (config.bpmMin && (!track.bpm || track.bpm < config.bpmMin)) return false
  if (config.bpmMax && (!track.bpm || track.bpm > config.bpmMax)) return false

  const allowedMoods = config.allowedMoods ? new Set(config.allowedMoods) : null
  if (allowedMoods && track.mood && !allowedMoods.has(track.mood)) return false

  const vibeExcludeHandles = config.excludeHandles
    ? new Set(config.excludeHandles.map(h => h.toLowerCase()))
    : null
  if (vibeExcludeHandles && vibeExcludeHandles.has(track.user?.handle?.toLowerCase())) return false

  return true
}

// ─── Lo-Fi vibe filtering ────────────────────────────────────────────────
describe('lofi vibe filtering', () => {
  it('accepts Lo-Fi genre tracks', () => {
    expect(filterForVibe(makeTrack({ genre: 'Lo-Fi' }), 'lofi')).toBe(true)
  })

  it('rejects non-Lo-Fi genres', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep' }), 'lofi')).toBe(false)
    expect(filterForVibe(makeTrack({ genre: 'House' }), 'lofi')).toBe(false)
  })

  it('enforces min duration (90s)', () => {
    expect(filterForVibe(makeTrack({ duration: 60 }), 'lofi')).toBe(false)
    expect(filterForVibe(makeTrack({ duration: 90 }), 'lofi')).toBe(true)
  })

  it('enforces max duration (6 min)', () => {
    expect(filterForVibe(makeTrack({ duration: 360 }), 'lofi')).toBe(true)
    expect(filterForVibe(makeTrack({ duration: 361 }), 'lofi')).toBe(false)
  })

  it('allows peaceful/mellow moods only', () => {
    expect(filterForVibe(makeTrack({ mood: 'Peaceful' }), 'lofi')).toBe(true)
    expect(filterForVibe(makeTrack({ mood: 'Easygoing' }), 'lofi')).toBe(true)
    expect(filterForVibe(makeTrack({ mood: 'Aggressive' }), 'lofi')).toBe(false)
    expect(filterForVibe(makeTrack({ mood: 'Energizing' }), 'lofi')).toBe(false)
  })

  it('allows tracks with no mood set', () => {
    expect(filterForVibe(makeTrack({ mood: null }), 'lofi')).toBe(true)
    expect(filterForVibe(makeTrack({ mood: undefined }), 'lofi')).toBe(true)
  })

  it('excludes blacklisted handles', () => {
    expect(filterForVibe(makeTrack({ user: { handle: 'chiefdijon' } }), 'lofi')).toBe(false)
    expect(filterForVibe(makeTrack({ user: { handle: 'mollymcphaul' } }), 'lofi')).toBe(false)
  })
})

// ─── DNB vibe filtering ─────────────────────────────────────────────────
describe('dnb vibe filtering', () => {
  it('accepts Drum & Bass genre', () => {
    expect(filterForVibe(makeTrack({ genre: 'Drum & Bass' }), 'dnb')).toBe(true)
  })

  it('rejects other genres', () => {
    expect(filterForVibe(makeTrack({ genre: 'Lo-Fi' }), 'dnb')).toBe(false)
  })

  it('enforces max duration (7 min)', () => {
    expect(filterForVibe(makeTrack({ genre: 'Drum & Bass', duration: 420 }), 'dnb')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Drum & Bass', duration: 421 }), 'dnb')).toBe(false)
  })

  it('has no mood filter', () => {
    expect(filterForVibe(makeTrack({ genre: 'Drum & Bass', mood: 'Aggressive' }), 'dnb')).toBe(true)
  })
})

// ─── Bass vibe filtering ────────────────────────────────────────────────
describe('bass vibe filtering', () => {
  it('accepts Dubstep, Trap, Future Bass', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep' }), 'bass')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Trap' }), 'bass')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Future Bass' }), 'bass')).toBe(true)
  })

  it('rejects House, Lo-Fi', () => {
    expect(filterForVibe(makeTrack({ genre: 'House' }), 'bass')).toBe(false)
    expect(filterForVibe(makeTrack({ genre: 'Lo-Fi' }), 'bass')).toBe(false)
  })
})

// ─── 140 vibe filtering ─────────────────────────────────────────────────
describe('140 vibe filtering', () => {
  it('requires BPM = 140', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 140 }), '140')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 128 }), '140')).toBe(false)
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 150 }), '140')).toBe(false)
  })

  it('rejects tracks without BPM', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep' }), '140')).toBe(false)
  })

  it('enforces min duration (60s)', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 140, duration: 30 }), '140')).toBe(false)
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 140, duration: 60 }), '140')).toBe(true)
  })

  it('accepts Dubstep, Trap, Electronic genres', () => {
    expect(filterForVibe(makeTrack({ genre: 'Dubstep', bpm: 140 }), '140')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Trap', bpm: 140 }), '140')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Electronic', bpm: 140 }), '140')).toBe(true)
  })
})

// ─── House vibe filtering ───────────────────────────────────────────────
describe('house vibe filtering', () => {
  it('accepts House, Deep House, Tech House', () => {
    expect(filterForVibe(makeTrack({ genre: 'House' }), 'house')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Deep House' }), 'house')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Tech House' }), 'house')).toBe(true)
  })

  it('enforces max duration (8 min)', () => {
    expect(filterForVibe(makeTrack({ genre: 'House', duration: 480 }), 'house')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'House', duration: 481 }), 'house')).toBe(false)
  })
})

// ─── Chill vibe filtering ───────────────────────────────────────────────
describe('chill vibe filtering', () => {
  it('accepts Downtempo genre', () => {
    expect(filterForVibe(makeTrack({ genre: 'Downtempo' }), 'chill')).toBe(true)
  })

  it('rejects non-Downtempo', () => {
    expect(filterForVibe(makeTrack({ genre: 'House' }), 'chill')).toBe(false)
  })

  it('allows long tracks (up to 10 min)', () => {
    expect(filterForVibe(makeTrack({ genre: 'Downtempo', duration: 600 }), 'chill')).toBe(true)
    expect(filterForVibe(makeTrack({ genre: 'Downtempo', duration: 601 }), 'chill')).toBe(false)
  })

  it('curated artists bypass genre filter in real flow', () => {
    // Note: in the actual code, curated artists are fetched separately and
    // skip genre filtering. This test verifies the config is correct.
    const chill = VIBES.chill
    expect(chill.curatedArtists).toBeDefined()
    expect(chill.curatedArtists.length).toBeGreaterThan(0)
    expect(chill.curatedArtists[0].handle).toBe('chiefdijon')
  })
})

// ─── Cross-vibe: excluded handles are vibe-specific ─────────────────────
describe('vibe-specific handle exclusions', () => {
  it('chiefdijon is excluded from lofi but curated in chill', () => {
    expect(VIBES.lofi.excludeHandles).toContain('chiefdijon')
    expect(VIBES.chill.curatedArtists.some(a => a.handle === 'chiefdijon')).toBe(true)
  })

  it('mollymcphaul is excluded from lofi but curated in chill', () => {
    expect(VIBES.lofi.excludeHandles).toContain('mollymcphaul')
    expect(VIBES.chill.curatedArtists.some(a => a.handle === 'mollymcphaul')).toBe(true)
  })
})
