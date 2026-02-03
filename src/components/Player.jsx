import { useRef, useState, useEffect, useCallback } from 'react'
import { useAudius } from '../hooks/useAudius'
import { useGestures } from '../hooks/useGestures'
import TrackInfo from './TrackInfo'
import Controls from './Controls'
import VibeSelector from './VibeSelector'
import ProgressBar from './ProgressBar'

export default function Player() {
  const audioRef = useRef(null)
  const preloadRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [vibe, setVibe] = useState('lofi')
  const [gestureHint, setGestureHint] = useState(null)
  const wantsToPlay = useRef(false)
  const hintTimer = useRef(null)

  const { currentTrack, streamUrl, nextStreamUrl, nextTrack, prevTrack, blockCurrent, isLoading, error } = useAudius(vibe)

  // Flash a gesture hint briefly
  const showHint = useCallback((text) => {
    setGestureHint(text)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setGestureHint(null), 800)
  }, [])

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

  const handlePrev = useCallback(() => {
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
    showHint('blocked')
    blockCurrent()
  }, [blockCurrent, showHint])

  const handleSeekForward = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.duration) {
      audio.currentTime = Math.min(audio.currentTime + 10, audio.duration)
      showHint('+10s')
    }
  }, [showHint])

  const handleSeekBack = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = Math.max(audio.currentTime - 10, 0)
      showHint('-10s')
    }
  }, [showHint])

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

  // Gestures
  const gestures = useGestures({
    onSwipeUp: () => { showHint('skip'); handleSkip() },
    onSwipeDown: () => { showHint('previous'); handlePrev() },
    onSwipeLeft: handleBlock,
    onDoubleTapRight: handleSeekForward,
    onDoubleTapLeft: handleSeekBack,
  })

  // When streamUrl changes, load and play
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
    <div
      className="flex flex-col items-center gap-6 sm:gap-10 w-full max-w-md px-4 select-none touch-manipulation"
      {...gestures}
    >
      <audio ref={audioRef} preload="auto" />

      {/* Gesture hint overlay */}
      {gestureHint && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <span className="text-white/40 text-sm tracking-widest uppercase animate-fade-in">
            {gestureHint}
          </span>
        </div>
      )}

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
        onBlock={blockCurrent}
        disabled={!ready}
      />
    </div>
  )
}
