import { getAudiusProfileUrl } from '../utils/audius'
import TrackActions from './TrackActions'

export default function TrackInfo({ track }) {
  const profileUrl = track ? getAudiusProfileUrl(track.user.handle) : null
  const artwork = track?.artwork?.['480x480'] || track?.artwork?.['150x150'] || track?.artwork?.['1000x1000']

  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-center space-y-3">
      {track && (
        <div key={track.id} className="animate-fade-in flex flex-col items-center space-y-3">
          <div className="w-20 h-20 flex-shrink-0">
            {artwork ? (
              <img
                src={artwork}
                alt=""
                className="w-20 h-20 rounded-lg object-cover opacity-60"
                onError={(e) => { e.target.style.visibility = 'hidden' }}
              />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-white/5" />
            )}
          </div>
          <h2 className="text-white/80 text-lg font-light tracking-wide max-w-[300px] leading-relaxed line-clamp-2">
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
          <TrackActions trackId={track.id} />
        </div>
      )}
    </div>
  )
}
