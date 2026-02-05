import { useRef, useState, useEffect, useCallback } from 'react'
import Background from './components/Background'
import Player from './components/Player'
import AuthButton from './components/AuthButton'
import DJMode from './components/DJMode'
import { AuthProvider } from './contexts/AuthContext'

export default function App() {
  const audioRef = useRef(null)
  const [showDJ, setShowDJ] = useState(() => window.location.hash === '#playlist')
  // Handoff: stores { track, isPlaying } when transitioning between views
  const handoffTrackRef = useRef(null)
  const playerStateRef = useRef({ currentTrack: null, isPlaying: false })

  // Sync playlist mode state with URL hash so refresh stays on the same page
  const openDJ = useCallback(() => {
    // Capture current player state before switching
    handoffTrackRef.current = { ...playerStateRef.current }
    setShowDJ(true)
    window.location.hash = 'playlist'
  }, [])

  const closeDJ = useCallback(() => {
    setShowDJ(false)
    history.replaceState(null, '', window.location.pathname)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      setShowDJ(window.location.hash === '#playlist')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return (
    <AuthProvider>
      <audio ref={audioRef} preload="auto" />
      <Background />

      {showDJ ? (
        <DJMode onClose={closeDJ} audioRef={audioRef} handoffTrackRef={handoffTrackRef} />
      ) : (
        <>
          <h1 className="fixed top-6 sm:top-8 left-1/2 -translate-x-1/2
                         text-white/30 text-sm tracking-[0.3em] uppercase select-none font-light z-10">
            drift
          </h1>

          <main className="min-h-dvh flex flex-col items-center justify-center px-4 pb-16 sm:pb-4 select-none">
            <Player audioRef={audioRef} playerStateRef={playerStateRef} />
          </main>

          <AuthButton />

          {/* Deep dive button — bottom center */}
          <button
            onClick={openDJ}
            className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2
                       text-white/30 hover:text-white/50 transition-colors duration-500
                       text-sm tracking-[0.25em] uppercase z-10 font-light"
          >
            deep dive
          </button>

          {/* Audius attribution — bottom right */}
          <a
            href="https://audius.co"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-3 sm:bottom-5 right-4 sm:right-6 flex items-center gap-2
                       text-white/25 hover:text-white/40 transition-colors duration-500"
          >
            <span className="text-[10px] tracking-wider">powered by</span>
            <img
              src="/audius-logo-white.svg"
              alt="Audius"
              className="h-3 opacity-50"
            />
          </a>
        </>
      )}
    </AuthProvider>
  )
}
