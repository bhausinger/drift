import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 50
const DOUBLE_TAP_DELAY = 300

export function useGestures({ onSwipeUp, onSwipeDown, onSwipeLeft, onDoubleTapRight, onDoubleTapLeft }) {
  const touchStart = useRef(null)
  const lastTap = useRef({ time: 0, x: 0 })

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Determine if it was a swipe
    if (absDy > SWIPE_THRESHOLD && absDy > absDx) {
      if (dy < 0) onSwipeUp?.()
      else onSwipeDown?.()
      return
    }
    if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
      if (dx < 0) onSwipeLeft?.()
      return
    }

    // If not a swipe, check for double-tap
    const now = Date.now()
    const timeDiff = now - lastTap.current.time
    const tapX = t.clientX
    const screenMid = window.innerWidth / 2

    if (timeDiff < DOUBLE_TAP_DELAY) {
      if (tapX > screenMid) {
        onDoubleTapRight?.()
      } else {
        onDoubleTapLeft?.()
      }
      lastTap.current = { time: 0, x: 0 }
    } else {
      lastTap.current = { time: now, x: tapX }
    }
  }, [onSwipeUp, onSwipeDown, onSwipeLeft, onDoubleTapRight, onDoubleTapLeft])

  return { onTouchStart, onTouchEnd }
}
