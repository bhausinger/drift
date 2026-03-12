import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  searchDJTracks, getStreamUrl, getImageFallback,
  blockArtist,
} from '../utils/audius'
import { getTrackUrl } from '../utils/trackUrl'
import { addHandle, getHandleList } from '../utils/handleList'
import { useClickOutside } from '../hooks/useClickOutside'
import { useDJAudio } from '../hooks/useDJAudio'
import { useDJSearch } from '../hooks/useDJSearch'
import { useDJPlaylists } from '../hooks/useDJPlaylists'
import HandleListPanel from './HandleListPanel'
import SearchFilters from './deepdive/SearchFilters'
import PlaylistPanel from './deepdive/PlaylistPanel'
import SearchResults from './deepdive/SearchResults'
import NowPlayingBar from './deepdive/NowPlayingBar'
import { PasteUrlsModal, CreatePlaylistModal, EditPlaylistModal, PlaylistPickerModal } from './deepdive/PlaylistModals'

export default function DJMode({ audioRef, handoffTrackRef, isActive }) {
  const { user, login } = useAuth()
  const djAudioRef = audioRef

  // --- Toast (shared across hooks) ---
  const [toast, setToast] = useState(null)

  // --- Hooks ---
  const audio = useDJAudio(audioRef, handoffTrackRef, isActive)
  const search = useDJSearch(user)
  const playlists = useDJPlaylists(user, setToast)

  // Destructure for JSX compatibility
  const { nowPlaying, setNowPlaying, isPlaying, setIsPlaying, currentTime, setCurrentTime,
    duration, volume, setVolume, repeatMode, cycleRepeat, handlePreview, progressPct, setResultsList } = audio
  const { searchQuery, setSearchQuery, selectedGenres, toggleGenre, setSelectedGenres,
    bpmMin, setBpmMin, bpmMax, setBpmMax, selectedKey, setSelectedKey,
    selectedMood, setSelectedMood, minDuration, setMinDuration, maxDuration, setMaxDuration,
    releasedWithin, setReleasedWithin, showAdvanced, setShowAdvanced,
    rawResults, setRawResults, results, searching, setSearching, searchError, setSearchError,
    handleSearch, handleRandomize, searchTimerRef,
    isTeam, excludedArtists, excludeEnabled, setExcludeEnabled, bumpBlockVersion } = search
  const { playlist, setPlaylist, playlistName, setPlaylistName, saving, saveResult, setSaveResult,
    draftMeta, draftPlaylistIds,
    userPlaylists, setUserPlaylists, loadingPlaylists,
    activePlaylist, setActivePlaylist, loadingPlaylistTracks, hasDraftChanges,
    openPlaylist, openDraftPlaylist, backToLibrary,
    addToPlaylistDirect, addToPlaylist, removeFromPlaylist,
    handleDragDrop, handleRevertEdits, handlePublishEdits, publishingEdits,
    handlePublishPlaylist, handleStartDraft, handleCopyAllUrls,
    showCreateModal, setShowCreateModal, openCreateModal,
    createDescription, setCreateDescription, createIsPrivate, setCreateIsPrivate,
    createArtwork, artworkInputRef, handleArtworkSelect,
    showEditModal, setShowEditModal, openEditModal,
    editName, setEditName, editDescription, setEditDescription,
    editIsPrivate, setEditIsPrivate, editArtwork, editSaving,
    editArtworkInputRef, handleEditArtworkSelect, handleSaveEdit,
    showPastePanel, setShowPastePanel, pasteText, setPasteText,
    pasteLoading, handleSubmitPasteUrls,
    dragIdx, setDragIdx, dragOverIdx, setDragOverIdx, dragOverIdxRef } = playlists

  // Keep audio hook's results list in sync
  useEffect(() => {
    setResultsList(activePlaylist ? activePlaylist.tracks : results)
  }, [results, activePlaylist, setResultsList])

  // --- Local UI state ---
  const [showSearch, setShowSearch] = useState(true)
  const [splitTab, setSplitTab] = useState('search')
  const [showPlaylistDock, setShowPlaylistDock] = useState(false)

  // Track menus
  const [menuTrackId, setMenuTrackId] = useState(null)
  const [plMenuTrackId, setPlMenuTrackId] = useState(null)
  const menuRef = useRef(null)
  useClickOutside(menuRef, () => { setMenuTrackId(null); setPlMenuTrackId(null) }, !!(menuTrackId || plMenuTrackId))

  // Playlist picker
  const [playlistPicker, setPlaylistPicker] = useState(null)
  const pickerRef = useRef(null)
  useClickOutside(pickerRef, () => setPlaylistPicker(null), !!playlistPicker)

  // Now-playing menu
  const [showNpMenu, setShowNpMenu] = useState(false)
  const npMenuRef = useRef(null)
  useClickOutside(npMenuRef, () => setShowNpMenu(false), showNpMenu)

  // Handle list (team scouting)
  const [showHandleList, setShowHandleList] = useState(false)
  const [handleList, setHandleList] = useState(() => getHandleList())
  const [showTeamMenu, setShowTeamMenu] = useState(false)
  const teamMenuRef = useRef(null)
  useClickOutside(teamMenuRef, () => setShowTeamMenu(false), showTeamMenu)

  // Per-track like/repost
  const [likedTracks, setLikedTracks] = useState({})
  const [repostedTracks, setRepostedTracks] = useState({})
  const [copiedTrackId, setCopiedTrackId] = useState(null)

  // --- Handlers that bridge hooks ---

  const handleLike = useCallback(async (track) => {
    if (!user) { login(); return }
    const isLiked = likedTracks[track.id]
    setLikedTracks((prev) => ({ ...prev, [track.id]: !isLiked }))
    try {
      await fetch('/api/track-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isLiked ? 'unfavorite' : 'favorite', userId: user.userId, trackId: track.id }),
      })
    } catch {
      setLikedTracks((prev) => ({ ...prev, [track.id]: isLiked }))
    }
  }, [user, login, likedTracks])

  const handleRepost = useCallback(async (track) => {
    if (!user) { login(); return }
    const isReposted = repostedTracks[track.id]
    setRepostedTracks((prev) => ({ ...prev, [track.id]: !isReposted }))
    try {
      await fetch('/api/track-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isReposted ? 'unrepost' : 'repost', userId: user.userId, trackId: track.id }),
      })
    } catch {
      setRepostedTracks((prev) => ({ ...prev, [track.id]: isReposted }))
    }
  }, [user, login, repostedTracks])

  const handleBlockArtist = useCallback((track) => {
    if (!track?.user?.handle) return
    blockArtist(track.user.handle)
    bumpBlockVersion()
    setMenuTrackId(null)
    if (nowPlaying?.user?.handle === track.user.handle) {
      const a = djAudioRef.current
      if (a) { a.pause(); a.removeAttribute('src') }
      setNowPlaying(null); setIsPlaying(false)
    }
    setToast(`Hidden all tracks by ${track.user.name}`)
    setTimeout(() => setToast(null), 2000)
  }, [nowPlaying, bumpBlockVersion])

  const handleCopyLink = useCallback((track) => {
    navigator.clipboard.writeText(getTrackUrl(track)).then(() => {
      setCopiedTrackId(track.id)
      setTimeout(() => setCopiedTrackId(null), 1500)
    })
    setMenuTrackId(null)
  }, [])

  const handleStartRadio = useCallback(async (track) => {
    if (!track) return
    setShowNpMenu(false)
    setSearching(true)
    setSearchError(null)
    setActivePlaylist(null)
    try {
      const genre = track.genre || ''
      const tracks = await searchDJTracks({ query: '', genres: genre ? [genre] : [] })
      setRawResults(tracks)
      if (tracks.length > 0) {
        const first = tracks[0]
        const a = djAudioRef.current
        if (a) {
          a.src = getStreamUrl(first.id)
          a.load()
          a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(first)
          setCurrentTime(0)
        }
      }
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [])

  const handlePlaylistRadio = useCallback(async () => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) return
    setSearching(true)
    setSearchError(null)
    const tracks = activePlaylist.tracks
    const genres = [...new Set(tracks.map((t) => t.genre).filter(Boolean))]
    const plName = activePlaylist.name
    setActivePlaylist(null)
    try {
      const radioTracks = await searchDJTracks({ query: genres.length === 0 ? plName : '', genres: genres.slice(0, 3) })
      setRawResults(radioTracks)
      if (radioTracks.length > 0) {
        const first = radioTracks[0]
        const a = djAudioRef.current
        if (a) {
          a.src = getStreamUrl(first.id)
          a.load()
          a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(first)
          setCurrentTime(0)
        }
      }
    } catch (err) { setSearchError(err.message) }
    finally { setSearching(false) }
  }, [activePlaylist])

  const handleSmartSearch = useCallback(async () => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) return
    const tracks = activePlaylist.tracks
    const genreCounts = {}
    tracks.forEach((t) => { if (t.genre) genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1 })
    const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g)
    const bpms = tracks.map((t) => t.bpm).filter(Boolean)
    const avgBpm = bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0
    const bpmLow = avgBpm ? String(Math.max(1, avgBpm - 15)) : ''
    const bpmHigh = avgBpm ? String(avgBpm + 15) : ''
    const moodCounts = {}
    tracks.forEach((t) => { if (t.mood) moodCounts[t.mood] = (moodCounts[t.mood] || 0) + 1 })
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    setSelectedGenres(topGenres); setBpmMin(bpmLow); setBpmMax(bpmHigh)
    setSelectedMood(topMood); setShowAdvanced(true); setShowSearch(true)
    setSearching(true); setSearchError(null)
    try {
      const r = await searchDJTracks({ genres: topGenres, mood: topMood, bpmMin: bpmLow, bpmMax: bpmHigh })
      setRawResults(r)
    } catch (err) { setSearchError(err.message) }
    finally { setSearching(false) }
  }, [activePlaylist])

  const handleNext = useCallback(() => {
    const trackList = activePlaylist ? activePlaylist.tracks : results
    audio.handleNext(trackList)
  }, [activePlaylist, results, audio])

  const handlePrev = useCallback(() => {
    const trackList = activePlaylist ? activePlaylist.tracks : results
    audio.handlePrev(trackList)
  }, [activePlaylist, results, audio])

  // --- Utilities ---
  const artwork = (track) => track?.artwork?.['150x150'] || track?.artwork?.['480x480'] || null

  const handleImgError = useCallback((e) => {
    const img = e.target
    if (img.dataset.fallbackAttempted) return
    const fallback = getImageFallback(img.src)
    if (fallback) { img.dataset.fallbackAttempted = '1'; img.src = fallback }
  }, [])

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-hidden pb-14 bg-[#050510]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 sm:px-8 pt-5 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-white text-xs tracking-[0.3em] uppercase font-light">
            deep dive
          </h2>
          <p className="hidden sm:block text-white/60 text-[10px] mt-1 font-light">
            Search artists or tracks, filter by BPM, mood, genre, and build a playlist
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Curate / Browse toggle */}
          {user ? (
            <button
              onClick={() => {
                if (activePlaylist || showPlaylistDock) {
                  backToLibrary()
                  setShowPlaylistDock(false)
                } else {
                  setShowPlaylistDock(true)
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                         transition-all duration-300 border
                ${(activePlaylist || showPlaylistDock)
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                  : 'bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white'
                }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {(activePlaylist || showPlaylistDock) ? (
                  <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
                ) : (
                  <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>
                )}
              </svg>
              {(activePlaylist || showPlaylistDock) ? 'browse' : 'curate'}
            </button>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                         transition-all duration-300 border bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              curate
            </button>
          )}

          {/* Team tools dropdown */}
          {isTeam && (
            <div className="relative" ref={teamMenuRef}>
              <button
                onClick={() => setShowTeamMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                           transition-all duration-300 border
                  ${showTeamMenu
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                    : 'bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white'
                  }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="hidden sm:inline">tools</span>
              </button>
              {showTeamMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-black/90 backdrop-blur-md border border-white/10
                               rounded-lg shadow-xl shadow-black/50 py-1 min-w-[200px]">
                  <button
                    onClick={() => { setShowHandleList((v) => !v); setShowTeamMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Handles{handleList.length > 0 ? ` (${handleList.length})` : ''}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedGenres(['Dubstep', 'Trap', 'Electronic'])
                      setBpmMin('140'); setBpmMax('140')
                      setSearchQuery(''); setSelectedMood(''); setSelectedKey('')
                      setMinDuration('1'); setMaxDuration('7'); setReleasedWithin('14d')
                      setShowAdvanced(true); setActivePlaylist(null); setShowTeamMenu(false)
                      setTimeout(() => { document.querySelector('[data-action="dj-search"]')?.click() }, 50)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    140 Preset
                  </button>
                  {excludedArtists && (
                    <button
                      onClick={() => { setExcludeEnabled((v) => !v); setShowTeamMenu(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {excludeEnabled
                          ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /><line x1="1" y1="1" x2="23" y2="23" /></>
                          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        }
                      </svg>
                      {excludeEnabled ? 'Show playlist artists' : 'Hide playlist artists'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <SearchFilters
        showSearch={showSearch} setShowSearch={setShowSearch}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        handleSearch={handleSearch} handleRandomize={handleRandomize}
        searching={searching} searchTimerRef={searchTimerRef}
        selectedGenres={selectedGenres} toggleGenre={toggleGenre}
        showAdvanced={showAdvanced} setShowAdvanced={setShowAdvanced}
        bpmMin={bpmMin} setBpmMin={setBpmMin} bpmMax={bpmMax} setBpmMax={setBpmMax}
        selectedKey={selectedKey} setSelectedKey={setSelectedKey}
        selectedMood={selectedMood} setSelectedMood={setSelectedMood}
        minDuration={minDuration} setMinDuration={setMinDuration}
        maxDuration={maxDuration} setMaxDuration={setMaxDuration}
        releasedWithin={releasedWithin} setReleasedWithin={setReleasedWithin}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Handle list panel — modal overlay (team only) */}
        {isTeam && showHandleList && (
          <div className="absolute inset-0 z-20">
            <HandleListPanel
              handles={handleList}
              onUpdate={setHandleList}
              onClose={() => setShowHandleList(false)}
            />
          </div>
        )}

        <PlaylistPanel
          user={user} showPlaylistDock={showPlaylistDock}
          activePlaylist={activePlaylist} splitTab={splitTab}
          nowPlaying={nowPlaying} isPlaying={isPlaying} handlePreview={handlePreview}
          openCreateModal={openCreateModal} openDraftPlaylist={openDraftPlaylist}
          draftMeta={draftMeta} playlist={playlist} openPlaylist={openPlaylist}
          userPlaylists={userPlaylists} loadingPlaylists={loadingPlaylists} draftPlaylistIds={draftPlaylistIds}
          backToLibrary={backToLibrary} hasDraftChanges={hasDraftChanges} loadingPlaylistTracks={loadingPlaylistTracks}
          handleSmartSearch={handleSmartSearch} searching={searching}
          handlePlaylistRadio={handlePlaylistRadio} openEditModal={openEditModal}
          handleCopyAllUrls={handleCopyAllUrls}
          showPastePanel={showPastePanel} setShowPastePanel={setShowPastePanel}
          handlePublishPlaylist={handlePublishPlaylist} saving={saving}
          handleRevertEdits={handleRevertEdits} handlePublishEdits={handlePublishEdits} publishingEdits={publishingEdits}
          saveResult={saveResult}
          dragIdx={dragIdx} setDragIdx={setDragIdx}
          dragOverIdx={dragOverIdx} setDragOverIdx={setDragOverIdx}
          dragOverIdxRef={dragOverIdxRef} handleDragDrop={handleDragDrop}
          plMenuTrackId={plMenuTrackId} setPlMenuTrackId={setPlMenuTrackId} menuRef={menuRef}
          removeFromPlaylist={removeFromPlaylist} handleCopyLink={handleCopyLink}
          handleBlockArtist={handleBlockArtist} copiedTrackId={copiedTrackId}
          artwork={artwork} handleImgError={handleImgError}
        />

        <SearchResults
          results={results} searching={searching} searchError={searchError}
          activePlaylist={activePlaylist} splitTab={splitTab}
          nowPlaying={nowPlaying} isPlaying={isPlaying} handlePreview={handlePreview}
          playlist={playlist} addToPlaylistDirect={addToPlaylistDirect}
          menuTrackId={menuTrackId} setMenuTrackId={setMenuTrackId} menuRef={menuRef}
          setPlaylistPicker={setPlaylistPicker} handleStartRadio={handleStartRadio}
          handleCopyLink={handleCopyLink} handleBlockArtist={handleBlockArtist} copiedTrackId={copiedTrackId}
          isTeam={isTeam} handleList={handleList} setHandleList={setHandleList} setToast={setToast}
          artwork={artwork} handleImgError={handleImgError}
        />

        {/* Mobile tab switcher (only when playlist is active) */}
        {activePlaylist && (
          <div className="sm:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center
                          bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-0.5 shadow-xl">
            <button
              onClick={() => setSplitTab('search')}
              className={`px-4 py-1.5 text-[10px] tracking-wider uppercase rounded-full transition-all duration-200
                ${splitTab === 'search' ? 'bg-purple-500/20 text-purple-200' : 'text-white/50'}`}
            >
              search
            </button>
            <button
              onClick={() => setSplitTab('playlist')}
              className={`px-4 py-1.5 text-[10px] tracking-wider uppercase rounded-full transition-all duration-200
                ${splitTab === 'playlist' ? 'bg-purple-500/20 text-purple-200' : 'text-white/50'}`}
            >
              playlist{activePlaylist.tracks.length > 0 && ` (${activePlaylist.tracks.length})`}
            </button>
          </div>
        )}
      </div>

      <PlaylistPickerModal
        playlistPicker={playlistPicker} setPlaylistPicker={setPlaylistPicker} pickerRef={pickerRef}
        artwork={artwork} addToPlaylistDirect={addToPlaylistDirect}
        draftMeta={draftMeta} userPlaylists={userPlaylists}
      />

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-white/10
                        rounded-lg px-4 py-2 text-xs text-white/80 shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      <NowPlayingBar
        nowPlaying={nowPlaying} isPlaying={isPlaying}
        currentTime={currentTime} duration={duration}
        volume={volume} setVolume={setVolume}
        progressPct={progressPct} handlePreview={handlePreview}
        handleNext={handleNext} handlePrev={handlePrev}
        handleLike={handleLike} handleRepost={handleRepost}
        likedTracks={likedTracks} repostedTracks={repostedTracks}
        handleStartRadio={handleStartRadio} handleCopyLink={handleCopyLink}
        handleBlockArtist={handleBlockArtist} copiedTrackId={copiedTrackId}
        setPlaylistPicker={setPlaylistPicker}
        showNpMenu={showNpMenu} setShowNpMenu={setShowNpMenu} npMenuRef={npMenuRef}
        artwork={artwork} handleImgError={handleImgError} audioRef={djAudioRef}
      />

      <PasteUrlsModal
        showPastePanel={showPastePanel} setShowPastePanel={setShowPastePanel}
        pasteText={pasteText} setPasteText={setPasteText}
        pasteLoading={pasteLoading} handleSubmitPasteUrls={handleSubmitPasteUrls}
        activePlaylist={activePlaylist}
      />

      <CreatePlaylistModal
        showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal}
        playlistName={playlistName} setPlaylistName={setPlaylistName}
        createDescription={createDescription} setCreateDescription={setCreateDescription}
        createIsPrivate={createIsPrivate} setCreateIsPrivate={setCreateIsPrivate}
        createArtwork={createArtwork} artworkInputRef={artworkInputRef} handleArtworkSelect={handleArtworkSelect}
        handleStartDraft={handleStartDraft}
      />

      <EditPlaylistModal
        showEditModal={showEditModal} setShowEditModal={setShowEditModal}
        editName={editName} setEditName={setEditName}
        editDescription={editDescription} setEditDescription={setEditDescription}
        editIsPrivate={editIsPrivate} setEditIsPrivate={setEditIsPrivate}
        editArtwork={editArtwork} activePlaylist={activePlaylist}
        editArtworkInputRef={editArtworkInputRef} handleEditArtworkSelect={handleEditArtworkSelect}
        editSaving={editSaving} handleSaveEdit={handleSaveEdit}
      />
    </div>
  )
}
