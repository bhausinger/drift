import { useState, useCallback, useEffect, useRef } from 'react'
import { getAudiusProfileUrl, addToDraftPlaylist, blockArtist, getImageFallback } from '../utils/audius'
import TrackActions from './TrackActions'

export default function TrackInfo({ track, onBlockArtist }) {
  const profileUrl = track ? getAudiusProfileUrl(track.user.handle) : null
  const artwork = track?.artwork?.['480x480'] || track?.artwork?.['1000x1000'] || track?.artwork?.['150x150']

  const [menuOpen, setMenuOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const menuRef = useRef(null)

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  // Reset added state when track changes
  useEffect(() => { setAdded(false); setMenuOpen(false) }, [track?.id])

  const handleAdd = useCallback(() => {
    if (!track) return
    addToDraftPlaylist(track)
    setAdded(true)
    setTimeout(() => setMenuOpen(false), 600)
  }, [track])

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-4">
      {track && (
        <div key={track.id} className="animate-fade-in flex flex-col items-center space-y-4">
          <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/30">
            {artwork ? (
              <img
                src={artwork}
                alt=""
                className="w-full h-full object-cover opacity-80"
                onError={(e) => {
                  const img = e.target
                  if (!img.dataset.fallbackAttempted) {
                    const fallback = getImageFallback(img.src)
                    if (fallback) { img.dataset.fallbackAttempted = '1'; img.src = fallback; return }
                  }
                  img.style.visibility = 'hidden'
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
          <div className="space-y-1.5 max-w-[300px]">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-white/80 text-lg font-light tracking-wide leading-relaxed line-clamp-2">
                {track.title}
              </h2>
              {/* Three-dot menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1 text-white/25 hover:text-white/50 transition-colors duration-200"
                  aria-label="Track options"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {menuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 bg-black/80 backdrop-blur-md
                               border border-white/10 rounded-lg shadow-xl shadow-black/50 py-1 min-w-[170px]"
                  >
                    <button
                      onClick={handleAdd}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors
                        ${added ? 'text-purple-300/80' : 'text-white/80 hover:bg-white/[0.06] hover:text-white'}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {added ? 'Added to playlist' : 'Add to playlist'}
                    </button>
                    <button
                      onClick={() => {
                        if (!track?.user?.handle) return
                        blockArtist(track.user.handle)
                        setMenuOpen(false)
                        if (onBlockArtist) onBlockArtist(track)
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      Hide artist
                    </button>
                  </div>
                )}
              </div>
            </div>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-white/30 text-xs tracking-wider
                         hover:text-white/50 transition-colors duration-500"
            >
              {track.user.name}
            </a>
          </div>
          <TrackActions trackId={track.id} permalink={track.permalink} />
        </div>
      )}
    </div>
  )
}
