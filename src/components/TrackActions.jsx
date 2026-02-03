import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function TrackActions({ trackId }) {
  const { user, sdk } = useAuth()
  const [liked, setLiked] = useState(false)
  const [reposted, setReposted] = useState(false)

  const handleLike = useCallback(async () => {
    if (!sdk || !user) return
    const next = !liked
    setLiked(next)
    try {
      if (next) {
        await sdk.tracks.favoriteTrack({ userId: user.userId, trackId })
      } else {
        await sdk.tracks.unfavoriteTrack({ userId: user.userId, trackId })
      }
    } catch {
      setLiked(!next)
    }
  }, [sdk, user, trackId, liked])

  const handleRepost = useCallback(async () => {
    if (!sdk || !user) return
    const next = !reposted
    setReposted(next)
    try {
      if (next) {
        await sdk.tracks.repostTrack({ userId: user.userId, trackId })
      } else {
        await sdk.tracks.unrepostTrack({ userId: user.userId, trackId })
      }
    } catch {
      setReposted(!next)
    }
  }, [sdk, user, trackId, reposted])

  if (!user) return null

  return (
    <div className="flex items-center gap-4 justify-center mt-2">
      {/* Like */}
      <button
        onClick={handleLike}
        className="transition-all duration-200 active:scale-125"
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="2"
          className={`transition-colors duration-300 ${liked ? 'text-pink-400/80' : 'text-white/25 hover:text-white/50'}`}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Repost */}
      <button
        onClick={handleRepost}
        className="transition-all duration-200 active:scale-125"
        aria-label={reposted ? 'Undo repost' : 'Repost'}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor" strokeWidth="2"
          className={`transition-colors duration-300 ${reposted ? 'text-emerald-400/80' : 'text-white/25 hover:text-white/50'}`}
        >
          <path d="M17 1l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 23l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </button>
    </div>
  )
}
