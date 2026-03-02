import { useRef, useState, useEffect, useCallback } from 'react'
import Background from './components/Background'
import Player from './components/Player'
import AuthButton from './components/AuthButton'
import DJMode from './components/DJMode'
import BottomTabs from './components/BottomTabs'
import { AuthProvider } from './contexts/AuthContext'
import { useArtworkColor } from './hooks/useArtworkColor'

export default function App() {
  const audioRef = useRef(null)
  const [activeTab, setActiveTab] = useState('vibe')
  const [artworkUrl, setArtworkUrl] = useState(null)
  const handoffTrackRef = useRef(null)
  const playerStateRef = useRef({ currentTrack: null, isPlaying: false })

  const accentColor = useArtworkColor(artworkUrl)

  // Capture player state when switching to deep dive
  const handleTabChange = useCallback((tab) => {
    if (tab === 'deepdive' && activeTab === 'vibe') {
      handoffTrackRef.current = { ...playerStateRef.current }
    }
    setActiveTab(tab)
  }, [activeTab])

  return (
    <AuthProvider>
      <audio ref={audioRef} preload="auto" />
      <Background accentColor={accentColor} />

      {/* Vibe — the original Drift player */}
      <div className={activeTab === 'vibe' ? '' : 'hidden'}>
        <h1 className="fixed top-3 sm:top-8 left-1/2 -translate-x-1/2
                       text-white/30 text-sm tracking-[0.3em] uppercase select-none font-light z-10">
          drift
        </h1>

        <main className="min-h-dvh flex flex-col items-center justify-center px-4 pb-20 sm:pb-4 select-none">
          <Player audioRef={audioRef} playerStateRef={playerStateRef} onArtworkChange={setArtworkUrl} />
        </main>

        <AuthButton />
      </div>

      {/* Deep Dive */}
      <div className={activeTab === 'deepdive' ? '' : 'hidden'}>
        <DJMode
          onClose={() => setActiveTab('vibe')}
          audioRef={audioRef}
          handoffTrackRef={handoffTrackRef}
        />
      </div>

      {/* Bottom nav */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />
    </AuthProvider>
  )
}
