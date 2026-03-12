import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudius } from '../hooks/useAudius'

// Mock the audius utils
vi.mock('../utils/audius', () => {
  const makeTracks = (count, prefix = '') =>
    Array.from({ length: count }, (_, i) => ({
      id: `${prefix}track-${i}`,
      title: `Track ${i}`,
      duration: 180,
      play_count: 1000,
      user: { handle: `artist-${i % 5}`, name: `Artist ${i % 5}`, follower_count: 100 },
    }))

  return {
    fetchTracks: vi.fn().mockResolvedValue(makeTracks(20)),
    getStreamUrl: vi.fn((id) => `https://stream/${id}`),
    blockTrack: vi.fn(),
    blockArtist: vi.fn(),
    getBlockedArtists: vi.fn(() => new Set()),
    addRecentlyPlayed: vi.fn(),
  }
})

describe('useAudius hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads tracks on mount', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    // Wait for loading to complete
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.tracks.length).toBeGreaterThan(0)
    expect(result.current.currentTrack).toBeTruthy()
    expect(result.current.currentIndex).toBe(0)
  })

  it('provides stream URL for current track', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.streamUrl).toContain('https://stream/')
  })

  it('nextTrack advances the index', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const firstTrack = result.current.currentTrack
    act(() => { result.current.nextTrack() })

    // Index should advance (may skip due to artist dedup)
    expect(result.current.currentIndex).toBeGreaterThan(0)
  })

  it('prevTrack goes back', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => { result.current.nextTrack() })
    const idx = result.current.currentIndex
    act(() => { result.current.prevTrack() })
    expect(result.current.currentIndex).toBe(idx - 1)
  })

  it('prevTrack does not go below 0', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => { result.current.prevTrack() })
    expect(result.current.currentIndex).toBe(0)
  })

  it('caps tracks per artist at MAX_PER_ARTIST (3)', async () => {
    const { fetchTracks } = await import('../utils/audius')
    // All tracks by same artist
    fetchTracks.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        id: `same-${i}`,
        title: `Track ${i}`,
        duration: 180,
        play_count: 1000,
        user: { handle: 'sameartist', name: 'Same', follower_count: 100 },
      }))
    )

    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const sameArtistTracks = result.current.tracks.filter(
      (t) => t.user.handle === 'sameartist'
    )
    expect(sameArtistTracks.length).toBeLessThanOrEqual(3)
  })

  it('resets when vibe changes', async () => {
    const { result, rerender } = renderHook(
      ({ vibe }) => useAudius(vibe),
      { initialProps: { vibe: 'lofi' } }
    )

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    rerender({ vibe: 'dnb' })

    // Should reset to index 0
    await vi.waitFor(() => {
      expect(result.current.currentIndex).toBe(0)
    })
  })

  it('jumpToIndex works within bounds', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => { result.current.jumpToIndex(5) })
    expect(result.current.currentIndex).toBe(5)
  })

  it('jumpToIndex ignores out-of-bounds', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => { result.current.jumpToIndex(9999) })
    expect(result.current.currentIndex).toBe(0) // unchanged
  })

  it('queueArtistTracks inserts after current position', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const newTracks = [
      { id: 'new-1', title: 'New 1', user: { handle: 'newartist' } },
      { id: 'new-2', title: 'New 2', user: { handle: 'newartist' } },
    ]

    act(() => { result.current.queueArtistTracks(newTracks) })

    // New tracks should be right after current index
    expect(result.current.tracks[1].id).toBe('new-1')
    expect(result.current.tracks[2].id).toBe('new-2')
  })

  it('queueArtistTracks deduplicates by ID', async () => {
    const { result } = renderHook(() => useAudius('lofi'))

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const existingId = result.current.tracks[0].id
    const newTracks = [
      { id: existingId, title: 'Dupe' },
      { id: 'genuinely-new', title: 'New' },
    ]

    const prevLength = result.current.tracks.length
    act(() => { result.current.queueArtistTracks(newTracks) })

    // Only 1 new track should be added (the dupe is skipped)
    expect(result.current.tracks.length).toBe(prevLength + 1)
  })
})
