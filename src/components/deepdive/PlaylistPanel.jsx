import { formatDuration } from '../../utils/audius'

export default function PlaylistPanel({
  user, showPlaylistDock, activePlaylist, splitTab,
  nowPlaying, isPlaying, handlePreview,
  // Library
  openCreateModal, openDraftPlaylist, draftMeta, playlist, openPlaylist,
  userPlaylists, loadingPlaylists, draftPlaylistIds,
  // Active playlist
  backToLibrary, hasDraftChanges, loadingPlaylistTracks,
  handleSmartSearch, searching, handlePlaylistRadio, openEditModal,
  handleCopyAllUrls, showPastePanel, setShowPastePanel,
  handlePublishPlaylist, saving, handleRevertEdits, handlePublishEdits, publishingEdits,
  saveResult,
  // Drag
  dragIdx, setDragIdx, dragOverIdx, setDragOverIdx, dragOverIdxRef, handleDragDrop,
  // Track menu
  plMenuTrackId, setPlMenuTrackId, menuRef,
  removeFromPlaylist, handleCopyLink, handleBlockArtist, copiedTrackId,
  // Utils
  artwork, handleImgError,
}) {
  return (
    <div className={`sm:w-[40%] flex-col border-r border-white/[0.06] min-h-0
      ${(showPlaylistDock || activePlaylist) && user ? 'hidden sm:flex' : 'hidden'}`}>

      {/* No active playlist — show compact playlist library */}
      {!activePlaylist && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
            <h3 className="text-white/90 text-[11px] tracking-wider uppercase">Playlists</h3>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] tracking-wider uppercase
                         bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 hover:border-purple-500/30
                         text-purple-200 transition-all duration-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-purple-300">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              new
            </button>
          </div>

          {/* Draft playlist entry */}
          {draftMeta && (
            <div className="px-4 pb-1">
              <button
                onClick={openDraftPlaylist}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 group text-left
                  ${activePlaylist?.isNew ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/[0.04] border border-transparent'}`}
              >
                <div className="w-8 h-8 rounded-md overflow-hidden bg-purple-500/10 flex-shrink-0 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-300/60">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] truncate text-white/90">{draftMeta.name}</p>
                  <p className="text-white/40 text-[9px]">{playlist.length} tracks · draft</p>
                </div>
              </button>
            </div>
          )}

          <div className="px-4"><div className="border-b border-white/[0.06]" /></div>

          {/* Existing playlists list */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2">
            {loadingPlaylists ? (
              <div className="flex justify-center py-8">
                <div className="w-4 h-4 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
              </div>
            ) : userPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg className="text-white/15" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-white/40 text-[10px]">No playlists yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {userPlaylists.map((pl) => {
                  const plArt = pl.artwork?.['150x150'] || null
                  const hasDraft = draftPlaylistIds.has(pl.id)
                  return (
                    <button
                      key={pl.id}
                      onClick={() => openPlaylist(pl)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 group text-left
                        hover:bg-white/[0.04] border border-transparent"
                    >
                      <div className="w-8 h-8 rounded-md overflow-hidden bg-white/[0.06] flex-shrink-0">
                        {plArt ? (
                          <img src={plArt} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" onError={handleImgError} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] truncate text-white/90 group-hover:text-white transition-colors">{pl.playlistName || pl.playlist_name || 'Untitled'}</p>
                        <p className="text-white/40 text-[9px]">
                          {pl.trackCount ?? pl.track_count ?? pl.playlist_contents?.length ?? 0} tracks
                          {hasDraft && <span className="text-amber-400/80"> · unsaved draft</span>}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active playlist — detail view */}
      {activePlaylist && (
        <div className={`flex-1 overflow-y-auto min-h-0
          ${splitTab === 'playlist' ? '' : 'hidden sm:block'}`}>
          <div className="px-4 sm:px-5 pb-4">
            {/* Playlist header */}
            <div className="flex items-center gap-3 py-3 sticky top-0 bg-[#050510]/90 backdrop-blur-sm z-10">
              <button
                onClick={backToLibrary}
                className="text-white/50 hover:text-white/80 transition-colors p-1"
                aria-label="Back to library"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/[0.06] flex-shrink-0">
                {activePlaylist.artwork ? (
                  <img src={activePlaylist.artwork} alt="" className="w-full h-full object-cover opacity-80" onError={handleImgError} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white/90 text-xs font-medium truncate">{activePlaylist.name}</h3>
                <p className="text-white/40 text-[9px]">
                  {activePlaylist.tracks.length} track{activePlaylist.tracks.length !== 1 ? 's' : ''}
                  {activePlaylist.isNew && ' · draft'}
                  {hasDraftChanges && ' · unsaved changes'}
                </p>
              </div>
            </div>

            {/* Playlist action buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pb-3">
              {activePlaylist.tracks.length > 0 && (<>
                <button
                  onClick={handleSmartSearch}
                  disabled={searching}
                  className="p-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300/80 hover:text-purple-200
                             rounded-lg transition-all duration-300 disabled:opacity-40"
                  title="Smart search — find similar tracks by genre, BPM & mood"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <path d="M11 8v6" />
                    <path d="M8 11h6" />
                  </svg>
                </button>
                <button
                  onClick={handlePlaylistRadio}
                  className="p-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80
                             rounded-lg transition-all duration-300"
                  title="Start radio from playlist"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="2" />
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                    <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                  </svg>
                </button>
              </>)}
              {!activePlaylist.isNew && (
                <button
                  onClick={openEditModal}
                  className="p-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80
                             rounded-lg transition-all duration-300"
                  title="Edit playlist"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              {activePlaylist.tracks.length > 0 && (
                <button
                  onClick={handleCopyAllUrls}
                  className="px-2 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-[9px]
                             tracking-wider rounded-lg transition-all duration-300 uppercase"
                  title="Copy all track URLs"
                >
                  copy urls
                </button>
              )}
              <button
                onClick={() => setShowPastePanel((v) => !v)}
                className={`px-2 py-1 text-[9px] tracking-wider rounded-lg transition-all duration-300 uppercase
                  ${showPastePanel
                    ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80'}`}
              >
                paste urls
              </button>
              {activePlaylist.isNew && (
                <button
                  onClick={handlePublishPlaylist}
                  disabled={saving || !draftMeta?.name}
                  className="px-2.5 py-1 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[9px]
                             tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30
                             disabled:cursor-not-allowed uppercase"
                >
                  {saving ? 'saving...' : 'save to audius'}
                </button>
              )}
              {hasDraftChanges && (
                <>
                  <button
                    onClick={handleRevertEdits}
                    className="px-2 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-[9px]
                               tracking-wider rounded-lg transition-all duration-300 uppercase"
                  >
                    revert
                  </button>
                  <button
                    onClick={() => handlePublishEdits('replace')}
                    disabled={publishingEdits}
                    className="px-2.5 py-1 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[9px]
                               tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30 uppercase"
                    title="Replace playlist with current track list"
                  >
                    {publishingEdits ? 'publishing...' : 'publish'}
                  </button>
                </>
              )}
            </div>
            {saveResult && (
              <p className={`text-[10px] pb-2 ${saveResult.startsWith('Error') ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                {saveResult}
              </p>
            )}

            {loadingPlaylistTracks ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
              </div>
            ) : activePlaylist.tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg className="text-white/20" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-white/40 text-xs">
                  {activePlaylist.isNew ? 'Search for tracks and tap + to add them' : 'No tracks in this playlist'}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {activePlaylist.tracks.map((track, trackIdx) => {
                  const isActive = nowPlaying?.id === track.id
                  const art = artwork(track)
                  return (
                    <div
                      key={track.id}
                      draggable
                      onDragStart={(e) => { setDragIdx(trackIdx); e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverIdxRef.current !== trackIdx) { dragOverIdxRef.current = trackIdx; setDragOverIdx(trackIdx) } }}
                      onDragEnd={() => { const from = dragIdx; const to = dragOverIdxRef.current; if (from !== null && to !== null) handleDragDrop(from, to); setDragIdx(null); setDragOverIdx(null); dragOverIdxRef.current = null }}
                      className={`flex items-center gap-2 py-2 px-2 -mx-2 rounded-lg transition-all duration-200
                        ${dragOverIdx === trackIdx && dragIdx !== null && dragIdx !== trackIdx ? 'border-t-2 border-purple-400/50' : 'border-t-2 border-transparent'}
                        ${dragIdx === trackIdx ? 'opacity-40' : ''}
                        ${isActive ? 'bg-purple-500/10' : 'hover:bg-white/[0.04]'}`}
                    >
                      {/* Drag handle */}
                      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                        </svg>
                      </div>
                      <button
                        onClick={() => handlePreview(track)}
                        className="relative flex-shrink-0 w-8 h-8 rounded-md overflow-hidden bg-white/[0.06] group"
                        aria-label={isActive ? 'Stop preview' : 'Preview'}
                      >
                        {art ? (
                          <img src={art} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" onError={handleImgError} />
                        ) : (
                          <div className="w-full h-full bg-white/[0.04]" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {isActive && isPlaying ? (
                            <svg className="text-purple-300" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg className="text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="5,3 19,12 5,21" />
                            </svg>
                          )}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <a
                          href={track.permalink ? `https://audius.co${track.permalink}` : `https://audius.co/tracks/${track.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[11px] truncate transition-colors duration-200 block hover:underline ${isActive ? 'text-purple-200' : 'text-white hover:text-white/80'}`}
                        >
                          {track.title}
                        </a>
                        <p className="text-white/50 text-[9px] truncate">{track.user?.name}</p>
                      </div>
                      <span className="hidden sm:inline text-[9px] font-mono text-white/40 flex-shrink-0">{formatDuration(track.duration)}</span>
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setPlMenuTrackId(plMenuTrackId === track.id ? null : track.id)}
                          className="p-1 text-white/40 hover:text-white/70 transition-colors duration-200 rounded"
                          aria-label="Track options"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="19" r="1.5" />
                          </svg>
                        </button>
                        {plMenuTrackId === track.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-full mt-1 z-50 bg-black/80 backdrop-blur-md border border-white/10
                                       rounded-lg shadow-xl shadow-black/50 py-1 min-w-[150px]"
                          >
                            <button
                              onClick={() => { removeFromPlaylist(track.id); setPlMenuTrackId(null) }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Remove
                            </button>
                            <button
                              onClick={() => { handleCopyLink(track); setPlMenuTrackId(null) }}
                              className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                              {copiedTrackId === track.id ? 'Copied!' : 'Copy link'}
                            </button>
                            <button
                              onClick={() => { handleBlockArtist(track); setPlMenuTrackId(null) }}
                              className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              Hide artist
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
