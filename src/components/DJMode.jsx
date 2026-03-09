import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  searchDJTracks, getStreamUrl, formatDuration, getImageFallback, fetchRandomMix,
  DJ_GENRES, DJ_KEYS, DJ_MOODS,
  getDraftPlaylist, saveDraftPlaylist, fetchUserPlaylists, fetchPlaylistTracks,
  getBlockedArtists, blockArtist, resolveTrackUrl, fetchExcludedArtists,
  fetchPlaylistDraft, savePlaylistDraft, clearPlaylistDraft, fetchAllPlaylistDraftIds,
} from '../utils/audius'
import { isTeamMember } from '../utils/team'
import { addHandle, getHandleList } from '../utils/handleList'
import HandleListPanel from './HandleListPanel'

export default function DJMode({ onClose, audioRef, handoffTrackRef }) {
  const { user, login } = useAuth()

  // Use shared audio element — no separate djAudioRef needed
  const djAudioRef = audioRef

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
  const [splitTab, setSplitTab] = useState('search') // mobile tab: 'search' | 'playlist'

  // Results — rawResults from API, filtered live by BPM/key/mood/genre
  const [rawResults, setRawResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [excludedArtists, setExcludedArtists] = useState(null) // Set of handles from 140 playlist
  const [excludeEnabled, setExcludeEnabled] = useState(true) // Toggle: exclude 140 playlist artists

  // Now playing — initialize from handoff if a track was playing on main
  const [nowPlaying, setNowPlaying] = useState(() => handoffTrackRef?.current?.currentTrack || null)
  const [isPlaying, setIsPlaying] = useState(() => handoffTrackRef?.current?.isPlaying || false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    try { return parseFloat(localStorage.getItem('drift:volume') ?? '1') } catch { return 1 }
  })

  // Refs to avoid stale closures in audio event handlers
  const nowPlayingRef = useRef(null)
  const resultsRef = useRef([])
  const repeatRef = useRef('off')

  // Drag-and-drop reorder state
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const dragOverIdxRef = useRef(null)

  // Repeat mode: 'off' | 'all' | 'one'
  const [repeatMode, setRepeatMode] = useState('off')

  // Track menu
  const [menuTrackId, setMenuTrackId] = useState(null)
  const menuRef = useRef(null)

  // Blocked artist filter counter (bust memo on block)
  const [blockVersion, setBlockVersion] = useState(0)
  const [toast, setToast] = useState(null)

  // Handle list (team scouting)
  const [showHandleList, setShowHandleList] = useState(false)
  const [handleList, setHandleList] = useState(() => getHandleList())
  const isTeam = isTeamMember(user)

  // Pre-fetch 140 playlist artists for team members
  useEffect(() => {
    if (isTeam && !excludedArtists) {
      fetchExcludedArtists('l5Q60YO').then(setExcludedArtists)
    }
  }, [isTeam])

  // Playlist panel — left side library + detail view
  const [playlist, setPlaylist] = useState(() => getDraftPlaylist())
  const [playlistName, setPlaylistName] = useState('')
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [userPlaylists, setUserPlaylists] = useState([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)

  // Active playlist view: null = library list, object = viewing a playlist
  // { id, name, artwork, tracks: [], isNew: bool }
  const [activePlaylist, setActivePlaylist] = useState(null)
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false)

  // Create playlist modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDescription, setCreateDescription] = useState('')
  const [createIsPrivate, setCreateIsPrivate] = useState(true)
  const [createArtwork, setCreateArtwork] = useState(null)
  const artworkInputRef = useRef(null)

  // Draft metadata — stored when user fills out the create modal
  const [draftMeta, setDraftMeta] = useState(null)

  // Set of playlist IDs that have server-side drafts
  const [draftPlaylistIds, setDraftPlaylistIds] = useState(new Set())

  // Fetch user's Audius playlists and draft IDs when logged in and panel opens
  useEffect(() => {
    if (!user || !showPlaylist) return
    setLoadingPlaylists(true)
    Promise.all([
      fetchUserPlaylists(user.userId),
      fetchAllPlaylistDraftIds(user.userId),
    ]).then(([pl, draftIds]) => {
      setUserPlaylists(pl)
      setDraftPlaylistIds(new Set(draftIds))
    }).finally(() => setLoadingPlaylists(false))
  }, [user, showPlaylist])

  // Sync draft playlist changes back to localStorage
  useEffect(() => { saveDraftPlaylist(playlist) }, [playlist])

  // Persist draft edits for existing playlists (debounced save to server)
  const saveDraftTimer = useRef(null)
  useEffect(() => {
    if (!user || !activePlaylist || activePlaylist.isNew || !activePlaylist.id || !activePlaylist.originalTracks) return
    const currentIds = activePlaylist.tracks.map((t) => t.id).join(',')
    const originalIds = activePlaylist.originalTracks.map((t) => t.id).join(',')
    const hasChanges = currentIds !== originalIds
    const plId = activePlaylist.id
    // Update sidebar indicator immediately
    setDraftPlaylistIds((prev) => {
      const next = new Set(prev)
      if (hasChanges) next.add(plId); else next.delete(plId)
      return next
    })
    clearTimeout(saveDraftTimer.current)
    saveDraftTimer.current = setTimeout(() => {
      if (hasChanges) {
        savePlaylistDraft(user.userId, plId, activePlaylist.tracks)
      } else {
        clearPlaylistDraft(user.userId, plId)
      }
    }, 1000)
    return () => clearTimeout(saveDraftTimer.current)
  }, [activePlaylist, user])

  // Open an existing playlist — fetch its tracks and restore draft if saved
  const openPlaylist = useCallback(async (pl) => {
    setActivePlaylist({ id: pl.id, name: pl.playlistName || pl.playlist_name || 'Untitled', artwork: pl.artwork?.['150x150'] || null, tracks: [], originalTracks: [], isNew: false, description: pl.description || '', isPrivate: pl.is_private ?? pl.isPrivate ?? false })
    setShowPlaylist(false) // Auto-hide library sidebar to give split view full width
    setLoadingPlaylistTracks(true)
    try {
      const [tracks, savedDraft] = await Promise.all([
        fetchPlaylistTracks(pl.id),
        user ? fetchPlaylistDraft(user.userId, pl.id) : null,
      ])
      setActivePlaylist((prev) => prev ? {
        ...prev,
        tracks: savedDraft || tracks,
        originalTracks: tracks,
      } : null)
      if (savedDraft) {
        setToast('Restored unsaved draft')
        setTimeout(() => setToast(null), 2000)
      }
    } finally {
      setLoadingPlaylistTracks(false)
    }
  }, [user])

  // Open the draft (new) playlist detail view
  const openDraftPlaylist = useCallback(() => {
    setActivePlaylist({ id: null, name: draftMeta?.name || playlistName || 'New Playlist', artwork: draftMeta?.artwork || null, tracks: playlist, isNew: true })
    setShowPlaylist(false)
  }, [playlist, playlistName, draftMeta])

  // Go back to the library list
  const backToLibrary = useCallback(() => {
    setActivePlaylist(null)
    setSaveResult(null)
    setShowPlaylist(true) // Re-open library sidebar
  }, [])

  // Per-track like/repost state  { trackId: true }
  const [likedTracks, setLikedTracks] = useState({})
  const [repostedTracks, setRepostedTracks] = useState({})
  const [copiedTrackId, setCopiedTrackId] = useState(null)

  const toggleGenre = useCallback((genre) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    )
  }, [])

  const handleSearch = useCallback(async () => {
    setSearching(true)
    setSearchError(null)
    setSaveResult(null)
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
    setActivePlaylist(null)
    try {
      const tracks = await fetchRandomMix()
      setRawResults(tracks)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [])

  // Live client-side filtering — changes instantly without re-searching
  const results = useMemo(() => {
    const minBpm = bpmMin ? Number(bpmMin) : null
    const maxBpm = bpmMax ? Number(bpmMax) : null
    const minDur = minDuration ? Number(minDuration) * 60 : null
    const maxDur = maxDuration ? Number(maxDuration) * 60 : null
    const blockedArtists = getBlockedArtists()
    // Date cutoff for release date filter
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
      if (blockedArtists.has(t.user?.handle)) return false
      if (excludeEnabled && excludedArtists && t.user?.handle && excludedArtists.has(t.user.handle.toLowerCase())) return false
      if (minBpm && t.bpm && t.bpm < minBpm) return false
      if (maxBpm && t.bpm && t.bpm > maxBpm) return false
      if (selectedKey && t.musical_key && t.musical_key !== selectedKey) return false
      if (selectedMood && t.mood && t.mood.toLowerCase() !== selectedMood.toLowerCase()) return false
      if (minDur && t.duration && t.duration < minDur) return false
      if (maxDur && t.duration > maxDur) return false
      if (dateCutoff) {
        const released = t.release_date ? new Date(t.release_date) : t.created_at ? new Date(t.created_at) : null
        // Only exclude tracks that have a date AND it's before the cutoff
        // Tracks without date data pass through (we can't know when they were released)
        if (released && released < dateCutoff) return false
      }
      return true
    })
  }, [rawResults, bpmMin, bpmMax, selectedKey, selectedMood, minDuration, maxDuration, releasedWithin, blockVersion, excludedArtists, excludeEnabled])

  // Keep refs in sync for audio event handlers
  useEffect(() => { nowPlayingRef.current = nowPlaying }, [nowPlaying])
  useEffect(() => { resultsRef.current = activePlaylist ? activePlaylist.tracks : results }, [results, activePlaylist])
  useEffect(() => { repeatRef.current = repeatMode }, [repeatMode])

  const handlePreview = useCallback((track) => {
    const audio = djAudioRef.current
    if (!audio) return

    // Always ensure volume is correct (crossfade in main player may have zeroed it)
    audio.volume = volume

    if (nowPlaying?.id === track.id) {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        audio.play().catch(() => {})
        setIsPlaying(true)
      }
      return
    }

    audio.src = getStreamUrl(track.id)
    audio.load()
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    setNowPlaying(track)
  }, [nowPlaying, isPlaying, volume])

  // Keep audio volume in sync
  useEffect(() => {
    const audio = djAudioRef.current
    if (audio) audio.volume = volume
    localStorage.setItem('drift:volume', String(volume))
  }, [volume])

  // Track audio time updates for now-playing bar
  useEffect(() => {
    const audio = djAudioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      const currentResults = resultsRef.current
      const current = nowPlayingRef.current
      const repeat = repeatRef.current

      // Repeat one — replay the same track
      if (repeat === 'one' && current) {
        audio.currentTime = 0
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        return
      }

      if (current && currentResults.length > 0) {
        const idx = currentResults.findIndex((t) => t.id === current.id)
        if (idx >= 0 && idx + 1 < currentResults.length) {
          // Auto-advance to next track
          const next = currentResults[idx + 1]
          audio.src = getStreamUrl(next.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(next)
          setCurrentTime(0)
          return
        }
        // End of list — if repeat all, loop back to start
        if (repeat === 'all' && currentResults.length > 0) {
          const first = currentResults[0]
          audio.src = getStreamUrl(first.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(first)
          setCurrentTime(0)
          return
        }
      }
      // End of list or no results — stop
      setNowPlaying(null); setIsPlaying(false); setCurrentTime(0); setDuration(0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  // Close menu on click outside
  useEffect(() => {
    if (!menuTrackId) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuTrackId(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuTrackId])

  // Playlist picker state: { trackId, x, y } when showing picker, null when hidden
  const [playlistPicker, setPlaylistPicker] = useState(null)
  const pickerRef = useRef(null)

  // Close picker on click outside
  useEffect(() => {
    if (!playlistPicker) return
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPlaylistPicker(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [playlistPicker])

  // Show the playlist picker for a track
  const showPlaylistPicker = useCallback((track, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setPlaylistPicker({ track, x: rect.right, y: rect.top })
    setMenuTrackId(null)
  }, [])

  // Direct add — used when we already know which playlist (active one or picked from dropdown)
  const addToPlaylistDirect = useCallback((track, targetPlaylistId) => {
    // If a specific playlist ID is given, add to that playlist
    if (targetPlaylistId === 'draft' || (!targetPlaylistId && activePlaylist?.isNew)) {
      // Adding to draft
      setPlaylist((prev) => {
        if (prev.some((t) => t.id === track.id)) return prev
        return [...prev, track]
      })
      setActivePlaylist((prev) => {
        if (!prev || !prev.isNew) return prev
        if (prev.tracks.some((t) => t.id === track.id)) return prev
        return { ...prev, tracks: [...prev.tracks, track] }
      })
    } else if (targetPlaylistId && targetPlaylistId !== 'draft') {
      // Adding to a specific existing Audius playlist — stage locally (draft editing)
      if (activePlaylist?.id === targetPlaylistId) {
        setActivePlaylist((prev) => {
          if (!prev) return prev
          if (prev.tracks.some((t) => t.id === track.id)) return prev
          return { ...prev, tracks: [...prev.tracks, track] }
        })
      }
      setToast(`Added to playlist (draft)`)
      setTimeout(() => setToast(null), 1500)
    } else if (activePlaylist && !activePlaylist.isNew) {
      // Adding to current active existing playlist — stage locally
      setActivePlaylist((prev) => {
        if (!prev) return prev
        if (prev.tracks.some((t) => t.id === track.id)) return prev
        return { ...prev, tracks: [...prev.tracks, track] }
      })
      setToast(`Added to ${activePlaylist.name}`)
      setTimeout(() => setToast(null), 1500)
    } else {
      // No active playlist — add to draft and auto-activate draft view
      setPlaylist((prev) => {
        if (prev.some((t) => t.id === track.id)) return prev
        const updated = [...prev, track]
        setActivePlaylist({
          id: null,
          name: draftMeta?.name || playlistName || 'New Playlist',
          artwork: draftMeta?.artwork || null,
          tracks: updated,
          isNew: true,
        })
        return updated
      })
    }
    setMenuTrackId(null)
    setPlaylistPicker(null)
  }, [activePlaylist, user, draftMeta, playlistName])

  // Legacy wrapper — used by paste URLs and now-playing menu
  const addToPlaylist = useCallback((track) => {
    addToPlaylistDirect(track)
  }, [addToPlaylistDirect])

  const removeFromPlaylist = useCallback((trackId) => {
    if (activePlaylist?.isNew) {
      setPlaylist((prev) => prev.filter((t) => t.id !== trackId))
      setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev)
    } else if (activePlaylist && !activePlaylist.isNew) {
      // Remove from existing playlist — stage locally (draft editing)
      setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev)
    } else {
      setPlaylist((prev) => prev.filter((t) => t.id !== trackId))
    }
  }, [activePlaylist])

  // Drag-and-drop reorder — commit the move on drop
  const handleDragDrop = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const reorder = (tracks) => {
      const arr = [...tracks]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return arr
    }
    setActivePlaylist((prev) => prev ? { ...prev, tracks: reorder(prev.tracks) } : prev)
    if (activePlaylist?.isNew) {
      setPlaylist((prev) => reorder(prev))
    }
  }, [activePlaylist])

  // Draft change detection for existing playlists
  const hasDraftChanges = useMemo(() => {
    if (!activePlaylist || activePlaylist.isNew || !activePlaylist.originalTracks) return false
    const currentIds = activePlaylist.tracks.map((t) => t.id).join(',')
    const originalIds = activePlaylist.originalTracks.map((t) => t.id).join(',')
    return currentIds !== originalIds
  }, [activePlaylist])

  // Revert draft changes
  const handleRevertEdits = useCallback(() => {
    if (!activePlaylist || activePlaylist.isNew || !activePlaylist.originalTracks) return
    setActivePlaylist((prev) => prev ? { ...prev, tracks: [...prev.originalTracks] } : prev)
    if (user && activePlaylist.id) {
      clearPlaylistDraft(user.userId, activePlaylist.id)
      setDraftPlaylistIds((prev) => { const next = new Set(prev); next.delete(activePlaylist.id); return next })
    }
    setToast('Changes reverted')
    setTimeout(() => setToast(null), 1500)
  }, [activePlaylist, user])

  // Publish draft edits to Audius
  const [publishingEdits, setPublishingEdits] = useState(false)
  const handlePublishEdits = useCallback(async (mode = 'replace') => {
    if (!user || !activePlaylist || activePlaylist.isNew) return
    setPublishingEdits(true)
    setSaveResult(null)
    try {
      const currentIds = activePlaylist.tracks.map((t) => t.id)
      const originalIds = activePlaylist.originalTracks.map((t) => t.id)

      const res = await fetch('/api/playlist-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncPlaylist',
          userId: user.userId,
          playlistId: activePlaylist.id,
          trackIds: currentIds,
          originalTrackIds: originalIds,
          mode,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to publish')
      }
      // Update originalTracks to match current state and clear persisted draft
      setActivePlaylist((prev) => prev ? { ...prev, originalTracks: [...prev.tracks] } : prev)
      if (activePlaylist.id) clearPlaylistDraft(user.userId, activePlaylist.id)
      setSaveResult('Playlist updated on Audius!')
      setToast('Published to Audius')
      setTimeout(() => { setToast(null); setSaveResult(null) }, 3000)
    } catch (err) {
      setSaveResult(`Error: ${err.message}`)
      setToast(`Error: ${err.message}`)
      setTimeout(() => setToast(null), 3000)
    } finally {
      setPublishingEdits(false)
    }
  }, [user, activePlaylist])

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
    setBlockVersion((v) => v + 1)
    setMenuTrackId(null)
    // If the now-playing track is by this artist, stop it
    if (nowPlaying?.user?.handle === track.user.handle) {
      const audio = djAudioRef.current
      if (audio) { audio.pause(); audio.removeAttribute('src') }
      setNowPlaying(null); setIsPlaying(false)
    }
    setToast(`Hidden all tracks by ${track.user.name}`)
    setTimeout(() => setToast(null), 2000)
  }, [nowPlaying])

  const handleCopyLink = useCallback((track) => {
    const url = track.permalink ? `https://audius.co${track.permalink}` : `https://audius.co/tracks/${track.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTrackId(track.id)
      setTimeout(() => setCopiedTrackId(null), 1500)
    })
    setMenuTrackId(null)
  }, [])

  // Copy all track URLs from the active playlist
  const handleCopyAllUrls = useCallback(() => {
    const tracks = activePlaylist ? activePlaylist.tracks : playlist
    if (tracks.length === 0) return
    const urls = tracks.map((t) =>
      t.permalink ? `https://audius.co${t.permalink}` : `https://audius.co/tracks/${t.id}`
    ).join('\n')
    navigator.clipboard.writeText(urls).then(() => {
      setToast(`Copied ${tracks.length} track URL${tracks.length !== 1 ? 's' : ''}`)
      setTimeout(() => setToast(null), 2000)
    })
  }, [activePlaylist, playlist])

  // Paste URLs panel — textarea for pasting Audius URLs line by line
  const [pasteLoading, setPasteLoading] = useState(false)
  const [showPastePanel, setShowPastePanel] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const handleSubmitPasteUrls = useCallback(async (clearExisting) => {
    const urls = pasteText.split(/[\n,\s]+/).filter((s) => s.includes('audius.co')).map((s) => s.trim()).filter(Boolean)
    if (urls.length === 0) {
      setToast('No Audius URLs found')
      setTimeout(() => setToast(null), 2000)
      return
    }
    setPasteLoading(true)
    // Clear existing tracks first if requested
    if (clearExisting) {
      if (activePlaylist?.isNew) {
        setPlaylist([])
        setActivePlaylist((prev) => prev ? { ...prev, tracks: [] } : prev)
      } else if (activePlaylist) {
        setActivePlaylist((prev) => prev ? { ...prev, tracks: [] } : prev)
      }
    }
    const resolved = []
    for (const url of urls) {
      const track = await resolveTrackUrl(url)
      if (track) resolved.push(track)
    }
    // Add all resolved tracks
    for (const track of resolved) {
      addToPlaylist(track)
    }
    setPasteLoading(false)
    setPasteText('')
    setShowPastePanel(false)
    setToast(resolved.length > 0 ? `Added ${resolved.length} track${resolved.length !== 1 ? 's' : ''}${clearExisting ? ' (replaced)' : ''}` : 'No tracks found')
    setTimeout(() => setToast(null), 2000)
  }, [pasteText, addToPlaylist, activePlaylist])

  const activeTracks = activePlaylist ? activePlaylist.tracks : playlist
  const totalDuration = activeTracks.reduce((sum, t) => sum + (t.duration || 0), 0)

  const openCreateModal = useCallback(() => {
    setCreateDescription('')
    setCreateIsPrivate(true)
    setCreateArtwork(null)
    setSaveResult(null)
    setShowCreateModal(true)
  }, [])

  const handleArtworkSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCreateArtwork(reader.result)
    reader.readAsDataURL(file)
  }, [])

  // Edit playlist modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPrivate, setEditIsPrivate] = useState(true)
  const [editArtwork, setEditArtwork] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const editArtworkInputRef = useRef(null)

  const openEditModal = useCallback(() => {
    if (!activePlaylist || activePlaylist.isNew) return
    setEditName(activePlaylist.name || '')
    setEditDescription(activePlaylist.description || '')
    setEditIsPrivate(activePlaylist.isPrivate ?? true)
    setEditArtwork(null) // null means "no change"
    setShowEditModal(true)
  }, [activePlaylist])

  const handleEditArtworkSelect = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditArtwork(reader.result)
    reader.readAsDataURL(file)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!user || !activePlaylist || activePlaylist.isNew) return
    setEditSaving(true)
    try {
      const metadata = {}
      if (editName.trim() && editName.trim() !== activePlaylist.name) metadata.playlistName = editName.trim()
      if (editDescription.trim() !== (activePlaylist.description || '')) metadata.description = editDescription.trim()
      if (editIsPrivate !== activePlaylist.isPrivate) metadata.isPrivate = editIsPrivate

      const body = {
        action: 'updatePlaylist',
        userId: user.userId,
        playlistId: activePlaylist.id,
        metadata,
      }
      if (editArtwork) body.artworkUrl = editArtwork

      await fetch('/api/playlist-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // Optimistic update
      setActivePlaylist((prev) => prev ? {
        ...prev,
        name: editName.trim() || prev.name,
        description: editDescription.trim(),
        isPrivate: editIsPrivate,
        artwork: editArtwork || prev.artwork,
      } : prev)
      setUserPlaylists((prev) => prev.map((p) =>
        p.id === activePlaylist.id ? {
          ...p,
          playlistName: editName.trim() || p.playlistName || p.playlist_name,
          playlist_name: editName.trim() || p.playlist_name || p.playlistName,
          description: editDescription.trim(),
          is_private: editIsPrivate,
          artwork: editArtwork ? { '150x150': editArtwork } : p.artwork,
        } : p
      ))
      setShowEditModal(false)
      setToast('Playlist updated')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setToast(`Error: ${err.message}`)
      setTimeout(() => setToast(null), 3000)
    } finally {
      setEditSaving(false)
    }
  }, [user, activePlaylist, editName, editDescription, editIsPrivate, editArtwork])

  // Start radio from playlist — use the genres/tags from playlist tracks as seeds
  const handlePlaylistRadio = useCallback(async () => {
    if (!activePlaylist || activePlaylist.tracks.length === 0) return
    setSearching(true)
    setSearchError(null)
    const tracks = activePlaylist.tracks
    // Collect genres from playlist tracks
    const genres = [...new Set(tracks.map((t) => t.genre).filter(Boolean))]
    const plName = activePlaylist.name
    setActivePlaylist(null)
    try {
      const radioTracks = await searchDJTracks({
        query: genres.length === 0 ? plName : '',
        genres: genres.slice(0, 3),
      })
      setRawResults(radioTracks)
      // Auto-play the first result
      if (radioTracks.length > 0) {
        const first = radioTracks[0]
        const audio = djAudioRef.current
        if (audio) {
          audio.src = getStreamUrl(first.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
          setNowPlaying(first)
          setCurrentTime(0)
        }
      }
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [activePlaylist])

  // Create a local draft from the modal — does NOT call the API
  const handleStartDraft = useCallback(() => {
    if (!playlistName.trim()) return
    const meta = {
      name: playlistName.trim(),
      description: createDescription.trim(),
      isPrivate: createIsPrivate,
      artwork: createArtwork || null,
    }
    setDraftMeta(meta)
    setShowCreateModal(false)
    // Open the draft as active playlist
    setActivePlaylist({ id: null, name: meta.name, artwork: meta.artwork, tracks: playlist, isNew: true })
    setShowPlaylist(true)
  }, [playlistName, createDescription, createIsPrivate, createArtwork, playlist])

  // Publish the draft playlist to Audius
  const handlePublishPlaylist = useCallback(async () => {
    if (!user || !draftMeta?.name) return
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch('/api/create-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          playlistName: draftMeta.name,
          trackIds: playlist.map((t) => t.id),
          description: draftMeta.description || '',
          isPrivate: draftMeta.isPrivate !== false,
          artworkUrl: draftMeta.artwork || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save')
      }
      const data = await res.json()
      const playlistId = data.playlistId

      // Optimistic update — set the new playlist as active immediately
      setActivePlaylist({
        id: playlistId,
        name: draftMeta.name,
        artwork: draftMeta.artwork,
        tracks: [...playlist],
        isNew: false,
      })
      setSaveResult('Playlist created on Audius!')

      // Optimistically add to sidebar playlist list immediately
      setUserPlaylists((prev) => [{
        id: playlistId,
        playlist_name: draftMeta.name,
        playlistName: draftMeta.name,
        is_private: draftMeta.isPrivate,
        artwork: draftMeta.artwork ? { '150x150': draftMeta.artwork } : null,
        track_count: playlist.length,
        description: draftMeta.description || '',
      }, ...prev])

      setPlaylist([])
      setPlaylistName('')
      setDraftMeta(null)

      // Background refresh of sidebar after a delay to let Audius index
      setTimeout(async () => {
        try {
          const playlists = await fetchUserPlaylists(user.userId)
          if (playlists.length > 0) setUserPlaylists(playlists)
        } catch {}
      }, 5000)
    } catch (err) {
      setSaveResult(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [user, playlist, draftMeta])

  const artwork = (track) => track?.artwork?.['150x150'] || track?.artwork?.['480x480'] || null

  // Image fallback handler — swap to another Audius node on error
  const handleImgError = useCallback((e) => {
    const img = e.target
    if (img.dataset.fallbackAttempted) return
    const fallback = getImageFallback(img.src)
    if (fallback) {
      img.dataset.fallbackAttempted = '1'
      img.src = fallback
    }
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off')
  }, [])

  // Start radio from a track — search for similar tracks by genre/tags
  const handleStartRadio = useCallback(async (track) => {
    if (!track) return
    setShowNpMenu(false)
    setSearching(true)
    setSearchError(null)
    setActivePlaylist(null)
    try {
      const genre = track.genre || ''
      const tags = (track.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
      // Use genre + a couple tags as search queries
      const queries = genre ? [genre] : []
      queries.push(...tags.slice(0, 2))
      if (queries.length === 0) queries.push(track.user?.name || 'electronic')
      const tracks = await searchDJTracks({
        query: '',
        genres: genre ? [genre] : [],
      })
      setRawResults(tracks)
      // Auto-play the first result
      if (tracks.length > 0) {
        const first = tracks[0]
        const audio = djAudioRef.current
        if (audio) {
          audio.src = getStreamUrl(first.id)
          audio.load()
          audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
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

  // Skip to next / previous track
  const handleNext = useCallback(() => {
    const trackList = activePlaylist ? activePlaylist.tracks : results
    if (!nowPlaying || trackList.length === 0) return
    const idx = trackList.findIndex((t) => t.id === nowPlaying.id)
    const nextIdx = idx >= 0 && idx + 1 < trackList.length ? idx + 1 : 0
    handlePreview(trackList[nextIdx])
  }, [nowPlaying, results, activePlaylist, handlePreview])

  const handlePrev = useCallback(() => {
    const audio = djAudioRef.current
    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const trackList = activePlaylist ? activePlaylist.tracks : results
    if (!nowPlaying || trackList.length === 0) return
    const idx = trackList.findIndex((t) => t.id === nowPlaying.id)
    const prevIdx = idx > 0 ? idx - 1 : trackList.length - 1
    handlePreview(trackList[prevIdx])
  }, [nowPlaying, results, activePlaylist, handlePreview])

  // Now-playing menu
  const [showNpMenu, setShowNpMenu] = useState(false)
  const npMenuRef = useRef(null)

  useEffect(() => {
    if (!showNpMenu) return
    const onClick = (e) => {
      if (npMenuRef.current && !npMenuRef.current.contains(e.target)) setShowNpMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showNpMenu])

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

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
          {isTeam && (
            <button
              onClick={() => setShowHandleList((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                         transition-all duration-300 border
                ${showHandleList
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                  : 'bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white'
                }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="hidden sm:inline">{handleList.length > 0 ? handleList.length : 'handles'}</span>
              <span className="sm:hidden">{handleList.length > 0 ? handleList.length : ''}</span>
            </button>
          )}
          {isTeam && (
            <button
              onClick={() => {
                setSelectedGenres(['Dubstep', 'Trap', 'Electronic'])
                setBpmMin('140')
                setBpmMax('140')
                setSearchQuery('')
                setSelectedMood('')
                setSelectedKey('')
                setMinDuration('1')
                setMaxDuration('7')
                setReleasedWithin('14d')
                setShowAdvanced(true)
                setActivePlaylist(null)
                // Trigger search after state updates
                setTimeout(() => {
                  document.querySelector('[data-action="dj-search"]')?.click()
                }, 50)
              }}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                         transition-all duration-300 border bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white"
            >
              140
            </button>
          )}
          {isTeam && excludedArtists && (
            <button
              onClick={() => setExcludeEnabled((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                         transition-all duration-300 border
                ${excludeEnabled
                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                  : 'bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white'
                }`}
            >
              <span className="hidden sm:inline">{excludeEnabled ? 'hiding playlist artists' : 'showing all artists'}</span>
              <span className="sm:hidden">{excludeEnabled ? 'hiding' : 'showing'}</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!user) { login(); return }
              setShowPlaylist((v) => !v)
            }}
            className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[10px] tracking-wider uppercase
                       transition-all duration-300 border
              ${showPlaylist
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                : 'bg-white/[0.06] border-white/15 text-white/80 hover:border-white/30 hover:text-white'
              }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="hidden sm:inline">{!user ? 'log in for playlists' : 'playlists'}</span>
            <span className="sm:hidden">{!user ? 'log in' : ''}</span>
          </button>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors duration-300 p-2 -m-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters — centered */}
      <div className="px-6 sm:px-8 pb-4 flex-shrink-0 space-y-4">
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

        {/* Genre pills — horizontal scroll on mobile, wrap on desktop */}
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

        {/* Advanced filters toggle */}
        {(() => {
          const count = [bpmMin, bpmMax, selectedKey, selectedMood, minDuration, maxDuration, releasedWithin].filter(Boolean).length
          return (
            <div className="flex justify-center">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className={`flex items-center gap-1.5 text-[10px] tracking-wider uppercase transition-all duration-300
                  ${showAdvanced ? 'text-purple-300' : 'text-white/40 hover:text-white/60'}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                filters{count > 0 && <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-[9px]">{count}</span>}
              </button>
            </div>
          )
        })()}

        {/* BPM + Key + Mood + Duration — centered */}
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
                className="w-14 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                           placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                           transition-colors duration-300"
              />
              <span className="text-white/30 text-xs">–</span>
              <input
                type="number"
                placeholder="max"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="w-14 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
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

      {/* Main content area — optional playlist library (left) + results/playlist tracks (center) */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Empty state overlay — centered across full width regardless of playlist panel */}
        {!activePlaylist && !searching && results.length === 0 && !searchError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="flex flex-col items-center justify-center gap-3">
              <svg className="text-white/30" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-white/60 text-xs">Search or pick genres to discover tracks</p>
            </div>
          </div>
        )}

        {/* Playlist library panel — LEFT side (always shows list) */}
        {showPlaylist && (
          <div className="absolute left-0 top-0 bottom-0 w-full sm:w-72 z-20 border-r border-white/[0.06] bg-black/80 sm:bg-black/60 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl shadow-black/30">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-white/90 text-[11px] tracking-wider uppercase">Playlists</h3>
              <button
                onClick={() => setShowPlaylist(false)}
                className="sm:hidden text-white/50 hover:text-white/80 transition-colors p-1.5 -m-1"
                aria-label="Close playlists"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* New playlist button */}
            <div className="px-4 py-2">
              <button
                onClick={openCreateModal}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/15
                           border border-purple-500/20 hover:border-purple-500/30 transition-all duration-300 group"
              >
                <div className="w-8 h-8 rounded-md bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-300">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <p className="text-purple-200 text-xs">New Playlist</p>
              </button>
            </div>

            {/* Show current draft in sidebar */}
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
                    <p className={`text-[11px] truncate ${activePlaylist?.isNew ? 'text-purple-200' : 'text-white/90'}`}>{draftMeta.name}</p>
                    <p className="text-white/40 text-[9px]">{playlist.length} tracks · draft</p>
                  </div>
                </button>
              </div>
            )}

            <div className="px-4"><div className="border-b border-white/[0.06]" /></div>

            {/* Existing playlists list */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2">
              {!user ? (
                <button
                  onClick={login}
                  className="w-full py-8 text-center text-white/40 text-[10px] tracking-wider hover:text-white/60 transition-colors"
                >
                  Log in to see your playlists
                </button>
              ) : loadingPlaylists ? (
                <div className="flex justify-center py-8">
                  <div className="w-4 h-4 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
                </div>
              ) : userPlaylists.length === 0 ? (
                <p className="text-white/40 text-[10px] text-center py-8">No playlists yet</p>
              ) : (
                <div className="space-y-0.5">
                  {userPlaylists.map((pl) => {
                    const plArt = pl.artwork?.['150x150'] || null
                    const isOpen = activePlaylist?.id === pl.id
                    const hasDraft = draftPlaylistIds.has(pl.id)
                    return (
                      <button
                        key={pl.id}
                        onClick={() => isOpen ? backToLibrary() : openPlaylist(pl)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 group text-left
                          ${isOpen ? 'bg-purple-500/10 border border-purple-500/20' : 'hover:bg-white/[0.04] border border-transparent'}`}
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
                          <p className={`text-[11px] truncate transition-colors ${isOpen ? 'text-purple-200' : 'text-white/90 group-hover:text-white'}`}>{pl.playlistName || pl.playlist_name || 'Untitled'}</p>
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

        {/* Handle list panel — RIGHT side (team only) */}
        {isTeam && showHandleList && (
          <HandleListPanel
            handles={handleList}
            onUpdate={setHandleList}
            onClose={() => setShowHandleList(false)}
          />
        )}

        {/* Results / Playlist tracks — side-by-side when playlist is active on desktop */}
        <div className={`flex-1 min-h-0 overflow-hidden ${activePlaylist ? 'flex flex-col sm:flex-row' : 'flex'}`}>

          {/* === LEFT COLUMN: Search results === */}
          <div className={`overflow-y-auto min-h-0
            ${activePlaylist
              ? `sm:w-1/2 sm:border-r sm:border-white/[0.06] ${splitTab === 'search' ? '' : 'hidden sm:block'}`
              : 'flex-1'}`}
          >
            {searching && (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
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
                          }`}
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

                        {/* Metadata columns — full view only (hidden in split view) */}
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

                        {/* Add handle to list (team only) — hide in split view */}
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

                        {/* Start radio — hide in split view */}
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

                        {/* Add to playlist button — always visible when a playlist is active, or when panel is open */}
                        {(activePlaylist || showPlaylist) && (
                          <button
                            onClick={(e) => activePlaylist ? addToPlaylistDirect(track) : showPlaylistPicker(track, e)}
                            disabled={inActive}
                            className={`flex-shrink-0 p-1.5 transition-colors duration-200 rounded-md
                              ${inActive ? 'text-purple-400/50' : 'text-white/30 hover:text-purple-300 hover:bg-white/[0.06]'}`}
                            aria-label={activePlaylist ? `Add to ${activePlaylist.name}` : 'Add to playlist'}
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

                        {/* Three-dot menu */}
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
                              <p className="px-3 py-1 text-[9px] text-white/30 tracking-wider uppercase">Add to playlist</p>
                              {draftMeta && (
                                <button
                                  onClick={() => addToPlaylistDirect(track, 'draft')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-300/60">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  {draftMeta.name}
                                </button>
                              )}
                              {userPlaylists.map((pl) => (
                                <button
                                  key={pl.id}
                                  onClick={() => addToPlaylistDirect(track, pl.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2 truncate"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                  </svg>
                                  <span className="truncate">{pl.playlistName || pl.playlist_name || 'Untitled'}</span>
                                </button>
                              ))}
                              {!draftMeta && userPlaylists.length === 0 && (
                                <p className="px-3 py-1.5 text-xs text-white/30">No playlists yet</p>
                              )}
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
                      </div>
                    )
                  })}
                </div>
              </div>
          </div>

          {/* === RIGHT COLUMN: Active playlist (only when one is open) === */}
          {activePlaylist && (
            <div className={`overflow-y-auto min-h-0
              sm:w-1/2 ${splitTab === 'playlist' ? '' : 'hidden sm:block'}`}
            >
              <div className="px-4 sm:px-6 pb-4">
                {/* Playlist header */}
                <div className="flex items-center gap-3 py-3 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
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
                  {activePlaylist.tracks.length > 0 && (
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
                  )}
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

                {/* Paste URLs panel */}
                {showPastePanel && (
                  <div className="mb-3 bg-white/[0.04] border border-white/10 rounded-lg p-3 space-y-2">
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Paste Audius URLs here, one per line..."
                      rows={3}
                      className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                                 placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300
                                 resize-none font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-white/30 text-[9px]">
                        {pasteText.split(/[\n,\s]+/).filter((s) => s.includes('audius.co')).length} URLs
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setShowPastePanel(false); setPasteText('') }}
                          className="px-2 py-0.5 text-[9px] text-white/50 hover:text-white/80 transition-colors"
                        >
                          cancel
                        </button>
                        {activePlaylist.tracks.length > 0 && (
                          <button
                            onClick={() => handleSubmitPasteUrls(true)}
                            disabled={pasteLoading || !pasteText.trim()}
                            className="px-2 py-0.5 bg-red-500/15 hover:bg-red-500/25 text-red-300/90 text-[9px]
                                       tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30 uppercase"
                          >
                            {pasteLoading ? '...' : 'replace all'}
                          </button>
                        )}
                        <button
                          onClick={() => handleSubmitPasteUrls(false)}
                          disabled={pasteLoading || !pasteText.trim()}
                          className="px-2 py-0.5 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[9px]
                                     tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30 uppercase"
                        >
                          {pasteLoading ? 'adding...' : 'keep & add'}
                        </button>
                      </div>
                    </div>
                  </div>
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
                              onClick={() => setMenuTrackId(menuTrackId === track.id ? null : track.id)}
                              className="p-1 text-white/40 hover:text-white/70 transition-colors duration-200 rounded"
                              aria-label="Track options"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                            {menuTrackId === track.id && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 z-50 bg-black/80 backdrop-blur-md border border-white/10
                                           rounded-lg shadow-xl shadow-black/50 py-1 min-w-[150px]"
                              >
                                <button
                                  onClick={() => removeFromPlaylist(track.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                  </svg>
                                  Remove
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
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

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
      </div>

      {/* Playlist picker dropdown (floating) */}
      {playlistPicker && (
        <div
          ref={pickerRef}
          className="fixed z-50 bg-black/90 backdrop-blur-md border border-white/10
                     rounded-lg shadow-xl shadow-black/50 py-1 min-w-[180px] max-w-[240px] max-h-[300px] overflow-y-auto"
          style={{ top: playlistPicker.y, right: Math.max(16, window.innerWidth - playlistPicker.x + 8) }}
        >
          <p className="px-3 py-1 text-[9px] text-white/30 tracking-wider uppercase">Add to playlist</p>
          {draftMeta && (
            <button
              onClick={() => addToPlaylistDirect(playlistPicker.track, 'draft')}
              className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-300/60 flex-shrink-0">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span className="truncate">{draftMeta.name}</span>
            </button>
          )}
          {userPlaylists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => addToPlaylistDirect(playlistPicker.track, pl.id)}
              className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-white/40">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span className="truncate">{pl.playlistName || pl.playlist_name || 'Untitled'}</span>
            </button>
          ))}
          {!draftMeta && userPlaylists.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-white/30">No playlists yet</p>
          )}
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-white/10
                        rounded-lg px-4 py-2 text-xs text-white/80 shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Now playing bar with like/repost */}
      {nowPlaying && (
        <div className="flex-shrink-0 bg-black/20 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-6 sm:px-8">
          {/* Seek bar */}
          <div
            className="relative h-8 sm:h-3 group/seek cursor-pointer flex items-center touch-none"
            onClick={(e) => {
              const audio = djAudioRef.current
              if (!audio || !duration) return
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              audio.currentTime = pct * duration
            }}
            onMouseDown={(e) => {
              const audio = djAudioRef.current
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
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 group-hover/seek:h-1 bg-white/[0.08] rounded-full transition-all duration-200">
              <div
                className="h-full bg-purple-400/60 rounded-full relative transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
                                w-2.5 h-2.5 rounded-full bg-purple-300 shadow shadow-purple-500/40
                                opacity-0 group-hover/seek:opacity-100 scale-0 group-hover/seek:scale-100
                                transition-all duration-200" />
              </div>
            </div>
          </div>
          <div className="py-2 flex items-center">
            {/* Left — artwork + info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:w-1/3">
              <div className="w-10 h-10 rounded-md overflow-hidden bg-white/[0.06] flex-shrink-0">
                {artwork(nowPlaying) ? (
                  <img src={artwork(nowPlaying)} alt="" className="w-full h-full object-cover opacity-80" onError={handleImgError} />
                ) : (
                  <div className="w-full h-full bg-white/[0.04]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-purple-200 text-xs truncate">{nowPlaying.title}</p>
                <p className="text-white/70 text-[10px] truncate">{nowPlaying.user?.name}</p>
              </div>
            </div>

            {/* Center — transport controls */}
            <div className="flex items-center justify-center gap-3 sm:w-1/3">
              <button
                onClick={handlePrev}
                className="text-white/40 hover:text-white/80 transition-colors p-2.5 sm:p-1"
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleNext}
                className="text-white/40 hover:text-white/80 transition-colors p-2.5 sm:p-1"
                aria-label="Next"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,5 15,12 5,19" />
                  <rect x="19" y="5" width="2" height="14" />
                </svg>
              </button>
            </div>

            {/* Right — time, volume, like, repost, menu */}
            <div className="flex items-center justify-end gap-1 sm:w-1/3">
              <div className="hidden sm:flex items-center gap-1.5 mr-2 text-[10px] font-mono text-white/50">
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
              <div className="relative flex-shrink-0 hidden sm:block">
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
                    onClick={() => { addToPlaylist(nowPlaying); setShowNpMenu(false) }}
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
          </div>
          </div>
        </div>
      )}

      {/* Create playlist modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div className="bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/60
                          w-[340px] max-w-[90vw] p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-white/90 text-xs tracking-[0.2em] uppercase">New Playlist</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/40 hover:text-white/70 transition-colors p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Artwork upload */}
            <div className="flex items-start gap-4">
              <button
                onClick={() => artworkInputRef.current?.click()}
                className="w-24 h-24 flex-shrink-0 rounded-xl border border-dashed border-white/15 hover:border-purple-500/40
                           bg-white/[0.04] hover:bg-white/[0.06] transition-all duration-300 overflow-hidden
                           flex items-center justify-center group"
              >
                {createArtwork ? (
                  <img src={createArtwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-white/30 group-hover:text-white/50 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-[9px] tracking-wider uppercase">artwork</span>
                  </div>
                )}
              </button>
              <input
                ref={artworkInputRef}
                type="file"
                accept="image/*"
                onChange={handleArtworkSelect}
                className="hidden"
              />

              <div className="flex-1 space-y-2.5 min-w-0">
                {/* Title */}
                <input
                  type="text"
                  placeholder="Playlist name..."
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                             placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300"
                />
                {/* Description */}
                <textarea
                  placeholder="Description (optional)"
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                             placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300
                             resize-none"
                />
              </div>
            </div>

            {/* Private/Public toggle */}
            <button
              onClick={() => setCreateIsPrivate((v) => !v)}
              className="flex items-center gap-2.5 w-full group"
            >
              <div className={`w-8 h-[18px] rounded-full relative transition-colors duration-300
                ${createIsPrivate ? 'bg-purple-500/30' : 'bg-white/10'}`}>
                <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-300 shadow-sm
                  ${createIsPrivate ? 'left-[15px] bg-purple-400' : 'left-[2px] bg-white/50'}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     className={`transition-colors duration-300 ${createIsPrivate ? 'text-purple-300' : 'text-white/40'}`}>
                  {createIsPrivate ? (
                    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
                  ) : (
                    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>
                  )}
                </svg>
                <span className={`text-[11px] tracking-wider ${createIsPrivate ? 'text-purple-200' : 'text-white/50'}`}>
                  {createIsPrivate ? 'Private' : 'Public'}
                </span>
              </div>
            </button>

            {/* Info text */}
            <p className="text-white/40 text-[10px]">
              Create a draft playlist, then add tracks and save to Audius.
            </p>

            {/* Create draft button */}
            <button
              onClick={handleStartDraft}
              disabled={!playlistName.trim()}
              className="w-full py-2.5 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[11px]
                         tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30
                         disabled:cursor-not-allowed uppercase"
            >
              create playlist
            </button>
          </div>
        </div>
      )}

      {/* Edit playlist modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false) }}
        >
          <div className="bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/60
                          w-[340px] max-w-[90vw] p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-white/90 text-xs tracking-[0.2em] uppercase">Edit Playlist</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/40 hover:text-white/70 transition-colors p-0.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Artwork upload */}
            <div className="flex items-start gap-4">
              <button
                onClick={() => editArtworkInputRef.current?.click()}
                className="w-24 h-24 flex-shrink-0 rounded-xl border border-dashed border-white/15 hover:border-purple-500/40
                           bg-white/[0.04] hover:bg-white/[0.06] transition-all duration-300 overflow-hidden
                           flex items-center justify-center group"
              >
                {editArtwork || activePlaylist?.artwork ? (
                  <img src={editArtwork || activePlaylist?.artwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-white/30 group-hover:text-white/50 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-[9px] tracking-wider uppercase">artwork</span>
                  </div>
                )}
              </button>
              <input
                ref={editArtworkInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditArtworkSelect}
                className="hidden"
              />

              <div className="flex-1 space-y-2.5 min-w-0">
                <input
                  type="text"
                  placeholder="Playlist name..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                             placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white
                             placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300
                             resize-none"
                />
              </div>
            </div>

            {/* Private/Public toggle */}
            <button
              onClick={() => setEditIsPrivate((v) => !v)}
              className="flex items-center gap-2.5 w-full group"
            >
              <div className={`w-8 h-[18px] rounded-full relative transition-colors duration-300
                ${editIsPrivate ? 'bg-purple-500/30' : 'bg-white/10'}`}>
                <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-300 shadow-sm
                  ${editIsPrivate ? 'left-[15px] bg-purple-400' : 'left-[2px] bg-white/50'}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     className={`transition-colors duration-300 ${editIsPrivate ? 'text-purple-300' : 'text-white/40'}`}>
                  {editIsPrivate ? (
                    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
                  ) : (
                    <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>
                  )}
                </svg>
                <span className={`text-[11px] tracking-wider ${editIsPrivate ? 'text-purple-200' : 'text-white/50'}`}>
                  {editIsPrivate ? 'Private' : 'Public'}
                </span>
              </div>
            </button>

            {/* Save button */}
            <button
              onClick={handleSaveEdit}
              disabled={editSaving || !editName.trim()}
              className="w-full py-2.5 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[11px]
                         tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30
                         disabled:cursor-not-allowed uppercase"
            >
              {editSaving ? 'saving...' : 'save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
