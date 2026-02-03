import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchTracks, getStreamUrl, blockTrack } from '../utils/audius'

export function useAudius(vibe) {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const offsetRef = useRef(0)
  const vibeRef = useRef(vibe)
  const lastArtistRef = useRef(null)

  const loadTracks = useCallback(async (v) => {
    setIsLoading(true)
    setError(null)
    try {
      const batch = await fetchTracks({ vibe: v, offset: offsetRef.current })
      if (batch.length === 0) {
        offsetRef.current = 0
        const fresh = await fetchTracks({ vibe: v, offset: 0 })
        setTracks(fresh)
        setCurrentIndex(0)
        return fresh
      } else {
        setTracks((prev) => [...prev, ...batch])
        offsetRef.current += batch.length
        return batch
      }
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
    offsetRef.current = 0
    lastArtistRef.current = null
    setTracks([])
    setCurrentIndex(0)
    loadTracks(vibe)
  }, [vibe, loadTracks])

  // Find the next valid index, skipping same-artist back-to-back
  const findNextIndex = useCallback((fromIndex, trackList) => {
    const lastArtist = lastArtistRef.current
    for (let i = fromIndex; i < trackList.length; i++) {
      if (!lastArtist || trackList[i].user?.handle !== lastArtist) {
        return i
      }
    }
    // If all remaining are same artist, just take the next one
    return fromIndex < trackList.length ? fromIndex : -1
  }, [])

  const nextTrack = useCallback(async () => {
    if (currentIndex + 1 >= tracks.length - 3) {
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
