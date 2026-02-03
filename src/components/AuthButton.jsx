import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthButton() {
  const { user, login, logout } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    if (!user?.handle) {
      setAvatarUrl(null)
      return
    }

    // Try OAuth profile picture first
    const pp = user.profilePicture
    const oauthSrc = pp?.['150x150'] || pp?.small || pp?.medium || (typeof pp === 'string' ? pp : null)
    if (oauthSrc) {
      setAvatarUrl(oauthSrc)
      return
    }

    // Fallback: fetch from Audius API
    fetch(`https://api.audius.co/v1/users/handle/${user.handle}?app_name=drift`)
      .then((r) => r.json())
      .then((json) => {
        const pic = json.data?.profile_picture?.['150x150'] || json.data?.profile_picture?.['480x480']
        if (pic) setAvatarUrl(pic)
      })
      .catch(() => {})
  }, [user])

  if (user) {
    return (
      <button
        onClick={logout}
        className="fixed bottom-5 left-6 flex items-center gap-3
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
      className="fixed bottom-5 left-6 flex items-center gap-2
                 text-white/25 hover:text-white/40 transition-colors duration-500"
    >
      <span className="text-[10px] tracking-wider">log in with Audius</span>
    </button>
  )
}
