import { useRef, useState, useEffect, useCallback } from 'react'

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useParallax() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const rafRef = useRef(null)
  const targetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (prefersReducedMotion) return

    const onMouseMove = (e) => {
      targetRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      }
    }

    const onOrientation = (e) => {
      const gamma = Math.max(-15, Math.min(15, e.gamma || 0))
      const beta = Math.max(-15, Math.min(15, (e.beta || 0) - 45))
      targetRef.current = {
        x: gamma / 15,
        y: beta / 15,
      }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('deviceorientation', onOrientation, { passive: true })

    const tick = () => {
      setOffset((prev) => {
        const t = targetRef.current
        // Lerp for smoothness
        const nx = prev.x + (t.x - prev.x) * 0.08
        const ny = prev.y + (t.y - prev.y) * 0.08
        // Skip update if barely changed
        if (Math.abs(nx - prev.x) < 0.0005 && Math.abs(ny - prev.y) < 0.0005) return prev
        return { x: nx, y: ny }
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('deviceorientation', onOrientation)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return offset
}
