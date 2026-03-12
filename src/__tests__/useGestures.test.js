import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGestures } from '../hooks/useGestures'

function makeTouchEvent(type, x, y) {
  const touch = { clientX: x, clientY: y }
  return {
    touches: [touch],
    changedTouches: [touch],
    preventDefault: vi.fn(),
  }
}

describe('useGestures', () => {
  it('detects swipe left', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeLeft }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 200, 100))
    result.current.onTouchEnd(makeTouchEvent('touchend', 100, 100)) // dx = -100

    expect(onSwipeLeft).toHaveBeenCalledOnce()
  })

  it('detects swipe up', () => {
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeUp }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 200))
    result.current.onTouchEnd(makeTouchEvent('touchend', 100, 100)) // dy = -100

    expect(onSwipeUp).toHaveBeenCalledOnce()
  })

  it('ignores small movements (below threshold)', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeLeft, onSwipeUp }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 100))
    result.current.onTouchEnd(makeTouchEvent('touchend', 80, 90)) // dx=-20, dy=-10

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeUp).not.toHaveBeenCalled()
  })

  it('does not trigger swipe right', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeLeft }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 100))
    result.current.onTouchEnd(makeTouchEvent('touchend', 200, 100)) // dx = +100 (right)

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('does not trigger swipe down', () => {
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeUp }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 100))
    result.current.onTouchEnd(makeTouchEvent('touchend', 100, 200)) // dy = +100 (down)

    expect(onSwipeUp).not.toHaveBeenCalled()
  })

  it('prefers vertical when dy > dx', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useGestures({ onSwipeLeft, onSwipeUp }))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 200))
    result.current.onTouchEnd(makeTouchEvent('touchend', 50, 100)) // dx=-50, dy=-100

    // Vertical wins since |dy| > |dx|
    expect(onSwipeUp).toHaveBeenCalledOnce()
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('prevents pull-to-refresh on downward move', () => {
    const { result } = renderHook(() => useGestures({}))

    result.current.onTouchStart(makeTouchEvent('touchstart', 100, 100))
    const moveEvent = makeTouchEvent('touchmove', 100, 120) // dy = +20
    result.current.onTouchMove(moveEvent)

    expect(moveEvent.preventDefault).toHaveBeenCalled()
  })
})
