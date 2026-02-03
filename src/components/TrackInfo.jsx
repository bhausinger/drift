import { getAudiusProfileUrl } from '../utils/audius'
import TrackActions from './TrackActions'

export default function TrackInfo({ track }) {
  if (!track) return null

  const profileUrl = getAudiusProfileUrl(track.user.handle)

  return (
    <div key={track.id} className="animate-fade-in text-center space-y-2">
      <h2 className="text-white/80 text-lg font-light tracking-wide max-w-[300px] leading-relaxed">
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
  )
}
