import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API_HOST = 'https://api.audius.co'
const APP_NAME = 'drift'

async function trackAction(action, userId, trackId) {
  const res = await fetch('/api/track-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userId, trackId }),
  })
  if (!res.ok) throw new Error('Action failed')
}

export default function TrackActions({ trackId, permalink, menuButton }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [reposted, setReposted] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch existing like/repost state when track changes
  useEffect(() => {
    setLiked(false)
    setReposted(false)
    if (!user?.userId || !trackId) return

    let cancelled = false
    const checkState = async () => {
      try {
        const [favRes, repostRes] = await Promise.all([
          fetch(`${API_HOST}/v1/users/${user.userId}/favorites?app_name=${APP_NAME}`).then(r => r.ok ? r.json() : { data: [] }),
          fetch(`${API_HOST}/v1/users/${user.userId}/reposts?app_name=${APP_NAME}&limit=50`).then(r => r.ok ? r.json() : { data: [] }),
        ])
        if (cancelled) return
        const favIds = new Set((favRes.data || []).map(t => t.favorite_item_id || t.id))
        const repostIds = new Set((repostRes.data || []).map(t => t.repost_item_id || t.id))
        setLiked(favIds.has(trackId))
        setReposted(repostIds.has(trackId))
      } catch {
        // Silently fail — icons just start unhighlighted
      }
    }
    checkState()
    return () => { cancelled = true }
  }, [trackId, user?.userId])

  const handleLike = useCallback(async () => {
    if (!user) return
    const next = !liked
    setLiked(next)
    try {
      await trackAction(next ? 'favorite' : 'unfavorite', user.userId, trackId)
    } catch {
      setLiked(!next)
    }
  }, [user, trackId, liked])

  const handleRepost = useCallback(async () => {
    if (!user) return
    const next = !reposted
    setReposted(next)
    try {
      await trackAction(next ? 'repost' : 'unrepost', user.userId, trackId)
    } catch {
      setReposted(!next)
    }
  }, [user, trackId, reposted])

  const handleShare = useCallback(() => {
    if (!permalink) return
    const url = `https://audius.co${permalink}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [permalink])

  return (
    <div className="flex items-center gap-1 justify-center -my-1">
      {user && (
        <>
          <button
            onClick={handleLike}
            className="p-2.5 transition-all duration-200 active:scale-125"
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2"
              className={`transition-colors duration-300 ${liked ? 'text-pink-400/80' : 'text-white/35 hover:text-white/55'}`}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          <button
            onClick={handleRepost}
            className="p-2.5 transition-all duration-200 active:scale-125"
            aria-label={reposted ? 'Undo repost' : 'Repost'}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor" strokeWidth="2"
              className={`transition-colors duration-300 ${reposted ? 'text-emerald-400/80' : 'text-white/35 hover:text-white/55'}`}
            >
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </>
      )}

      <button
        onClick={handleShare}
        className="p-2.5 transition-all duration-200 active:scale-125"
        aria-label="Share"
        title="Copy Audius link"
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-colors duration-300 ${copied ? 'text-emerald-400/70' : 'text-white/35 hover:text-white/55'}`}
        >
          {copied ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </>
          )}
        </svg>
      </button>

      {menuButton}
    </div>
  )
}
