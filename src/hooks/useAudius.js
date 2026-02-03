import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchTracks, getStreamUrl } from '../utils/audius'

export function useAudius(vibe) {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const offsetRef = useRef(0)
  const vibeRef = useRef(vibe)

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
    setTracks([])
    setCurrentIndex(0)
    loadTracks(vibe)
  }, [vibe, loadTracks])

  const nextTrack = useCallback(async () => {
    if (currentIndex + 1 >= tracks.length - 3) {
      loadTracks(vibeRef.current)
    }
    setCurrentIndex((i) => {
      const next = i + 1
      return next < tracks.length ? next : i
    })
  }, [currentIndex, tracks.length, loadTracks])

  const currentTrack = tracks[currentIndex] || null
  const nextTrackData = tracks[currentIndex + 1] || null
  const streamUrl = currentTrack ? getStreamUrl(currentTrack.id) : null
  const nextStreamUrl = nextTrackData ? getStreamUrl(nextTrackData.id) : null

  return {
    currentTrack,
    streamUrl,
    nextStreamUrl,
    nextTrack,
    isLoading,
    error,
  }
}
