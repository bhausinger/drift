import { useRef, useState, useEffect, useCallback } from 'react'
import { useAudius } from '../hooks/useAudius'
import TrackInfo from './TrackInfo'
import Controls from './Controls'
import VibeSelector from './VibeSelector'
import ProgressBar from './ProgressBar'

export default function Player() {
  const audioRef = useRef(null)
  const preloadRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [vibe, setVibe] = useState('lofi')
  const wantsToPlay = useRef(false)

  const { currentTrack, streamUrl, nextStreamUrl, nextTrack, isLoading, error } = useAudius(vibe)

  // Preload next track in a hidden audio element
  useEffect(() => {
    if (!nextStreamUrl) return
    if (!preloadRef.current) {
      preloadRef.current = new Audio()
      preloadRef.current.preload = 'auto'
    }
    preloadRef.current.src = nextStreamUrl
    preloadRef.current.load()
  }, [nextStreamUrl])

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      wantsToPlay.current = false
    } else {
      if (audio.src !== streamUrl) {
        audio.src = streamUrl
        audio.load()
      }
      wantsToPlay.current = true
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }, [isPlaying, streamUrl])

  const handleSkip = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    wantsToPlay.current = true
    nextTrack()
  }, [nextTrack])

  const handleVibeChange = useCallback((v) => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    wantsToPlay.current = false
    setVibe(v)
  }, [])

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

  // Retry play when buffered enough
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

  // Auto-skip on stream error
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onError = () => {
      if (wantsToPlay.current) {
        nextTrack()
      }
    }
    audio.addEventListener('error', onError)
    return () => audio.removeEventListener('error', onError)
  }, [nextTrack])

  // Stall recovery — if stuck buffering for 5s, skip
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let stallTimer = null
    const onWaiting = () => {
      stallTimer = setTimeout(() => {
        if (wantsToPlay.current && audio.paused) {
          nextTrack()
        }
      }, 5000)
    }
    const onPlaying = () => {
      clearTimeout(stallTimer)
    }
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    return () => {
      clearTimeout(stallTimer)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
    }
  }, [nextTrack])

  const ready = !!streamUrl

  return (
    <div className="flex flex-col items-center gap-10">
      <audio ref={audioRef} preload="auto" />

      <VibeSelector current={vibe} onChange={handleVibeChange} />

      {error && (
        <p className="text-red-400/60 text-xs">{error}</p>
      )}

      {isLoading && !currentTrack && (
        <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      )}

      <TrackInfo track={currentTrack} />

      <ProgressBar audioRef={audioRef} />

      <Controls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        disabled={!ready}
      />
    </div>
  )
}
