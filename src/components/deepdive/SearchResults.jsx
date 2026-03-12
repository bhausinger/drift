import { formatDuration } from '../../utils/audius'
import { addHandle } from '../../utils/handleList'

export default function SearchResults({
  results, searching, searchError, activePlaylist, splitTab,
  nowPlaying, isPlaying, handlePreview,
  playlist, addToPlaylistDirect,
  // Track menu
  menuTrackId, setMenuTrackId, menuRef,
  setPlaylistPicker, handleStartRadio, handleCopyLink, handleBlockArtist, copiedTrackId,
  // Team
  isTeam, handleList, setHandleList, setToast,
  // Utils
  artwork, handleImgError,
}) {
  return (
    <div className={`flex-1 min-h-0 overflow-hidden flex flex-col
      ${activePlaylist && splitTab !== 'search' ? 'hidden sm:flex' : ''}`}>

      <div className="flex-1 overflow-y-auto min-h-0">
        {searching && (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
          </div>
        )}

        {!searching && results.length === 0 && !searchError && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/15 mb-3">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="text-white/30 text-xs tracking-wide">Search or pick genres to discover tracks</p>
          </div>
        )}

        <div className={`max-w-3xl mx-auto px-4 sm:px-6 pb-4 ${!searching && results.length === 0 ? 'hidden' : ''}`}>
          {searchError && (
            <p className="text-red-400/80 text-xs py-2">{searchError}</p>
          )}

          {!searching && results.length > 0 && (
            <p className="text-white/70 text-[10px] tracking-wider pb-2">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          )}

          <div className="space-y-0.5">
            {results.map((track) => {
              const isActive = nowPlaying?.id === track.id
              const inActive = activePlaylist ? activePlaylist.tracks.some((t) => t.id === track.id) : playlist.some((t) => t.id === track.id)
              const art = artwork(track)
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 py-2.5 sm:py-2 px-3 -mx-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-purple-500/10'
                      : 'hover:bg-white/[0.04]'
                    } ${inActive ? 'opacity-40' : ''}`}
                >
                  {/* Artwork + play overlay */}
                  <button
                    onClick={() => handlePreview(track)}
                    className="relative flex-shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-md overflow-hidden bg-white/[0.06] group"
                    aria-label={isActive ? 'Stop preview' : 'Preview'}
                  >
                    {art ? (
                      <img src={art} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" onError={handleImgError} />
                    ) : (
                      <div className="w-full h-full bg-white/[0.04]" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {isActive && isPlaying ? (
                        <svg className="text-purple-300" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                      ) : (
                        <svg className="text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={track.permalink ? `https://audius.co${track.permalink}` : `https://audius.co/tracks/${track.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`text-xs truncate transition-colors duration-200 block hover:underline ${isActive ? 'text-purple-200' : 'text-white hover:text-white/80'}`}
                    >
                      {track.title}
                    </a>
                    <p className="text-white/70 text-[10px] truncate">
                      {track.user?.name}
                      {activePlaylist && track.bpm ? <span className="text-white/40 ml-1.5">· {Math.round(track.bpm)} bpm</span> : ''}
                      {activePlaylist && track.musical_key ? <span className="text-white/40 ml-1">· {track.musical_key}</span> : ''}
                    </p>
                  </div>

                  {/* Metadata columns — full view only */}
                  {!activePlaylist && (
                    <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-[10px] font-mono text-white/70">
                      {track.bpm ? <span className="w-14 text-right">{Math.round(track.bpm)} bpm</span> : <span className="w-14" />}
                      {track.musical_key ? <span className="w-20 text-right">{track.musical_key}</span> : <span className="w-20" />}
                      <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                    </div>
                  )}
                  {activePlaylist && (
                    <span className="hidden sm:inline flex-shrink-0 text-[10px] font-mono text-white/50">{formatDuration(track.duration)}</span>
                  )}

                  {/* Add handle to list (team only) */}
                  {!activePlaylist && isTeam && track.user?.handle && (
                    <button
                      onClick={() => {
                        const updated = addHandle(track.user.handle)
                        setHandleList(updated)
                        setToast(`Added @${track.user.handle}`)
                        setTimeout(() => setToast(null), 1500)
                      }}
                      className={`flex-shrink-0 p-1 transition-colors duration-200 ${handleList.includes(track.user.handle.toLowerCase()) ? 'text-purple-400/50' : 'text-white/20 hover:text-white/40'}`}
                      aria-label="Add handle to list"
                      title={`Add @${track.user.handle}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  )}

                  {/* Start radio */}
                  {!activePlaylist && (
                    <button
                      onClick={() => handleStartRadio(track)}
                      className="flex-shrink-0 p-1 text-white/30 hover:text-purple-300 transition-colors duration-200"
                      aria-label="Start radio"
                      title="Start radio"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="2" />
                        <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                        <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                      </svg>
                    </button>
                  )}

                  {/* Add to playlist button */}
                  {activePlaylist && (
                    <button
                      onClick={() => addToPlaylistDirect(track)}
                      disabled={inActive}
                      className={`flex-shrink-0 p-1.5 transition-colors duration-200 rounded-md
                        ${inActive ? 'text-purple-400/50' : 'text-white/30 hover:text-purple-300 hover:bg-white/[0.06]'}`}
                      aria-label={`Add to ${activePlaylist.name}`}
                    >
                      {inActive ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Three-dot menu — browse mode */}
                  {!activePlaylist && (
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setMenuTrackId(menuTrackId === track.id ? null : track.id)}
                        className="p-1.5 text-white/50 hover:text-white/80 transition-colors duration-200 rounded"
                        aria-label="Track options"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {menuTrackId === track.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full mt-1 z-50 bg-black/80 backdrop-blur-md border border-white/10
                                     rounded-lg shadow-xl shadow-black/50 py-1 min-w-[170px]"
                        >
                          <button
                            onClick={() => { setPlaylistPicker({ track }); setMenuTrackId(null) }}
                            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add to playlist
                          </button>
                          <div className="my-1 border-t border-white/[0.06]" />
                          <button
                            onClick={() => { handleStartRadio(track); setMenuTrackId(null) }}
                            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="2" />
                              <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                              <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                            </svg>
                            Start radio
                          </button>
                          <button
                            onClick={() => handleCopyLink(track)}
                            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            {copiedTrackId === track.id ? 'Copied!' : 'Copy link'}
                          </button>
                          <button
                            onClick={() => handleBlockArtist(track)}
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
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
