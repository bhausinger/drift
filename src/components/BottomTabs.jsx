import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function BottomTabs({ activeTab, onTabChange }) {
  const { user, login, logout } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('drift:avatar'))

  useEffect(() => {
    if (!user?.handle) {
      setAvatarUrl(null)
      return
    }
    const pp = user.profilePicture || user.profile_picture
    const oauthSrc = pp?.['150x150'] || pp?.['480x480'] || pp?.small || pp?.medium || (typeof pp === 'string' ? pp : null)
    if (oauthSrc) {
      setAvatarUrl(oauthSrc)
      return
    }
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

  const tabs = [
    {
      id: 'login',
      label: user ? `@${user.handle}` : 'Login',
      icon: user && avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" onError={() => setAvatarUrl(null)} />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      action: () => user ? logout() : login(),
    },
    {
      id: 'vibe',
      label: 'Vibe',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      ),
    },
    {
      id: 'deepdive',
      label: 'Dive',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-xl border-t border-white/[0.06]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="grid grid-cols-3 h-14 w-full">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => tab.action ? tab.action() : onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-300 min-w-0
              ${activeTab === tab.id ? 'text-white/80' : 'text-white/25'}`}
          >
            {tab.icon}
            <span className="text-[10px] tracking-wider truncate max-w-[72px]">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
