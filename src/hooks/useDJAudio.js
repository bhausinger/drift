import { useState, useCallback, useEffect, useRef } from 'react'
import { getStreamUrl } from '../utils/audius'

export function useDJAudio(audioRef, handoffTrackRef, isActive) {
  const [nowPlaying, setNowPlaying] = useState(() => handoffTrackRef?.current?.currentTrack || null)
  const [isPlaying, setIsPlaying] = useState(() => handoffTrackRef?.current?.isPlaying || false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    try { return parseFloat(localStorage.getItem('drift:volume') ?? '1') } catch { return 1 }
  })
  const [repeatMode, setRepeatMode] = useState('off')

  // Refs to avoid stale closures in audio event handlers
  const nowPlayingRef = useRef(null)
  const resultsRef = useRef([])
  const repeatRef = useRef('off')

  // Sync from Vibe handoff when Deep Dive becomes active
  const wasActiveRef = useRef(isActive)
  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      const handoff = handoffTrackRef?.current
      if (handoff?.currentTrack) {
        setNowPlaying(handoff.currentTrack)
        setIsPlaying(handoff.isPlaying || false)
        const audio = audioRef.current
        if (audio) {
          setCurrentTime(audio.currentTime || 0)
          setDuration(audio.duration || 0)
        }
      }
    }
    wasActiveRef.current = isActive
  }, [isActive])

  // Keep refs in sync
  useEffect(() => { nowPlayingRef.current = nowPlaying }, [nowPlaying])
  useEffect(() => { repeatRef.current = repeatMode }, [repeatMode])

  // Expose setResultsList so parent can update the track list used for auto-advance
  const setResultsList = useCallback((list) => { resultsRef.current = list }, [])

  const handlePreview = useCallback((track) => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    if (nowPlaying?.id === track.id) {
      if (isPlaying) { audio.pause(); setIsPlaying(false) }
      else { audio.play().catch(() => {}); setIsPlaying(true) }
      return
    }
    audio.src = getStreamUrl(track.id)
    audio.load()
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    setNowPlaying(track)
  }, [nowPlaying, isPlaying, volume])

  // Keep audio volume in sync
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume
    localStorage.setItem('drift:volume', String(volume))
  }, [volume])

  // Track audio time updates + ended handler
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      const currentResults = resultsRef.current
      const current = nowPlayingRef.current
      const repeat = repeatRef.current

      if (repeat === 'one' && current) {
        audio.currentTime = 0
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        return
      }
      if (current && currentResults.length > 0) {
        const idx = currentResults.findIndex((t) => t.id === current.id)
        if (idx >= 0 && idx + 1 < currentResults.length) {
          const next = currentResults[idx + 1]
          audio.src = getStreamUrl(next.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(next)
          setCurrentTime(0)
          return
        }
        if (repeat === 'all' && currentResults.length > 0) {
          const first = currentResults[0]
          audio.src = getStreamUrl(first.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(first)
          setCurrentTime(0)
          return
        }
      }
      setNowPlaying(null); setIsPlaying(false); setCurrentTime(0); setDuration(0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  const handleNext = useCallback((trackList) => {
    if (!nowPlaying || trackList.length === 0) return
    const idx = trackList.findIndex((t) => t.id === nowPlaying.id)
    const nextIdx = idx >= 0 && idx + 1 < trackList.length ? idx + 1 : 0
    handlePreview(trackList[nextIdx])
  }, [nowPlaying, handlePreview])

  const handlePrev = useCallback((trackList) => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return }
    if (!nowPlaying || trackList.length === 0) return
    const idx = trackList.findIndex((t) => t.id === nowPlaying.id)
    const prevIdx = idx > 0 ? idx - 1 : trackList.length - 1
    handlePreview(trackList[prevIdx])
  }, [nowPlaying, handlePreview])

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')
  }, [])

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return {
    nowPlaying, setNowPlaying,
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration,
    volume, setVolume,
    repeatMode, cycleRepeat,
    handlePreview,
    handleNext, handlePrev,
    progressPct,
    setResultsList,
  }
}
