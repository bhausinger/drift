import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthButton() {
  const { user, login, logout } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('drift:avatar'))

  useEffect(() => {
    if (!user?.handle) {
      setAvatarUrl(null)
      return
    }

    // Try OAuth profile picture first (could be camelCase or snake_case)
    const pp = user.profilePicture || user.profile_picture
    const oauthSrc = pp?.['150x150'] || pp?.['480x480'] || pp?.small || pp?.medium || (typeof pp === 'string' ? pp : null)
    if (oauthSrc) {
      setAvatarUrl(oauthSrc)
      return
    }

    // Fallback: fetch from Audius API by handle or userId
    const endpoint = user.handle
      ? `https://api.audius.co/v1/users/handle/${user.handle}?app_name=drift`
      : `https://api.audius.co/v1/users/${user.userId}?app_name=drift`
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        const pic = json.data?.profile_picture
        const url = pic?.['150x150'] || pic?.['480x480']
        if (url) {
          setAvatarUrl(url)
          localStorage.setItem('drift:avatar', url)
        }
      })
      .catch(() => {})
  }, [user])

  if (user) {
    return (
      <button
        onClick={logout}
        className="fixed bottom-3 sm:bottom-5 left-4 sm:left-6 flex items-center gap-3
                   text-white/30 hover:text-white/50 transition-colors duration-500"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full opacity-70"
            onError={() => setAvatarUrl(null)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/10" />
        )}
        <span className="text-xs tracking-wider">@{user.handle}</span>
      </button>
    )
  }

  return (
    <button
      onClick={login}
      className="fixed bottom-3 sm:bottom-5 left-4 sm:left-6 flex items-center gap-2
                 text-white/25 hover:text-white/40 transition-colors duration-500"
    >
      <span className="text-[10px] tracking-wider">log in with Audius</span>
    </button>
  )
}
