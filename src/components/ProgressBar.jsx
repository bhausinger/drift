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

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let raf
    const update = () => {
      if (!dragging && audio.duration) {
        setProgress(audio.currentTime / audio.duration)
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
      <div
        ref={barRef}
        className="relative h-1 bg-white/10 rounded-full cursor-pointer group"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="absolute inset-y-0 left-0 bg-white/30 rounded-full transition-colors group-hover:bg-white/50"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress * 100}% - 5px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/20 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
