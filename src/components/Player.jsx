import { useRef, useState, useEffect, useCallback } from 'react'
import { useAudius } from '../hooks/useAudius'
import { VIBES } from '../utils/audius'
import { useGestures } from '../hooks/useGestures'
import TrackInfo from './TrackInfo'
import Controls from './Controls'
import VolumeControl from './VolumeControl'
import VibeSelector from './VibeSelector'
import ProgressBar from './ProgressBar'
import QueuePanel from './QueuePanel'

export default function Player({ audioRef, playerStateRef, onArtworkChange }) {
  const preloadRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [vibe, setVibe] = useState('lofi')
  const wantsToPlay = useRef(false)
  const userInteracted = useRef(false)

  const [showQueue, setShowQueue] = useState(false)

  const { currentTrack, nextTrackData, streamUrl, nextStreamUrl, nextTrack, prevTrack, blockCurrent, blockCurrentArtist, queueArtistTracks, jumpToIndex, tracks, currentIndex, isLoading, error } = useAudius(vibe)

  // Hold previous track + next track on screen while loading new vibe
  const displayTrackRef = useRef(null)
  const displayNextRef = useRef(null)
  if (currentTrack) displayTrackRef.current = currentTrack
  if (nextTrackData) displayNextRef.current = nextTrackData
  const displayTrack = currentTrack || displayTrackRef.current
  const displayNext = nextTrackData || displayNextRef.current

  // Expose state to parent for handoff to Deep Dive
  useEffect(() => {
    if (playerStateRef) {
      playerStateRef.current = { currentTrack, isPlaying }
    }
  }, [currentTrack, isPlaying, playerStateRef])

  // Lift artwork URL to App for color extraction
  useEffect(() => {
    if (onArtworkChange) {
      onArtworkChange(currentTrack?.artwork?.['150x150'] || null)
    }
  }, [currentTrack, onArtworkChange])

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

  const applyPalette = useCallback((v) => {
    const config = VIBES[v] || VIBES.lofi
    if (config.palette) {
      for (const [prop, val] of Object.entries(config.palette)) {
        document.documentElement.style.setProperty(prop, val)
      }
    }
  }, [])

  // Apply palette on initial mount
  useEffect(() => { applyPalette(vibe) }, [])

  const handleVibeChange = useCallback((v) => {
    const audio = audioRef.current
    const wasPlaying = isPlaying || wantsToPlay.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    setIsPlaying(false)
    // Auto-play the new vibe's first track if user was already listening
    wantsToPlay.current = wasPlaying || userInteracted.current
    applyPalette(v)
    setVibe(v)
  }, [applyPalette, isPlaying])

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

  // Swipe gestures: left = skip, up = open DJ (not wired here)
  const gestures = useGestures({
    onSwipeLeft: handleSkip,
  })

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); handlePlayPause() }
      if (e.code === 'ArrowRight') handleSkip()
      if (e.code === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlePlayPause, handleSkip, handlePrev])

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-5 w-full max-w-md px-4" {...gestures}>
      <VibeSelector current={vibe} onChange={handleVibeChange} />

      {error && <p className="text-red-400/60 text-xs">{error}</p>}

      {isLoading && !displayTrack && (
        <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      )}

      <TrackInfo track={displayTrack} onBlockArtist={() => {
        const audio = audioRef.current
        if (audio) { audio.pause(); audio.removeAttribute('src') }
        setIsPlaying(false)
        wantsToPlay.current = true
        blockCurrentArtist()
      }} onQueueArtistTracks={queueArtistTracks} />

      <ProgressBar audioRef={audioRef} />

      <Controls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onSkip={handleSkip}
        onPrev={handlePrev}
        disabled={!ready}
      />

      <VolumeControl audioRef={audioRef} />

      <div className="flex items-center gap-2 h-4">
        <p className="text-white/30 text-[10px] tracking-wider">
          {displayNext ? `up next: ${displayNext.title} — ${displayNext.user?.name}` : '\u00A0'}
        </p>
        <button
          onClick={() => setShowQueue((v) => !v)}
          className="p-1 -m-1 text-white/30 hover:text-white/50 transition-colors"
          aria-label="Toggle queue"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>

      {showQueue && (
        <QueuePanel
          tracks={tracks}
          currentIndex={currentIndex}
          onJump={(idx) => {
            const audio = audioRef.current
            if (audio) { audio.pause(); audio.removeAttribute('src') }
            setIsPlaying(false)
            wantsToPlay.current = true
            userInteracted.current = true
            jumpToIndex(idx)
          }}
          onClose={() => setShowQueue(false)}
        />
      )}
    </div>
  )
}
