import { useRef, useState, useEffect, useCallback } from 'react'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ZERO = { bass: 0, mid: 0, high: 0, pulse: 0, spectrum: null }

export function useAudioAnalyser(audioRef) {
  const [levels, setLevels] = useState(ZERO)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const rafRef = useRef(null)
  const connectedRef = useRef(false)

  // Beat detection state
  const prevBassRef = useRef(0)
  const beatDecayRef = useRef(0)
  const beatThreshold = 1.15 // bass must be 1.15x previous to trigger beat (catches every kick)

  const connect = useCallback(async () => {
    if (connectedRef.current || prefersReducedMotion) return
    const audio = audioRef.current
    if (!audio) return

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') await ctx.resume()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256 // 128 frequency bins
      analyser.smoothingTimeConstant = 0.8

      const source = ctx.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(ctx.destination)

      ctxRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = source
      connectedRef.current = true
    } catch {
      // Web Audio failed — levels stay at zero, background stays static
    }
  }, [audioRef])

  useEffect(() => {
    if (prefersReducedMotion) return
    const audio = audioRef.current
    if (!audio) return

    // Connect on first play (needs user gesture for AudioContext)
    const onPlay = () => {
      connect()
      if (ctxRef.current?.state === 'suspended') {
        ctxRef.current.resume().catch(() => {})
      }
    }
    audio.addEventListener('play', onPlay)

    // Frequency data buffer
    const freqData = new Uint8Array(128)

    const tick = () => {
      const analyser = analyserRef.current
      if (analyser) {
        analyser.getByteFrequencyData(freqData)

        // Split into bands (128 bins, ~86Hz per bin at 44.1kHz with fftSize 256)
        // Bass: bins 0-5 (~0-430Hz)
        let bassSum = 0
        for (let i = 0; i < 6; i++) bassSum += freqData[i]
        const bass = bassSum / (6 * 255)

        // Mid: bins 6-30 (~430Hz-2.6kHz)
        let midSum = 0
        for (let i = 6; i < 30; i++) midSum += freqData[i]
        const mid = midSum / (24 * 255)

        // High: bins 30-80 (~2.6kHz-6.9kHz)
        let highSum = 0
        for (let i = 30; i < 80; i++) highSum += freqData[i]
        const high = highSum / (50 * 255)

        // Beat detection: spike in bass relative to recent average
        const prevBass = prevBassRef.current
        if (bass > prevBass * beatThreshold && bass > 0.08) {
          beatDecayRef.current = 1.0
        }
        prevBassRef.current = prevBass * 0.9 + bass * 0.1 // smoothed average
        beatDecayRef.current *= 0.88 // slower decay so each kick is more visible

        // Build spectrum array for canvas visualizer (downsample to 64 bins)
        const spectrum = new Float32Array(64)
        for (let i = 0; i < 64; i++) {
          spectrum[i] = freqData[i * 2] / 255
        }

        setLevels({
          bass,
          mid,
          high,
          pulse: beatDecayRef.current,
          spectrum,
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      audio.removeEventListener('play', onPlay)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [audioRef, connect])

  return levels
}
