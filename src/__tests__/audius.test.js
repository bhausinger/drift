import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getImageFallback,
  getBlockedIds, blockTrack,
  getBlockedArtists, blockArtist, unblockArtist,
  getRecentlyPlayed, addRecentlyPlayed,
  VIBES,
  formatDuration,
  getStreamUrl, getAudiusProfileUrl,
  getDraftPlaylist, saveDraftPlaylist, addToDraftPlaylist,
} from '../utils/audius'

// ─── Image fallback ──────────────────────────────────────────────────────
describe('getImageFallback', () => {
  it('returns null for falsy input', () => {
    expect(getImageFallback(null)).toBeNull()
    expect(getImageFallback('')).toBeNull()
    expect(getImageFallback(undefined)).toBeNull()
  })

  it('swaps to a different CDN node', () => {
    const broken = 'https://creatornode2.audius.co/content/abc/150x150.jpg'
    const fallback = getImageFallback(broken)
    expect(fallback).not.toBeNull()
    expect(fallback).toContain('/content/abc/150x150.jpg')
    expect(fallback).not.toContain('creatornode2.audius.co')
  })

  it('returns null for invalid URLs', () => {
    expect(getImageFallback('not a url')).toBeNull()
  })
})

// ─── Blocked tracks ──────────────────────────────────────────────────────
describe('blocked tracks', () => {
  it('starts empty', () => {
    expect(getBlockedIds().size).toBe(0)
  })

  it('blocks and persists track IDs', () => {
    blockTrack('abc')
    blockTrack('def')
    const blocked = getBlockedIds()
    expect(blocked.has('abc')).toBe(true)
    expect(blocked.has('def')).toBe(true)
    expect(blocked.size).toBe(2)
  })

  it('deduplicates blocked IDs via Set', () => {
    blockTrack('abc')
    blockTrack('abc')
    // Array stores both, but Set deduplicates on read
    expect(getBlockedIds().has('abc')).toBe(true)
  })
})

// ─── Blocked artists ────────────────────────────────────────────────────
describe('blocked artists', () => {
  it('starts empty', () => {
    expect(getBlockedArtists().size).toBe(0)
  })

  it('blocks and unblocks artists', () => {
    blockArtist('djcool')
    expect(getBlockedArtists().has('djcool')).toBe(true)
    unblockArtist('djcool')
    expect(getBlockedArtists().has('djcool')).toBe(false)
  })
})

// ─── Recently played ────────────────────────────────────────────────────
describe('recently played', () => {
  it('starts empty', () => {
    expect(getRecentlyPlayed().size).toBe(0)
  })

  it('tracks played IDs', () => {
    addRecentlyPlayed('t1')
    addRecentlyPlayed('t2')
    const recent = getRecentlyPlayed()
    expect(recent.has('t1')).toBe(true)
    expect(recent.has('t2')).toBe(true)
  })

  it('caps at MAX_RECENT (200)', () => {
    for (let i = 0; i < 250; i++) {
      addRecentlyPlayed(`track-${i}`)
    }
    const recent = getRecentlyPlayed()
    // Should only keep last 200
    expect(recent.size).toBe(200)
    expect(recent.has('track-0')).toBe(false)
    expect(recent.has('track-249')).toBe(true)
  })
})

// ─── VIBES configuration ────────────────────────────────────────────────
describe('VIBES', () => {
  it('has all expected vibes', () => {
    expect(Object.keys(VIBES)).toEqual(
      expect.arrayContaining(['lofi', 'dnb', 'bass', 'chill', '140', 'house'])
    )
  })

  it('each vibe has required fields', () => {
    for (const [key, vibe] of Object.entries(VIBES)) {
      expect(vibe.label).toBeTruthy()
      expect(vibe.queries.length).toBeGreaterThan(0)
      expect(vibe.maxDuration).toBeGreaterThan(0)
      expect(vibe.genres.length).toBeGreaterThan(0)
      expect(vibe.palette).toBeDefined()
      expect(vibe.palette['--c-deep']).toBeTruthy()
    }
  })

  it('140 vibe is team-only', () => {
    expect(VIBES['140'].teamOnly).toBe(true)
    expect(VIBES.lofi.teamOnly).toBeUndefined()
  })

  it('lofi has allowed moods filter', () => {
    expect(VIBES.lofi.allowedMoods).toBeDefined()
    expect(VIBES.lofi.allowedMoods).toContain('Peaceful')
    expect(VIBES.lofi.allowedMoods).not.toContain('Aggressive')
  })

  it('140 vibe has BPM lock', () => {
    expect(VIBES['140'].bpmMin).toBe(140)
    expect(VIBES['140'].bpmMax).toBe(140)
  })

  it('each vibe palette has all 6 color vars', () => {
    const colorVars = ['--c-deep', '--c-navy', '--c-indigo', '--c-purple', '--c-violet', '--c-teal']
    for (const vibe of Object.values(VIBES)) {
      for (const v of colorVars) {
        expect(vibe.palette[v]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    }
  })
})

// ─── URL helpers ─────────────────────────────────────────────────────────
describe('URL helpers', () => {
  it('getStreamUrl builds correct URL', () => {
    const url = getStreamUrl('abc123')
    expect(url).toBe('https://api.audius.co/v1/tracks/abc123/stream?app_name=drift')
  })

  it('getAudiusProfileUrl builds correct URL', () => {
    expect(getAudiusProfileUrl('djcool')).toBe('https://audius.co/djcool')
  })
})

// ─── formatDuration ──────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('formats seconds to m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('truncates fractional seconds', () => {
    expect(formatDuration(90.7)).toBe('1:30')
  })
})

// ─── Draft playlist ──────────────────────────────────────────────────────
describe('draft playlist', () => {
  it('starts empty', () => {
    expect(getDraftPlaylist()).toEqual([])
  })

  it('saves and retrieves tracks', () => {
    const tracks = [
      { id: '1', title: 'Track A' },
      { id: '2', title: 'Track B' },
    ]
    saveDraftPlaylist(tracks)
    expect(getDraftPlaylist()).toEqual(tracks)
  })

  it('addToDraftPlaylist appends without duplicates', () => {
    const t1 = { id: '1', title: 'A' }
    const t2 = { id: '2', title: 'B' }
    addToDraftPlaylist(t1)
    addToDraftPlaylist(t2)
    addToDraftPlaylist(t1) // duplicate
    expect(getDraftPlaylist()).toEqual([t1, t2])
  })

  it('addToDraftPlaylist returns updated list', () => {
    const t1 = { id: '1', title: 'A' }
    const result = addToDraftPlaylist(t1)
    expect(result).toEqual([t1])
  })
})
