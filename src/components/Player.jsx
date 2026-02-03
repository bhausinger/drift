import { useRef, useState, useEffect, useCallback } from 'react'
import { useAudius } from '../hooks/useAudius'
import TrackInfo from './TrackInfo'
import Controls from './Controls'

export default function Player() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const wantsToPlay = useRef(false)

  const { currentTrack, streamUrl, nextTrack, isLoading, error } = useAudius()

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      wantsToPlay.current = false
    } else {
      // If src isn't set yet, set it now — synchronously within user gesture
      if (audio.src !== streamUrl) {
        audio.src = streamUrl
        audio.load()
      }
      wantsToPlay.current = true
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [isPlaying, streamUrl])

  const handleSkip = useCallback(() => {
    setIsPlaying(false)
    wantsToPlay.current = true
    nextTrack()
  }, [nextTrack])

  // When streamUrl changes (skip / auto-advance), load and play new track
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    if (audio.src === streamUrl) return

    audio.src = streamUrl
    audio.load()
    if (wantsToPlay.current) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [streamUrl])

  // Fallback: if play() was called before buffering, canplay retries
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onCanPlay = () => {
      if (wantsToPlay.current && audio.paused) {
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      }
    }
    audio.addEventListener('canplay', onCanPlay)
    return () => audio.removeEventListener('canplay', onCanPlay)
  }, [])

  // Auto-advance on track end
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onEnded = () => {
      setIsPlaying(false)
      wantsToPlay.current = true
      nextTrack()
    }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [nextTrack])

  const ready = !!streamUrl

  return (
    <div className="flex flex-col items-center gap-10">
      <audio ref={audioRef} preload="none" />

      {error && (
        <p className="text-red-400/60 text-xs">{error}</p>
      )}

      {isLoading && !currentTrack && (
        <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      )}

      <TrackInfo track={currentTrack} />

      <Controls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        disabled={!ready}
      />
    </div>
  )
}
