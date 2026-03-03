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
    ...(!user ? [{
      id: 'login',
      label: 'Login',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      action: () => login(),
    }] : []),
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
      <div className="relative flex items-center justify-center h-14">
        {/* Logged-in avatar — far left */}
        {user && (
          <button
            onClick={logout}
            className="absolute left-4 sm:left-6 flex items-center gap-2 text-white/30 hover:text-white/50 transition-colors duration-500"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full opacity-70" onError={() => setAvatarUrl(null)} />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10" />
            )}
            <span className="hidden sm:inline text-[10px] tracking-wider">@{user.handle}</span>
          </button>
        )}

        {/* Centered tabs */}
        <div className="flex items-center gap-12">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.action ? tab.action() : onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors duration-300 min-w-0
                ${tab.id === 'login'
                  ? 'text-white/30 hover:text-white/50'
                  : activeTab === tab.id ? 'text-white/80' : 'text-white/25'}`}
            >
              {tab.icon}
              <span className="text-[10px] tracking-wider truncate max-w-[72px]">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Powered by Audius — far right, desktop only */}
        <a
          href="https://audius.co"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex absolute right-6 items-center gap-1.5
                     text-white/20 hover:text-white/35 transition-colors duration-500"
        >
          <span className="text-[10px] tracking-wider">powered by</span>
          <svg width="14" height="14" viewBox="0 0 1024 1024" fill="currentColor">
            <path d="m565.381 127.013c-17.861-31.0313-26.811-46.5471-38.476-51.7452-10.189-4.5484-21.814-4.5484-32.004-.0197-11.684 5.1982-20.634 20.6942-38.554 51.7059l-277.256 480.004c-17.901 31.012-26.87 46.508-25.533 59.228 1.161 11.105 6.964 21.186 15.992 27.763 10.327 7.522 28.228 7.541 64.008 7.561l99.573.059c13.238 0 19.867 0 25.788-1.91 5.252-1.693 10.071-4.489 14.182-8.171 4.623-4.175 7.947-9.904 14.576-21.384l101.854-176.344c.59-1.024 1.24-1.989 1.928-2.875 10.366-13.33 31.552-12.365 40.344 2.895l120.502 209.226c1.082 1.871 1.869 3.801 2.4 5.73 4.17 14.965-6.924 30.914-23.565 30.894l-199.578-.138c-13.238 0-19.867 0-25.788 1.91-5.252 1.693-10.071 4.489-14.182 8.171-4.623 4.175-7.947 9.904-14.576 21.384l-49.845 86.282c-17.901 31.011-26.87 46.507-25.533 59.227 1.161 11.105 6.964 21.187 15.992 27.763 10.327 7.522 28.228 7.541 64.008 7.561l550.048.355c35.781.019 53.661.039 64.008-7.483 9.026-6.556 14.856-16.638 16.016-27.723 1.33-12.72-7.6-28.236-25.458-59.267z" />
          </svg>
          <span className="text-[10px] tracking-wider font-medium">Audius</span>
        </a>
      </div>
    </nav>
  )
}
