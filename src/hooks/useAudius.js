import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchTracks, getStreamUrl, blockTrack, blockArtist, getBlockedArtists, addRecentlyPlayed } from '../utils/audius'

// Max tracks per artist in a single queue to prevent domination
const MAX_PER_ARTIST = 3

export function useAudius(vibe) {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const vibeRef = useRef(vibe)
  // Track last N artists to prevent A→B→A patterns
  const recentArtistsRef = useRef([])

  const loadTracks = useCallback(async (v) => {
    setIsLoading(true)
    setError(null)
    try {
      const batch = await fetchTracks({ vibe: v })
      const blockedArtists = getBlockedArtists()
      // Deduplicate by track ID when appending, filter blocked artists,
      // and cap tracks per artist to prevent one artist dominating the queue
      setTracks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id))
        const artistCounts = {}
        for (const t of prev) {
          const h = t.user?.handle
          if (h) artistCounts[h] = (artistCounts[h] || 0) + 1
        }
        const newTracks = batch.filter((t) => {
          if (existingIds.has(t.id)) return false
          if (blockedArtists.has(t.user?.handle)) return false
          const h = t.user?.handle
          if (h && (artistCounts[h] || 0) >= MAX_PER_ARTIST) return false
          if (h) artistCounts[h] = (artistCounts[h] || 0) + 1
          return true
        })
        if (prev.length === 0) return newTracks
        return [...prev, ...newTracks]
      })
      return batch
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Reset and load when vibe changes
  useEffect(() => {
    vibeRef.current = vibe
    recentArtistsRef.current = []
    setTracks([])
    setCurrentIndex(0)
    loadTracks(vibe)
  }, [vibe, loadTracks])

  // Find next index, skipping any of the last 5 artists. Looks ahead up to 20 tracks.
  const findNextIndex = useCallback((fromIndex, trackList) => {
    const recent = new Set(recentArtistsRef.current)
    if (recent.size === 0 || fromIndex >= trackList.length) {
      return fromIndex < trackList.length ? fromIndex : -1
    }

    const lookAhead = Math.min(20, trackList.length - fromIndex)
    for (let i = 0; i < lookAhead; i++) {
      const idx = fromIndex + i
      if (!recent.has(trackList[idx].user?.handle)) {
        return idx
      }
    }
    // Exhausted look-ahead — just take the next one
    return fromIndex
  }, [])

  const nextTrack = useCallback(async () => {
    // Prefetch more tracks when running low (bigger buffer = fewer mid-session fetches)
    if (currentIndex + 15 >= tracks.length) {
      loadTracks(vibeRef.current)
    }

    setCurrentIndex((i) => {
      const candidate = findNextIndex(i + 1, tracks)
      if (candidate >= 0 && candidate < tracks.length) {
        return candidate
      }
      return i
    })
  }, [currentIndex, tracks, loadTracks, findNextIndex])

  const prevTrack = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }, [])

  const blockCurrent = useCallback(() => {
    const track = tracks[currentIndex]
    if (track) {
      blockTrack(track.id)
      nextTrack()
    }
  }, [tracks, currentIndex, nextTrack])

  const blockCurrentArtist = useCallback(() => {
    const track = tracks[currentIndex]
    if (track?.user?.handle) {
      blockArtist(track.user.handle)
      // Remove all tracks by this artist from the queue
      const handle = track.user.handle
      setTracks((prev) => prev.filter((t) => t.user?.handle !== handle))
      nextTrack()
    }
  }, [tracks, currentIndex, nextTrack])

  // Insert tracks after current position, deduplicating by ID
  const queueArtistTracks = useCallback((newTracks) => {
    setTracks((prev) => {
      const existingIds = new Set(prev.map((t) => t.id))
      const unique = newTracks.filter((t) => !existingIds.has(t.id))
      if (unique.length === 0) return prev
      const insertAt = currentIndex + 1
      return [...prev.slice(0, insertAt), ...unique, ...prev.slice(insertAt)]
    })
  }, [currentIndex])

  // Jump to a specific index in the queue
  const jumpToIndex = useCallback((idx) => {
    if (idx >= 0 && idx < tracks.length) {
      setCurrentIndex(idx)
    }
  }, [tracks.length])

  const currentTrack = tracks[currentIndex] || null
  const nextIdx = findNextIndex(currentIndex + 1, tracks)
  const nextTrackData = nextIdx >= 0 ? tracks[nextIdx] : null
  const streamUrl = currentTrack ? getStreamUrl(currentTrack.id) : null
  const nextStreamUrl = nextTrackData ? getStreamUrl(nextTrackData.id) : null

  // Track recent artists (last 3) for dedup + mark as recently played
  useEffect(() => {
    if (currentTrack) {
      const handle = currentTrack.user?.handle
      if (handle) {
        const recent = recentArtistsRef.current
        // Only add if not already in the window
        if (!recent.includes(handle)) {
          recent.push(handle)
          if (recent.length > 5) recent.shift()
        }
      }
      addRecentlyPlayed(currentTrack.id)
    }
  }, [currentTrack])

  return {
    currentTrack,
    nextTrackData,
    streamUrl,
    nextStreamUrl,
    nextTrack,
    prevTrack,
    blockCurrent,
    blockCurrentArtist,
    queueArtistTracks,
    jumpToIndex,
    tracks,
    currentIndex,
    isLoading,
    error,
  }
}
