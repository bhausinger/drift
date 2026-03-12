import { DJ_GENRES, DJ_KEYS, DJ_MOODS } from '../../utils/audius'

export default function SearchFilters({
  showSearch, setShowSearch,
  searchQuery, setSearchQuery, handleSearch, handleRandomize, searching, searchTimerRef,
  selectedGenres, toggleGenre,
  showAdvanced, setShowAdvanced,
  bpmMin, setBpmMin, bpmMax, setBpmMax,
  selectedKey, setSelectedKey,
  selectedMood, setSelectedMood,
  minDuration, setMinDuration, maxDuration, setMaxDuration,
  releasedWithin, setReleasedWithin,
}) {
  const activeFilterCount = [bpmMin, bpmMax, selectedKey, selectedMood, minDuration, maxDuration, releasedWithin].filter(Boolean).length

  return (
    <div className="px-6 sm:px-8 pb-4 flex-shrink-0 space-y-4">
      {showSearch && (<>
        {/* Search bar */}
        <div className="max-w-2xl mx-auto w-full">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search tracks, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { clearTimeout(searchTimerRef.current); handleSearch() } }}
              className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-24 py-2.5 text-sm text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08]
                         transition-all duration-300"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                onClick={handleRandomize}
                disabled={searching}
                className="px-2 py-1.5 text-white/50 hover:text-purple-300 text-[11px] transition-all duration-300 disabled:opacity-40"
                aria-label="Random mix"
                title="Random mix"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
              <button
                data-action="dj-search"
                onClick={() => { clearTimeout(searchTimerRef.current); handleSearch() }}
                disabled={searching}
                className="px-4 py-1.5
                           bg-purple-500/20 hover:bg-purple-500/30 text-purple-300/90 text-[11px] tracking-wider uppercase
                           rounded-lg transition-all duration-300 disabled:opacity-40"
              >
                {searching ? '...' : 'search'}
              </button>
            </div>
          </div>
        </div>

        {/* Genre pills */}
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0
                          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {DJ_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`text-[10px] tracking-wider px-3 py-1.5 rounded-full transition-all duration-300 border flex-shrink-0
                  ${selectedGenres.includes(genre)
                    ? 'bg-purple-500/25 border-purple-500/40 text-purple-200'
                    : 'bg-transparent border-white/15 text-white/60 hover:border-white/30 hover:text-white/85'
                  }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </>)}

      {/* Toggle search/genres visibility + Advanced filters toggle */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setShowSearch((v) => !v)}
          className={`flex items-center gap-1.5 text-[10px] tracking-wider uppercase transition-all duration-300
            ${!showSearch ? 'text-purple-300' : 'text-white/40 hover:text-white/60'}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-300 ${showSearch ? '' : 'rotate-180'}`}>
            <polyline points="6 15 12 9 18 15" />
          </svg>
          search
        </button>
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`flex items-center gap-1.5 text-[10px] tracking-wider uppercase transition-all duration-300
            ${showAdvanced ? 'text-purple-300' : 'text-white/40 hover:text-white/60'}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          filters{activeFilterCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-[9px]">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
        <div className="flex items-end gap-1.5">
          <div>
            <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">BPM</label>
            <input
              type="number"
              placeholder="min"
              value={bpmMin}
              onChange={(e) => setBpmMin(e.target.value)}
              className="w-16 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                         transition-colors duration-300"
            />
          </div>
          <span className="text-white/60 text-xs pb-1.5">&ndash;</span>
          <input
            type="number"
            placeholder="max"
            value={bpmMax}
            onChange={(e) => setBpmMax(e.target.value)}
            className="w-16 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                       placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                       transition-colors duration-300"
          />
        </div>

        <div>
          <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">Key</label>
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                       focus:outline-none focus:border-purple-500/40 appearance-none pr-6
                       [&>option]:bg-neutral-950 [&>option]:text-white transition-colors duration-300"
          >
            <option value="">Any</option>
            {DJ_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">Mood</label>
          <select
            value={selectedMood}
            onChange={(e) => setSelectedMood(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                       focus:outline-none focus:border-purple-500/40 appearance-none pr-6
                       [&>option]:bg-neutral-950 [&>option]:text-white transition-colors duration-300"
          >
            <option value="">Any</option>
            {DJ_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">Duration</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="min"
              value={minDuration}
              onChange={(e) => setMinDuration(e.target.value)}
              className="w-[4.5rem] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                         transition-colors duration-300"
            />
            <span className="text-white/30 text-xs">–</span>
            <input
              type="number"
              placeholder="max"
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              className="w-[4.5rem] bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                         transition-colors duration-300"
            />
          </div>
        </div>

        <div>
          <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">Released</label>
          <select
            value={releasedWithin}
            onChange={(e) => setReleasedWithin(e.target.value)}
            className="bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                       focus:outline-none focus:border-purple-500/40 appearance-none pr-6
                       [&>option]:bg-neutral-950 [&>option]:text-white transition-colors duration-300"
          >
            <option value="">Any time</option>
            <option value="1d">Today</option>
            <option value="7d">This week</option>
            <option value="14d">Last 2 weeks</option>
            <option value="30d">This month</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">This year</option>
          </select>
        </div>
      </div>}

      {/* Divider */}
      <div className="max-w-4xl mx-auto w-full border-b border-white/[0.06]" />
    </div>
  )
}
