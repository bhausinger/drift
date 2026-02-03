import { getAudiusProfileUrl } from '../utils/audius'
import TrackActions from './TrackActions'

export default function TrackInfo({ track }) {
  const profileUrl = track ? getAudiusProfileUrl(track.user.handle) : null
  const artwork = track?.artwork?.['480x480'] || track?.artwork?.['1000x1000'] || track?.artwork?.['150x150']

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
          <TrackActions trackId={track.id} />
        </div>
      )}
    </div>
  )
}
