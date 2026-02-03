export default function Controls({ isPlaying, onPlayPause, onSkip, onBlock, disabled }) {
  return (
    <div className="flex items-center gap-8">
      {/* Block — don't play this again */}
      <button
        onClick={onBlock}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center
                   transition-all duration-300
                   hover:scale-110 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Don't play this again"
        title="Don't play this again"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2"
             className="text-white/20 hover:text-red-400/60 transition-colors duration-300">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className="w-20 h-20 rounded-full
                   border border-white/15 hover:border-white/30
                   flex items-center justify-center
                   transition-all duration-500 ease-out
                   hover:scale-105 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" className="text-white/80">
            <rect x="4" y="3" width="5" height="16" rx="1.5" />
            <rect x="13" y="3" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" className="text-white/80 ml-1">
            <polygon points="5,2 19,11 5,20" />
          </svg>
        )}
      </button>

      {/* Skip */}
      <button
        onClick={onSkip}
        disabled={disabled}
        className="w-10 h-10 flex items-center justify-center
                   transition-all duration-300
                   hover:scale-110 active:scale-95
                   disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100"
        aria-label="Skip"
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
