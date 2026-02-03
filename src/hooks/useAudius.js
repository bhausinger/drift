import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchChill, getStreamUrl } from '../utils/audius'

export function useAudius() {
  const [tracks, setTracks] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const offsetRef = useRef(0)

  const loadTracks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const batch = await fetchChill({ offset: offsetRef.current })
      if (batch.length === 0) {
        offsetRef.current = 0
        const fresh = await fetchChill({ offset: 0 })
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

  // Preload tracks immediately on mount
  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  const nextTrack = useCallback(async () => {
    const nextIdx = currentIndex + 1
    // Prefetch more if running low
    if (nextIdx >= tracks.length - 3) {
      loadTracks()
    }
    setCurrentIndex((i) => {
      const next = i + 1
      return next < tracks.length ? next : i
    })
  }, [currentIndex, tracks.length, loadTracks])

  const currentTrack = tracks[currentIndex] || null
  const streamUrl = currentTrack ? getStreamUrl(currentTrack.id) : null

  return {
    currentTrack,
    streamUrl,
    nextTrack,
    isLoading,
    error,
  }
}
