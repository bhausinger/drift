import { useEffect, useRef } from 'react'
import { getImageFallback } from '../utils/audius'

export default function QueuePanel({ tracks, currentIndex, onJump, onClose }) {
  const listRef = useRef(null)
  const currentRowRef = useRef(null)

  // Auto-scroll to current track on open
  useEffect(() => {
    if (currentRowRef.current && listRef.current) {
      currentRowRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel — right slide on desktop, bottom sheet on mobile */}
      <div className="fixed z-50
                      bottom-0 left-0 right-0 max-h-[70vh]
                      sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:max-h-none sm:h-full sm:w-80
                      bg-black/80 backdrop-blur-md border-t sm:border-t-0 sm:border-l border-white/10
                      flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h3 className="text-white/70 text-sm tracking-wider uppercase font-light">Queue</h3>
          <button
            onClick={onClose}
            className="p-1.5 -m-1 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Close queue"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Track list */}
        <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain">
          {tracks.map((track, idx) => {
            const isCurrent = idx === currentIndex
            const isPast = idx < currentIndex
            const isFuture = idx > currentIndex
            const artwork = track.artwork?.['150x150']

            return (
              <button
                key={track.id}
                ref={isCurrent ? currentRowRef : null}
                onClick={() => { if (isFuture) onJump(idx) }}
                disabled={isPast}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                  ${isCurrent ? 'border-l-2 border-purple-400/80 bg-white/[0.04]' : 'border-l-2 border-transparent'}
                  ${isFuture ? 'hover:bg-white/[0.06] cursor-pointer' : ''}
                  ${isPast ? 'cursor-default' : ''}`}
              >
                {/* Artwork thumbnail */}
                <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden bg-white/5">
                  {artwork && (
                    <img
                      src={artwork}
                      alt=""
                      className={`w-full h-full object-cover ${isPast ? 'opacity-25' : isCurrent ? 'opacity-90' : 'opacity-60'}`}
                      onError={(e) => {
                        const img = e.target
                        if (!img.dataset.fallbackAttempted) {
                          const fallback = getImageFallback(img.src)
                          if (fallback) { img.dataset.fallbackAttempted = '1'; img.src = fallback; return }
                        }
                        img.style.visibility = 'hidden'
                      }}
                    />
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate leading-snug
                    ${isCurrent ? 'text-white/90' : isPast ? 'text-white/35' : 'text-white/60'}`}>
                    {track.title}
                  </p>
                  <p className={`text-[11px] truncate leading-snug
                    ${isCurrent ? 'text-white/50' : isPast ? 'text-white/25' : 'text-white/30'}`}>
                    {track.user?.name}
                  </p>
                </div>

                {/* Current indicator */}
                {isCurrent && (
                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400/80" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
