import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { sdk } from '@audius/sdk'

const AuthContext = createContext(null)

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

  // Set up OAuth callbacks
  useEffect(() => {
    if (!audiusSdk) return

    audiusSdk.oauth.init({
      successCallback: (profile) => {
        setUser(profile)
        localStorage.setItem('drift:user', JSON.stringify(profile))
      },
      errorCallback: () => {
        // Silent — user can retry
      },
    })
  }, [audiusSdk])

  const login = useCallback(() => {
    if (!audiusSdk) return
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    audiusSdk.oauth.login({ scope: 'write', display: isMobile ? 'fullScreen' : 'popup' })
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
