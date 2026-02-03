import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchTracks, getStreamUrl, blockTrack } from '../utils/audius'

export function useAudius(vibe) {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const vibeRef = useRef(vibe)
  const lastArtistRef = useRef(null)

  const loadTracks = useCallback(async (v) => {
    setIsLoading(true)
    setError(null)
    try {
      const batch = await fetchTracks({ vibe: v })
      // Deduplicate by track ID when appending
      setTracks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id))
        const newTracks = batch.filter((t) => !existingIds.has(t.id))
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
    lastArtistRef.current = null
    setTracks([])
    setCurrentIndex(0)
    loadTracks(vibe)
  }, [vibe, loadTracks])

  // Find next index, preferring a different artist (look ahead up to 5 tracks)
  const findNextIndex = useCallback((fromIndex, trackList) => {
    const lastArtist = lastArtistRef.current
    if (!lastArtist || fromIndex >= trackList.length) {
      return fromIndex < trackList.length ? fromIndex : -1
    }

    // Look ahead up to 5 tracks for a different artist
    const lookAhead = Math.min(5, trackList.length - fromIndex)
    for (let i = 0; i < lookAhead; i++) {
      const idx = fromIndex + i
      if (trackList[idx].user?.handle !== lastArtist) {
        return idx
      }
    }
    // If all 5 are same artist, just take the next one anyway
    return fromIndex
  }, [])

  const nextTrack = useCallback(async () => {
    // Prefetch more tracks when running low
    if (currentIndex + 5 >= tracks.length) {
      loadTracks(vibeRef.current)
    }

    setCurrentIndex((i) => {
      const candidate = findNextIndex(i + 1, tracks)
      if (candidate >= 0 && candidate < tracks.length) {
        lastArtistRef.current = tracks[candidate].user?.handle
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

  const currentTrack = tracks[currentIndex] || null
  const nextIdx = findNextIndex(currentIndex + 1, tracks)
  const nextTrackData = nextIdx >= 0 ? tracks[nextIdx] : null
  const streamUrl = currentTrack ? getStreamUrl(currentTrack.id) : null
  const nextStreamUrl = nextTrackData ? getStreamUrl(nextTrackData.id) : null

  // Track last artist for dedup
  useEffect(() => {
    if (currentTrack) {
      lastArtistRef.current = currentTrack.user?.handle
    }
  }, [currentTrack])

  return {
    currentTrack,
    streamUrl,
    nextStreamUrl,
    nextTrack,
    prevTrack,
    blockCurrent,
    isLoading,
    error,
  }
}
