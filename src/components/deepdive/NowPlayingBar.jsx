import { formatDuration } from '../../utils/audius'

export default function NowPlayingBar({
  nowPlaying, isPlaying, currentTime, duration, volume, setVolume,
  progressPct, handlePreview, handleNext, handlePrev,
  handleLike, handleRepost, likedTracks, repostedTracks,
  handleStartRadio, handleCopyLink, handleBlockArtist,
  copiedTrackId, setPlaylistPicker,
  showNpMenu, setShowNpMenu, npMenuRef,
  artwork, handleImgError, audioRef,
}) {
  if (!nowPlaying) return null

  return (
    <div className="flex-shrink-0 bg-black/20 backdrop-blur-md">
      <div className="max-w-4xl mx-auto px-4 sm:px-8">
        {/* Seek bar */}
        <div
          className="relative h-6 sm:h-3 group/seek cursor-pointer flex items-center touch-none"
          onClick={(e) => {
            const audio = audioRef.current
            if (!audio || !duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
            audio.currentTime = pct * duration
          }}
          onMouseDown={(e) => {
            const audio = audioRef.current
            if (!audio || !duration) return
            const bar = e.currentTarget
            const seek = (evt) => {
              const rect = bar.getBoundingClientRect()
              const pct = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width))
              audio.currentTime = pct * duration
            }
            const stop = () => {
              document.removeEventListener('mousemove', seek)
              document.removeEventListener('mouseup', stop)
            }
            document.addEventListener('mousemove', seek)
            document.addEventListener('mouseup', stop)
          }}
          onTouchStart={(e) => {
            const audio = audioRef.current
            if (!audio || !duration) return
            const bar = e.currentTarget
            const seek = (evt) => {
              const touch = evt.touches[0]
              if (!touch) return
              const rect = bar.getBoundingClientRect()
              const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
              audio.currentTime = pct * duration
            }
            seek(e)
            const stop = () => {
              document.removeEventListener('touchmove', seek)
              document.removeEventListener('touchend', stop)
            }
            document.addEventListener('touchmove', seek)
            document.addEventListener('touchend', stop)
          }}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 sm:h-0.5 group-hover/seek:h-1.5 sm:group-hover/seek:h-1 bg-white/[0.08] rounded-full transition-all duration-200">
            <div
              className="h-full bg-purple-400/60 rounded-full relative transition-[width] duration-100"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
                              w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-300 shadow shadow-purple-500/40
                              opacity-0 group-hover/seek:opacity-100 scale-0 group-hover/seek:scale-100
                              sm:transition-all sm:duration-200" />
            </div>
          </div>
        </div>

        {/* Mobile: time display */}
        <div className="flex sm:hidden items-center justify-between px-0.5 -mt-1 mb-1">
          <span className="text-[10px] font-mono text-white/40">{formatDuration(currentTime)}</span>
          <span className="text-[10px] font-mono text-white/40">{formatDuration(duration || nowPlaying.duration)}</span>
        </div>

        <div className="py-2 sm:py-2 flex items-center gap-2 sm:gap-0">
          {/* Left — artwork + info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:w-1/3">
            <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-md overflow-hidden bg-white/[0.06] flex-shrink-0">
              {artwork(nowPlaying) ? (
                <img src={artwork(nowPlaying)} alt="" className="w-full h-full object-cover opacity-80" onError={handleImgError} />
              ) : (
                <div className="w-full h-full bg-white/[0.04]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-purple-200 text-xs sm:text-xs truncate">{nowPlaying.title}</p>
              <p className="text-white/70 text-[10px] truncate">{nowPlaying.user?.name}</p>
            </div>
          </div>

          {/* Center — transport controls */}
          <div className="flex items-center justify-center gap-1 sm:gap-3 sm:w-1/3 flex-shrink-0">
            <button
              onClick={handlePrev}
              className="text-white/40 hover:text-white/80 transition-colors p-2 sm:p-1"
              aria-label="Previous"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="5" width="2" height="14" />
                <polygon points="19,5 9,12 19,19" />
              </svg>
            </button>
            <button
              onClick={() => handlePreview(nowPlaying)}
              className="text-white/80 hover:text-white transition-colors p-2.5 sm:p-1.5 bg-white/[0.06] rounded-full hover:bg-white/[0.1]"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="20" height="20" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="20" height="20" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </button>
            <button
              onClick={handleNext}
              className="text-white/40 hover:text-white/80 transition-colors p-2 sm:p-1"
              aria-label="Next"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,5 15,12 5,19" />
                <rect x="19" y="5" width="2" height="14" />
              </svg>
            </button>
          </div>

          {/* Right — time, volume, like, repost, menu */}
          <div className="hidden sm:flex items-center justify-end gap-1 sm:w-1/3">
            <div className="flex items-center gap-1.5 mr-2 text-[10px] font-mono text-white/50">
              <span>{formatDuration(currentTime)}</span>
              <span>/</span>
              <span>{formatDuration(duration || nowPlaying.duration)}</span>
            </div>
            {/* Volume */}
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={() => setVolume((v) => v > 0 ? 0 : 1)}
                className="p-1 text-white/40 hover:text-white/70 transition-colors"
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {volume === 0 ? (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>
                  ) : volume < 0.5 ? (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></>
                  ) : (
                    <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
                  )}
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 accent-purple-400 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Volume"
              />
            </div>
            <button
              onClick={() => handleLike(nowPlaying)}
              className="transition-all duration-200 active:scale-125 p-1"
              aria-label={likedTracks[nowPlaying.id] ? 'Unlike' : 'Like'}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill={likedTracks[nowPlaying.id] ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2"
                className={`transition-colors duration-300 ${likedTracks[nowPlaying.id] ? 'text-pink-400' : 'text-white/40 hover:text-white/70'}`}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button
              onClick={() => handleRepost(nowPlaying)}
              className="transition-all duration-200 active:scale-125 p-1"
              aria-label={repostedTracks[nowPlaying.id] ? 'Undo repost' : 'Repost'}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-colors duration-300 ${repostedTracks[nowPlaying.id] ? 'text-emerald-400' : 'text-white/40 hover:text-white/70'}`}
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>

            {/* Three-dot menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowNpMenu((v) => !v)}
                className="p-1.5 text-white/40 hover:text-white/70 transition-colors rounded"
                aria-label="Track options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {showNpMenu && (
                <div
                  ref={npMenuRef}
                  className="absolute right-0 bottom-full mb-1 z-50 bg-black/80 backdrop-blur-md border border-white/10
                             rounded-lg shadow-xl shadow-black/50 py-1 min-w-[170px]"
                >
                  <button
                    onClick={() => handleStartRadio(nowPlaying)}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="2" />
                      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
                      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
                    </svg>
                    Start radio
                  </button>
                  <button
                    onClick={() => { setPlaylistPicker({ track: nowPlaying }); setShowNpMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add to playlist
                  </button>
                  <button
                    onClick={() => { handleCopyLink(nowPlaying); setShowNpMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    {copiedTrackId === nowPlaying.id ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    onClick={() => { handleBlockArtist(nowPlaying); setShowNpMenu(false) }}
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

          {/* Mobile: like + repost only (compact) */}
          <div className="flex sm:hidden items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => handleLike(nowPlaying)}
              className="transition-all duration-200 active:scale-125 p-1.5"
              aria-label={likedTracks[nowPlaying.id] ? 'Unlike' : 'Like'}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill={likedTracks[nowPlaying.id] ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2"
                className={`transition-colors duration-300 ${likedTracks[nowPlaying.id] ? 'text-pink-400' : 'text-white/40'}`}
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button
              onClick={() => handleRepost(nowPlaying)}
              className="transition-all duration-200 active:scale-125 p-1.5"
              aria-label={repostedTracks[nowPlaying.id] ? 'Undo repost' : 'Repost'}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-colors duration-300 ${repostedTracks[nowPlaying.id] ? 'text-emerald-400' : 'text-white/40'}`}
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
