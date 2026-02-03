import { useState, useEffect, useRef, useCallback } from 'react'

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function ProgressBar({ audioRef }) {
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  const barRef = useRef(null)
  const prevSrc = useRef(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let raf
    const update = () => {
      // Reset when track source changes
      if (audio.src !== prevSrc.current) {
        prevSrc.current = audio.src
        setProgress(0)
        setCurrentTime(0)
        setDuration(0)
      }

      if (!dragging && audio.duration && isFinite(audio.duration)) {
        const p = audio.currentTime / audio.duration
        setProgress(p)
        setCurrentTime(audio.currentTime)
        setDuration(audio.duration)
      }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [audioRef, dragging])

  const seek = useCallback((clientX) => {
    const bar = barRef.current
    const audio = audioRef.current
    if (!bar || !audio || !audio.duration) return

    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
    setCurrentTime(ratio * audio.duration)
  }, [audioRef])

  const handlePointerDown = useCallback((e) => {
    setDragging(true)
    seek(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [seek])

  const handlePointerMove = useCallback((e) => {
    if (dragging) seek(e.clientX)
  }, [dragging, seek])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  return (
    <div className="w-full max-w-[300px] flex flex-col gap-1">
      {/* Bigger touch target — 44px tall invisible hit area around the 4px bar */}
      <div
        ref={barRef}
        className="relative h-11 flex items-center cursor-pointer group touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Track */}
        <div className="absolute left-0 right-0 h-1 bg-white/10 rounded-full">
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-colors group-hover:bg-white/50"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {/* Thumb — always visible on mobile, hover on desktop */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/60
                     sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress * 100}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/20 tabular-nums -mt-2">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
