import { useState, useCallback } from 'react'
import { getAudiusProfileUrl } from '../utils/audius'
import TrackActions from './TrackActions'

export default function TrackInfo({ track }) {
  const profileUrl = track ? getAudiusProfileUrl(track.user.handle) : null
  const artwork = track?.artwork?.['480x480'] || track?.artwork?.['1000x1000'] || track?.artwork?.['150x150']
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(() => {
    if (!track?.permalink) return
    const url = `https://audius.co${track.permalink}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
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
                onError={(e) => { e.target.style.visibility = 'hidden' }}
              />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
          <div className="space-y-1.5 max-w-[300px]">
            <h2 className="text-white/80 text-lg font-light tracking-wide leading-relaxed line-clamp-2">
              {track.title}
            </h2>
            <div className="flex items-center justify-center gap-3">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 text-xs tracking-wider
                           hover:text-white/50 transition-colors duration-500"
              >
                {track.user.name}
              </a>
              <button
                onClick={handleShare}
                className="transition-all duration-200 active:scale-110"
                aria-label="Copy Audius link"
                title="Copy Audius link"
              >
                {copied ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5"
                       className="text-emerald-400/70">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2"
                       className="text-white/20 hover:text-white/50 transition-colors duration-300">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <TrackActions trackId={track.id} />
        </div>
      )}
    </div>
  )
}
