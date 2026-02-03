import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { sdk } from '@audius/sdk'

const AuthContext = createContext(null)

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Decode Audius JWT payload (base64url → JSON)
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('drift:user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const sdkRef = useRef(null)

  // Initialize SDK once
  if (!sdkRef.current) {
    try {
      sdkRef.current = sdk({
        apiKey: import.meta.env.VITE_AUDIUS_API_KEY,
        appName: 'drift',
      })
    } catch {
      // SDK init failed — features degrade gracefully
    }
  }

  const audiusSdk = sdkRef.current

  // Handle OAuth redirect return (mobile full-page flow)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('token=')) return

    const params = new URLSearchParams(hash.substring(1))
    const token = params.get('token')
    if (!token) return

    const payload = decodeJwtPayload(token)
    if (payload) {
      setUser(payload)
      localStorage.setItem('drift:user', JSON.stringify(payload))
    }

    // Clean up the URL
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // Set up OAuth popup callbacks (desktop)
  useEffect(() => {
    if (!audiusSdk || isMobile) return

    audiusSdk.oauth.init({
      successCallback: (profile) => {
        setUser(profile)
        localStorage.setItem('drift:user', JSON.stringify(profile))
      },
      errorCallback: () => {},
    })
  }, [audiusSdk])

  const login = useCallback(() => {
    if (!audiusSdk) return

    if (isMobile) {
      // Manual redirect flow — more reliable on mobile than popup/postMessage
      const apiKey = import.meta.env.VITE_AUDIUS_API_KEY
      const redirectUri = window.location.origin + window.location.pathname
      const url = `https://audius.co/oauth/auth?scope=write&api_key=${apiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&app_name=drift&response_mode=fragment`
      window.location.href = url
    } else {
      audiusSdk.oauth.login({ scope: 'write' })
    }
  }, [audiusSdk])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('drift:user')
  }, [])

  return (
    <AuthContext.Provider value={{ user, sdk: audiusSdk, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
