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
      preloadRef.current.crossOrigin = 'anonymous'
    }
    preloadRef.current.src = nextStreamUrl
    preloadRef.current.load()
  }, [nextStreamUrl])

  // Preload next track's artwork so it appears instantly on skip
  useEffect(() => {
    const art = nextTrackData?.artwork?.['480x480'] || nextTrackData?.artwork?.['1000x1000'] || nextTrackData?.artwork?.['150x150']
    if (!art) return
    const img = new Image()
    img.src = art
  }, [nextTrackData])

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

  const crossfadeRef = useRef(null)

  const doCrossfade = useCallback((durationMs) => {
    const audio = audioRef.current
    const preload = preloadRef.current
    if (!audio || !preload || !preload.src) {
      // No preloaded track — hard skip
      if (audio) { audio.pause(); audio.removeAttribute('src') }
      setIsPlaying(false)
      wantsToPlay.current = true
      nextTrack()
      return
    }

    // Cancel any existing crossfade
    if (crossfadeRef.current) cancelAnimationFrame(crossfadeRef.current)

    // Grab the preloaded URL before we clear it
    const preloadedUrl = preload.src

    const startVol = audio.volume
    preload.volume = 0
    preload.play().then(() => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / durationMs, 1)
        audio.volume = startVol * (1 - t)
        preload.volume = startVol * t
        if (t < 1) {
          crossfadeRef.current = requestAnimationFrame(tick)
        } else {
          // Swap preloaded URL onto main element so streamUrl effect won't re-fetch
          preload.pause()
          preload.removeAttribute('src')
          audio.src = preloadedUrl
          audio.volume = startVol
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          wantsToPlay.current = true
          nextTrack()
        }
      }
      crossfadeRef.current = requestAnimationFrame(tick)
    }).catch(() => {
      if (durationMs <= 1000) {
        audio.pause()
        audio.removeAttribute('src')
        setIsPlaying(false)
        wantsToPlay.current = true
        nextTrack()
      }
    })
  }, [nextTrack])

  const handleSkip = useCallback(() => {
    userInteracted.current = true
    doCrossfade(300)
  }, [doCrossfade])

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

  const paletteLerpRef = useRef(null)

  const applyPalette = useCallback((v) => {
    const config = VIBES[v] || VIBES.lofi
    if (!config.palette) return

    // Cancel any in-progress lerp
    if (paletteLerpRef.current) cancelAnimationFrame(paletteLerpRef.current)

    const hexToRgb = (hex) => {
      const h = hex.replace('#', '')
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    const rgbToHex = (r, g, b) =>
      '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

    const style = getComputedStyle(document.documentElement)
    const entries = Object.entries(config.palette)

    // Get current values
    const from = entries.map(([prop]) => {
      const cur = style.getPropertyValue(prop).trim()
      try { return hexToRgb(cur) } catch { return null }
    })
    const to = entries.map(([, val]) => {
      try { return hexToRgb(val) } catch { return null }
    })

    const duration = 2000
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3)

      entries.forEach(([prop, val], i) => {
        if (!from[i] || !to[i]) {
          document.documentElement.style.setProperty(prop, val)
          return
        }
        const r = from[i][0] + (to[i][0] - from[i][0]) * ease
        const g = from[i][1] + (to[i][1] - from[i][1]) * ease
        const b = from[i][2] + (to[i][2] - from[i][2]) * ease
        document.documentElement.style.setProperty(prop, rgbToHex(r, g, b))
      })

      if (t < 1) {
        paletteLerpRef.current = requestAnimationFrame(tick)
      }
    }
    paletteLerpRef.current = requestAnimationFrame(tick)
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

  // Crossfade near track end (start 2.5s before end)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let started = false
    const onTimeUpdate = () => {
      if (!audio.duration || started) return
      if (audio.duration - audio.currentTime <= 2.5 && audio.duration > 5) {
        started = true
        doCrossfade(2500)
      }
    }
    const onEnded = () => {
      // Fallback if crossfade didn't trigger (short tracks, etc.)
      if (!started) {
        setIsPlaying(false)
        wantsToPlay.current = true
        nextTrack()
      }
    }
    const reset = () => { started = false }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadstart', reset)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadstart', reset)
    }
  }, [nextTrack, doCrossfade])

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
