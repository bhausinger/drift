import { useState, useCallback, useEffect, useRef } from 'react'
import { getAudiusProfileUrl, addToDraftPlaylist, fetchUserPlaylists, blockArtist, fetchArtistTracks, getImageFallback } from '../utils/audius'
import { useAuth } from '../contexts/AuthContext'
import { isTeamMember } from '../utils/team'
import { addHandle, getHandleList } from '../utils/handleList'
import HandleListPanel from './HandleListPanel'
import TrackActions from './TrackActions'

export default function TrackInfo({ track, onBlockArtist, onQueueArtistTracks }) {
  const { user, sdk } = useAuth() || {}
  const profileUrl = track ? getAudiusProfileUrl(track.user.handle) : null
  const artwork = track?.artwork?.['480x480'] || track?.artwork?.['1000x1000'] || track?.artwork?.['150x150']

  const [menuOpen, setMenuOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [playlists, setPlaylists] = useState(null)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showHandleList, setShowHandleList] = useState(false)
  const [handleList, setHandleList] = useState(() => getHandleList())
  const menuRef = useRef(null)

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  // Reset state when track changes
  useEffect(() => { setAdded(false); setMenuOpen(false); setShowPlaylists(false) }, [track?.id])

  // Clear toast after delay
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const [loadingArtist, setLoadingArtist] = useState(false)

  const handleMoreFromArtist = useCallback(async () => {
    if (!track?.user?.handle || !onQueueArtistTracks) return
    setLoadingArtist(true)
    try {
      const artistTracks = await fetchArtistTracks(track.user.handle, track.user.name)
      // Exclude current track
      const filtered = artistTracks.filter((t) => t.id !== track.id)
      if (filtered.length > 0) {
        onQueueArtistTracks(filtered)
        setToast(`Queued ${filtered.length} tracks from ${track.user.name}`)
      } else {
        setToast('No additional tracks found')
      }
    } catch {
      setToast('Failed to load artist tracks')
    } finally {
      setLoadingArtist(false)
      setMenuOpen(false)
    }
  }, [track, onQueueArtistTracks])

  const handleAddDraft = useCallback(() => {
    if (!track) return
    addToDraftPlaylist(track)
    setAdded(true)
    setToast('Added to draft playlist')
    setTimeout(() => setMenuOpen(false), 600)
  }, [track])

  const handleShowPlaylists = useCallback(async () => {
    setShowPlaylists(true)
    if (playlists !== null) return
    if (!user?.userId) return
    setPlaylistsLoading(true)
    try {
      const lists = await fetchUserPlaylists(user.userId)
      setPlaylists(lists)
    } catch {
      setPlaylists([])
    } finally {
      setPlaylistsLoading(false)
    }
  }, [user?.userId, playlists])

  const handleAddToAudiusPlaylist = useCallback(async (playlist) => {
    if (!track || !sdk || !user?.userId) return
    try {
      await sdk.playlists.addTrackToPlaylist({
        playlistId: playlist.playlist_id || playlist.id,
        userId: user.userId,
        trackId: track.id,
      })
      setToast(`Added to ${playlist.playlist_name || playlist.playlistName}`)
    } catch {
      setToast('Failed to add to playlist')
    }
    setMenuOpen(false)
    setShowPlaylists(false)
  }, [track, sdk, user?.userId])

  // Three-dot menu content (rendered inside TrackActions row)
  const menuButton = (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="p-2.5 -m-1.5 text-white/25 hover:text-white/50 transition-colors duration-200"
        aria-label="Track options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {menuOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 bg-black/80 backdrop-blur-md
                     border border-white/10 rounded-lg shadow-xl shadow-black/50 py-1 min-w-[170px]"
        >
          {!showPlaylists ? (
            <>
              <button
                onClick={user ? handleShowPlaylists : handleAddDraft}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors
                  ${added ? 'text-purple-300/80' : 'text-white/80 hover:bg-white/[0.06] hover:text-white'}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {added ? 'Added to playlist' : 'Add to playlist'}
              </button>
              <button
                onClick={handleMoreFromArtist}
                disabled={loadingArtist}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2 disabled:opacity-40"
              >
                {loadingArtist ? (
                  <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                )}
                More from this artist
              </button>
              <button
                onClick={() => {
                  if (!track?.user?.handle) return
                  blockArtist(track.user.handle)
                  setMenuOpen(false)
                  if (onBlockArtist) onBlockArtist(track)
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
                Hide artist
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPlaylists(false)}
                className="w-full text-left px-4 py-2.5 text-sm text-white/40 hover:bg-white/[0.06] transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <div className="border-t border-white/5 my-0.5" />
              <button
                onClick={handleAddDraft}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors
                  ${added ? 'text-purple-300/80' : 'text-white/80 hover:bg-white/[0.06] hover:text-white'}`}
              >
                Draft playlist
              </button>
              {playlistsLoading && (
                <div className="px-3 py-1.5 flex justify-center">
                  <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                </div>
              )}
              {playlists && playlists.map((pl) => (
                <button
                  key={pl.playlist_id || pl.id}
                  onClick={() => handleAddToAudiusPlaylist(pl)}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors truncate"
                >
                  {pl.playlist_name || pl.playlistName}
                </button>
              ))}
              {playlists && playlists.length === 0 && (
                <p className="px-4 py-2.5 text-sm text-white/30">No playlists found</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-2">
      <div className="flex flex-col items-center space-y-2">
        <div className="relative flex items-center justify-center">
          <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/30 relative">
            {artwork ? (
              <img
                key={artwork}
                src={artwork}
                alt=""
                className="w-full h-full object-cover opacity-90"
                onError={(e) => {
                  const img = e.target
                  if (!img.dataset.fallbackAttempted) {
                    const fallback = getImageFallback(img.src)
                    if (fallback) { img.dataset.fallbackAttempted = '1'; img.src = fallback; return }
                  }
                  img.style.visibility = 'hidden'
                }}
              />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
        </div>

        {/* Title + artist */}
        <div className="space-y-1 w-full max-w-[360px] h-[4.5rem] px-2">
          {track && (<>
            <a
              href={track.permalink ? `https://audius.co${track.permalink}` : `https://audius.co/tracks/${track.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white/95 text-lg font-light tracking-wide leading-snug line-clamp-2 transition-colors duration-500 block"
            >
              {track.title}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/30 text-xs tracking-wider
                           hover:text-white/50 transition-colors duration-500"
              >
                {track.user.name}
              </a>
              {isTeamMember(user) && track.user?.handle && (
                <button
                  onClick={() => {
                    const updated = addHandle(track.user.handle)
                    setHandleList(updated)
                    setToast(`Added @${track.user.handle}`)
                  }}
                  className={`transition-colors duration-200 ${handleList.includes(track.user.handle.toLowerCase()) ? 'text-purple-400/50' : 'text-white/20 hover:text-white/40'}`}
                  aria-label="Add artist handle to list"
                  title={`Add @${track.user.handle} to list`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              )}
            </span>
          </>)}
        </div>

        {/* Actions row: like, repost, share, three-dot menu */}
        {track && <TrackActions trackId={track.id} permalink={track.permalink} menuButton={menuButton} />}
      </div>

      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in
                        bg-black/70 backdrop-blur-md border border-white/10 rounded-lg
                        px-4 py-2 text-xs text-white/70 tracking-wider">
          {toast}
        </div>
      )}

      {/* Handle list toggle + panel (team only) */}
      {isTeamMember(user) && (
        <>
          <button
            onClick={() => setShowHandleList((v) => !v)}
            className={`fixed top-6 right-6 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                       transition-all duration-300 border
              ${showHandleList
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                : 'bg-black/40 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
              }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {handleList.length > 0 ? handleList.length : 'handles'}
          </button>
          {showHandleList && (
            <div className="fixed top-0 right-0 bottom-0 z-30 w-64">
              <HandleListPanel
                handles={handleList}
                onUpdate={setHandleList}
                onClose={() => setShowHandleList(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
