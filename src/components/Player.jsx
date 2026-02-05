import { useRef, useState, useEffect, useCallback } from 'react'
import { useAudius } from '../hooks/useAudius'
import TrackInfo from './TrackInfo'
import Controls from './Controls'
import VibeSelector from './VibeSelector'
import ProgressBar from './ProgressBar'

export default function Player({ audioRef, playerStateRef }) {
  const preloadRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [vibe, setVibe] = useState('lofi')
  const wantsToPlay = useRef(false)
  const userInteracted = useRef(false)

  const { currentTrack, streamUrl, nextStreamUrl, nextTrack, prevTrack, blockCurrent, blockCurrentArtist, isLoading, error } = useAudius(vibe)

  // Expose state to parent for handoff to Deep Dive
  useEffect(() => {
    if (playerStateRef) {
      playerStateRef.current = { currentTrack, isPlaying }
    }
  }, [currentTrack, isPlaying, playerStateRef])

  // Preload next track
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
    userInteracted.current = true

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
    userInteracted.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    wantsToPlay.current = true
    nextTrack()
  }, [nextTrack])

  const handlePrev = useCallback(() => {
    userInteracted.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    wantsToPlay.current = true
    prevTrack()
  }, [prevTrack])

  const handleBlock = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    wantsToPlay.current = true
    blockCurrent()
  }, [blockCurrent])

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

  // On mount, if audio is already playing (returning from Deep Dive), sync state
  const didInitialSync = useRef(false)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || didInitialSync.current) return
    didInitialSync.current = true
    if (!audio.paused && audio.src) {
      setIsPlaying(true)
      wantsToPlay.current = true
    }
  }, [])

  // When streamUrl changes, load and play
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    if (audio.src === streamUrl) return

    // On first mount after Deep Dive, don't override audio that's already playing
    if (!audio.paused && audio.src && didInitialSync.current && !userInteracted.current) return

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
    const onError = () => { if (wantsToPlay.current) nextTrack() }
    audio.addEventListener('error', onError)
    return () => audio.removeEventListener('error', onError)
  }, [nextTrack])

  // Stall recovery
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let stallTimer = null
    const onWaiting = () => {
      stallTimer = setTimeout(() => {
        if (wantsToPlay.current && audio.paused) nextTrack()
      }, 5000)
    }
    const onPlaying = () => clearTimeout(stallTimer)
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
    <div className="flex flex-col items-center gap-6 sm:gap-8 w-full max-w-md px-4">
      <VibeSelector current={vibe} onChange={handleVibeChange} />

      {error && (
        <p className="text-red-400/60 text-xs">{error}</p>
      )}

      {isLoading && !currentTrack && (
        <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      )}

      <TrackInfo track={currentTrack} onBlockArtist={() => {
        const audio = audioRef.current
        if (audio) { audio.pause(); audio.removeAttribute('src') }
        setIsPlaying(false)
        wantsToPlay.current = true
        blockCurrentArtist()
      }} />

      <ProgressBar audioRef={audioRef} />

      <Controls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        onPrev={handlePrev}
        disabled={!ready}
      />
    </div>
  )
}
