import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { searchDJTracks, fetchRandomMix, getBlockedArtists, fetchExcludedArtists } from '../utils/audius'
import { isTeamMember } from '../utils/team'

export function useDJSearch(user) {
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenres, setSelectedGenres] = useState([])
  const [bpmMin, setBpmMin] = useState('')
  const [bpmMax, setBpmMax] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedMood, setSelectedMood] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')
  const [releasedWithin, setReleasedWithin] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Results
  const [rawResults, setRawResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // Team-only: exclude 140 playlist artists
  const isTeam = isTeamMember(user)
  const [excludedArtists, setExcludedArtists] = useState(null)
  const [excludeEnabled, setExcludeEnabled] = useState(true)

  // Blocked artist filter counter (bust memo on block)
  const [blockVersion, setBlockVersion] = useState(0)
  const bumpBlockVersion = useCallback(() => setBlockVersion((v) => v + 1), [])

  // Pre-fetch 140 playlist artists for team members
  useEffect(() => {
    if (isTeam && !excludedArtists) {
      fetchExcludedArtists('l5Q60YO').then(setExcludedArtists)
    }
  }, [isTeam])

  const toggleGenre = useCallback((genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }, [])

  const handleSearch = useCallback(async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const tracks = await searchDJTracks({
        query: searchQuery,
        genres: selectedGenres,
        mood: selectedMood,
        bpmMin,
        bpmMax,
        key: selectedKey,
        sortBias: releasedWithin ? 'recent' : '',
      })
      setRawResults(tracks)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, selectedGenres, selectedMood, bpmMin, bpmMax, selectedKey, releasedWithin])

  // Auto-search on type (debounced)
  const searchFnRef = useRef(handleSearch)
  searchFnRef.current = handleSearch
  const searchTimerRef = useRef(null)
  useEffect(() => {
    if (searchQuery.length < 2) return
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => searchFnRef.current(), 500)
    return () => clearTimeout(searchTimerRef.current)
  }, [searchQuery])

  const handleRandomize = useCallback(async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const tracks = await fetchRandomMix()
      setRawResults(tracks)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [])

  // Cache blocked artists
  const blockedArtistsSet = useMemo(() => getBlockedArtists(), [blockVersion])

  // Live client-side filtering
  const results = useMemo(() => {
    const minBpm = bpmMin ? Number(bpmMin) : null
    const maxBpm = bpmMax ? Number(bpmMax) : null
    const minDur = minDuration ? Number(minDuration) * 60 : null
    const maxDur = maxDuration ? Number(maxDuration) * 60 : null
    let dateCutoff = null
    if (releasedWithin) {
      const now = new Date()
      const cutoffs = {
        '1d': new Date(now - 24 * 60 * 60 * 1000),
        '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
        '14d': new Date(now - 14 * 24 * 60 * 60 * 1000),
        '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
        '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
        '1y': new Date(now.getFullYear(), 0, 1),
      }
      dateCutoff = cutoffs[releasedWithin] || null
    }
    return rawResults.filter((t) => {
      if (blockedArtistsSet.has(t.user?.handle)) return false
      if (excludeEnabled && excludedArtists && t.user?.handle && excludedArtists.has(t.user.handle.toLowerCase())) return false
      if (minBpm && t.bpm && t.bpm < minBpm) return false
      if (maxBpm && t.bpm && t.bpm > maxBpm) return false
      if (selectedKey && t.musical_key && t.musical_key !== selectedKey) return false
      if (selectedMood && t.mood && t.mood.toLowerCase() !== selectedMood.toLowerCase()) return false
      if (minDur && t.duration && t.duration < minDur) return false
      if (maxDur && t.duration > maxDur) return false
      if (dateCutoff) {
        const released = t.release_date ? new Date(t.release_date) : t.created_at ? new Date(t.created_at) : null
        if (released && released < dateCutoff) return false
      }
      return true
    })
  }, [rawResults, bpmMin, bpmMax, selectedKey, selectedMood, minDuration, maxDuration, releasedWithin, blockedArtistsSet, excludedArtists, excludeEnabled])

  return {
    // Filter state
    searchQuery, setSearchQuery,
    selectedGenres, toggleGenre, setSelectedGenres,
    bpmMin, setBpmMin, bpmMax, setBpmMax,
    selectedKey, setSelectedKey,
    selectedMood, setSelectedMood,
    minDuration, setMinDuration, maxDuration, setMaxDuration,
    releasedWithin, setReleasedWithin,
    showAdvanced, setShowAdvanced,
    // Results
    rawResults, setRawResults, results,
    searching, setSearching, searchError, setSearchError,
    // Actions
    handleSearch, handleRandomize, searchTimerRef,
    // Team
    isTeam, excludedArtists, excludeEnabled, setExcludeEnabled,
    // Block
    bumpBlockVersion,
  }
}
