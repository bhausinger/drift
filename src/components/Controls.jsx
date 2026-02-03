export default function Controls({ isPlaying, onPlayPause, onSkip, onPrev, disabled }) {
  return (
    <div className="flex items-center gap-6">
      {/* Previous */}
      <button
        onClick={onPrev}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center
                   transition-all duration-300
                   hover:scale-110 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Previous"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
             className="text-white/30 hover:text-white/60 transition-colors duration-300">
          <rect x="2" y="1" width="2.5" height="14" rx="0.75" />
          <polygon points="15,1 6,8 15,15" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className="w-16 h-16 rounded-full
                   border border-white/15 hover:border-white/30
                   flex items-center justify-center
                   transition-all duration-500 ease-out
                   hover:scale-105 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 22 22" fill="currentColor" className="text-white/80">
            <rect x="4" y="3" width="5" height="16" rx="1.5" />
            <rect x="13" y="3" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 22 22" fill="currentColor" className="text-white/80 ml-1">
            <polygon points="5,2 19,11 5,20" />
          </svg>
        )}
      </button>

      {/* Next / Skip */}
      <button
        onClick={onSkip}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center
                   transition-all duration-300
                   hover:scale-110 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Next"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"
             className="text-white/30 hover:text-white/60 transition-colors duration-300">
          <polygon points="1,1 10,8 1,15" />
          <rect x="11.5" y="1" width="2.5" height="14" rx="0.75" />
        </svg>
      </button>
    </div>
  )
}
