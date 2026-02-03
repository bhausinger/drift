import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

export function useGestures({ onSwipeUp, onSwipeLeft }) {
  const touchStart = useRef(null)

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchMove = useCallback((e) => {
    // Prevent pull-to-refresh on swipe down
    if (!touchStart.current) return
    const dy = e.touches[0].clientY - touchStart.current.y
    if (dy > 10) e.preventDefault()
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDy > SWIPE_THRESHOLD && absDy > absDx) {
      if (dy < 0) onSwipeUp?.()
      return
    }
    if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
      if (dx < 0) onSwipeLeft?.()
      return
    }
  }, [onSwipeUp, onSwipeLeft])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
