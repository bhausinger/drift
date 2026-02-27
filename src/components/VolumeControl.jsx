import { useState, useCallback } from 'react'

export default function VolumeControl({ audioRef }) {
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  const handleVolume = useCallback((e) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
    if (v > 0 && muted) setMuted(false)
  }, [audioRef, muted])

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    if (audioRef.current) audioRef.current.volume = next ? 0 : volume
  }, [audioRef, muted, volume])

  const displayVol = muted ? 0 : volume

  return (
    <div className="hidden sm:flex items-center gap-2">
      <button
        onClick={toggleMute}
        className="p-1.5 text-white/30 hover:text-white/50 transition-colors duration-300"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {displayVol === 0 ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          ) : displayVol < 0.5 ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          ) : (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={displayVol}
        onChange={handleVolume}
        className="w-20 h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50
                   [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5
                   [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white/50 [&::-moz-range-thumb]:border-0"
      />
    </div>
  )
}
