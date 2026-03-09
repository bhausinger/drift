import { useRef, useState, useEffect, useCallback } from 'react'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ZERO = { bass: 0, mid: 0, high: 0, pulse: 0, spectrum: null }

// Module-level singletons — survives React StrictMode double-mount and HMR
let sharedCtx = null
let sharedSource = null
let sharedAnalyser = null
let sharedAudioEl = null

export function useAudioAnalyser(audioRef) {
  const [levels, setLevels] = useState(ZERO)
  const rafRef = useRef(null)
  const connectedRef = useRef(false)

  // Beat detection state
  const prevBassRef = useRef(0)
  const beatDecayRef = useRef(0)
  const beatThreshold = 1.15

  const connect = useCallback(() => {
    if (connectedRef.current || prefersReducedMotion) return
    const audio = audioRef.current
    if (!audio) return

    try {
      // Reuse existing context, or create new one
      if (!sharedCtx) {
        sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
      }
      if (sharedCtx.state === 'suspended') {
        sharedCtx.resume().catch(() => {})
      }

      // createMediaElementSource can only ever be called once per element
      if (!sharedSource || sharedAudioEl !== audio) {
        sharedSource = sharedCtx.createMediaElementSource(audio)
        sharedAudioEl = audio
      }

      // Create analyser if needed
      if (!sharedAnalyser) {
        sharedAnalyser = sharedCtx.createAnalyser()
        sharedAnalyser.fftSize = 256
        sharedAnalyser.smoothingTimeConstant = 0.8
        sharedSource.connect(sharedAnalyser)
        sharedAnalyser.connect(sharedCtx.destination)
      }

      connectedRef.current = true
    } catch {
      // Web Audio failed — audio still plays natively, levels stay at zero
    }
  }, [audioRef])

  useEffect(() => {
    if (prefersReducedMotion) return
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => {
      connect()
      if (sharedCtx?.state === 'suspended') {
        sharedCtx.resume().catch(() => {})
      }
    }
    audio.addEventListener('play', onPlay)

    const freqData = new Uint8Array(128)

    const tick = () => {
      if (sharedAnalyser) {
        sharedAnalyser.getByteFrequencyData(freqData)

        let bassSum = 0
        for (let i = 0; i < 6; i++) bassSum += freqData[i]
        const bass = bassSum / (6 * 255)

        let midSum = 0
        for (let i = 6; i < 30; i++) midSum += freqData[i]
        const mid = midSum / (24 * 255)

        let highSum = 0
        for (let i = 30; i < 80; i++) highSum += freqData[i]
        const high = highSum / (50 * 255)

        const prevBass = prevBassRef.current
        if (bass > prevBass * beatThreshold && bass > 0.08) {
          beatDecayRef.current = 1.0
        }
        prevBassRef.current = prevBass * 0.9 + bass * 0.1
        beatDecayRef.current *= 0.88

        const spectrum = new Float32Array(64)
        for (let i = 0; i < 64; i++) {
          spectrum[i] = freqData[i * 2] / 255
        }

        setLevels({ bass, mid, high, pulse: beatDecayRef.current, spectrum })
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
