import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  searchDJTracks, getStreamUrl, formatDuration, getImageFallback, fetchRandomMix,
  DJ_GENRES, DJ_KEYS, DJ_MOODS,
  getDraftPlaylist, saveDraftPlaylist, fetchUserPlaylists, fetchPlaylistTracks,
  getBlockedArtists, blockArtist, resolveTrackUrl,
} from '../utils/audius'

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
  const [maxDuration, setMaxDuration] = useState('')
  const [releasedWithin, setReleasedWithin] = useState('')

  // Results — rawResults from API, filtered live by BPM/key/mood/genre
  const [rawResults, setRawResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // Now playing — initialize from handoff if a track was playing on main
  const [nowPlaying, setNowPlaying] = useState(() => handoffTrackRef?.current?.currentTrack || null)
  const [isPlaying, setIsPlaying] = useState(() => handoffTrackRef?.current?.isPlaying || false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Refs to avoid stale closures in audio event handlers
  const nowPlayingRef = useRef(null)
  const resultsRef = useRef([])
  const repeatRef = useRef('off')

  // Repeat mode: 'off' | 'all' | 'one'
  const [repeatMode, setRepeatMode] = useState('off')

  // Track menu
  const [menuTrackId, setMenuTrackId] = useState(null)
  const menuRef = useRef(null)

  // Blocked artist filter counter (bust memo on block)
  const [blockVersion, setBlockVersion] = useState(0)
  const [toast, setToast] = useState(null)

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

  // Fetch user's Audius playlists when logged in and panel opens
  useEffect(() => {
    if (!user || !showPlaylist) return
    setLoadingPlaylists(true)
    fetchUserPlaylists(user.userId)
      .then((pl) => setUserPlaylists(pl))
      .finally(() => setLoadingPlaylists(false))
  }, [user, showPlaylist])

  // Sync draft playlist changes back to localStorage
  useEffect(() => { saveDraftPlaylist(playlist) }, [playlist])

  // Open an existing playlist — fetch its tracks and show detail view
  const openPlaylist = useCallback(async (pl) => {
    setActivePlaylist({ id: pl.id, name: pl.playlistName || pl.playlist_name || 'Untitled', artwork: pl.artwork?.['150x150'] || null, tracks: [], isNew: false, description: pl.description || '', isPrivate: pl.is_private ?? pl.isPrivate ?? false })
    setLoadingPlaylistTracks(true)
    try {
      const tracks = await fetchPlaylistTracks(pl.id)
      setActivePlaylist((prev) => prev ? { ...prev, tracks } : null)
    } finally {
      setLoadingPlaylistTracks(false)
    }
  }, [])

  // Open the draft (new) playlist detail view
  const openDraftPlaylist = useCallback(() => {
    setActivePlaylist({ id: null, name: draftMeta?.name || playlistName || 'New Playlist', artwork: draftMeta?.artwork || null, tracks: playlist, isNew: true })
  }, [playlist, playlistName, draftMeta])

  // Go back to the library list
  const backToLibrary = useCallback(() => {
    setActivePlaylist(null)
    setSaveResult(null)
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
      })
      setRawResults(tracks)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, selectedGenres, selectedMood, bpmMin, bpmMax, selectedKey])

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
    const maxDur = maxDuration ? Number(maxDuration) * 60 : null
    const blockedArtists = getBlockedArtists()
    // Date cutoff for release date filter
    let dateCutoff = null
    if (releasedWithin) {
      const now = new Date()
      const cutoffs = {
        '1d': new Date(now - 24 * 60 * 60 * 1000),
        '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
        '6m': new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()),
        '1y': new Date(now.getFullYear(), 0, 1),
      }
      dateCutoff = cutoffs[releasedWithin] || null
    }
    return rawResults.filter((t) => {
      if (blockedArtists.has(t.user?.handle)) return false
      if (minBpm && t.bpm && t.bpm < minBpm) return false
      if (maxBpm && t.bpm && t.bpm > maxBpm) return false
      if (selectedKey && t.musical_key && t.musical_key !== selectedKey) return false
      if (selectedMood && t.mood && t.mood.toLowerCase() !== selectedMood.toLowerCase()) return false
      if (maxDur && t.duration > maxDur) return false
      if (dateCutoff) {
        const released = t.release_date ? new Date(t.release_date) : t.created_at ? new Date(t.created_at) : null
        if (!released || released < dateCutoff) return false
      }
      return true
    })
  }, [rawResults, bpmMin, bpmMax, selectedKey, selectedMood, maxDuration, releasedWithin, blockVersion])

  // Keep refs in sync for audio event handlers
  useEffect(() => { nowPlayingRef.current = nowPlaying }, [nowPlaying])
  useEffect(() => { resultsRef.current = activePlaylist ? activePlaylist.tracks : results }, [results, activePlaylist])
  useEffect(() => { repeatRef.current = repeatMode }, [repeatMode])

  const handlePreview = useCallback((track) => {
    const audio = djAudioRef.current
    if (!audio) return

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
  }, [nowPlaying, isPlaying])

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
      // Adding to a specific existing Audius playlist
      if (activePlaylist?.id === targetPlaylistId) {
        setActivePlaylist((prev) => {
          if (!prev) return prev
          if (prev.tracks.some((t) => t.id === track.id)) return prev
          return { ...prev, tracks: [...prev.tracks, track] }
        })
      }
      if (user) {
        fetch('/api/playlist-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'addTrack', userId: user.userId, playlistId: targetPlaylistId, trackId: track.id }),
        }).catch(() => {
          if (activePlaylist?.id === targetPlaylistId) {
            setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== track.id) } : prev)
          }
        })
      }
      setToast(`Added to playlist`)
      setTimeout(() => setToast(null), 1500)
    } else if (activePlaylist && !activePlaylist.isNew) {
      // Adding to current active existing playlist
      setActivePlaylist((prev) => {
        if (!prev) return prev
        if (prev.tracks.some((t) => t.id === track.id)) return prev
        return { ...prev, tracks: [...prev.tracks, track] }
      })
      if (user) {
        fetch('/api/playlist-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'addTrack', userId: user.userId, playlistId: activePlaylist.id, trackId: track.id }),
        }).catch(() => {
          setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== track.id) } : prev)
        })
      }
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
      // Remove from existing Audius playlist — optimistic + API
      const removed = activePlaylist.tracks.find((t) => t.id === trackId)
      setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev)
      if (user) {
        fetch('/api/playlist-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'removeTrack', userId: user.userId, playlistId: activePlaylist.id, trackId }),
        }).catch(() => {
          // Revert on failure
          if (removed) {
            setActivePlaylist((prev) => prev ? { ...prev, tracks: [...prev.tracks, removed] } : prev)
          }
        })
      }
    } else {
      setPlaylist((prev) => prev.filter((t) => t.id !== trackId))
    }
  }, [activePlaylist, user])

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

  // Paste URLs to add tracks — accepts newline/comma separated Audius URLs
  const [pasteLoading, setPasteLoading] = useState(false)
  const handlePasteUrls = useCallback(async () => {
    let text
    try {
      text = await navigator.clipboard.readText()
    } catch {
      setToast('Could not read clipboard')
      setTimeout(() => setToast(null), 2000)
      return
    }
    // Extract URLs (audius.co links)
    const urls = text.split(/[\n,\s]+/).filter((s) => s.includes('audius.co')).map((s) => s.trim()).filter(Boolean)
    if (urls.length === 0) {
      setToast('No Audius URLs found in clipboard')
      setTimeout(() => setToast(null), 2000)
      return
    }
    setPasteLoading(true)
    let added = 0
    for (const url of urls) {
      const track = await resolveTrackUrl(url)
      if (track) {
        addToPlaylist(track)
        added++
      }
    }
    setPasteLoading(false)
    setToast(added > 0 ? `Added ${added} track${added !== 1 ? 's' : ''}` : 'No tracks found')
    setTimeout(() => setToast(null), 2000)
  }, [addToPlaylist])

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
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 sm:px-8 pt-5 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-white text-xs tracking-[0.3em] uppercase font-light">
            deep dive
          </h2>
          <p className="text-white/60 text-[10px] mt-1 font-light">
            Search artists or tracks, filter by BPM, mood, genre, and build a playlist
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!user) { login(); return }
              setShowPlaylist((v) => !v)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-wider uppercase
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
            {!user ? 'log in for playlists' : 'playlists'}
          </button>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors duration-300 p-1"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
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
                onClick={handleSearch}
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

        {/* Genre pills — centered */}
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap justify-center gap-1.5">
            {DJ_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`text-[10px] tracking-wider px-3 py-1 rounded-full transition-all duration-300 border
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

        {/* BPM + Key + Mood + Duration — centered */}
        <div className="flex flex-wrap items-end justify-center gap-4">
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
            <label className="text-white/80 text-[10px] tracking-wider uppercase block mb-1">Max Duration</label>
            <input
              type="number"
              placeholder="any"
              value={maxDuration}
              onChange={(e) => setMaxDuration(e.target.value)}
              className="w-16 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 font-mono
                         transition-colors duration-300"
            />
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
              <option value="30d">This month</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">This year</option>
            </select>
          </div>
        </div>

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
          <div className="absolute left-0 top-0 bottom-0 w-64 sm:w-72 z-20 border-r border-white/[0.06] bg-black/60 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl shadow-black/30">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-white/90 text-[11px] tracking-wider uppercase">Playlists</h3>
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
                          <p className="text-white/40 text-[9px]">{pl.trackCount ?? pl.track_count ?? pl.playlist_contents?.length ?? 0} tracks</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results / Playlist tracks */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activePlaylist ? (
            <div className="max-w-4xl mx-auto px-6 sm:px-8 pb-4">
              {/* Playlist header */}
              <div className="flex items-center gap-4 py-4">
                <button
                  onClick={backToLibrary}
                  className="text-white/50 hover:text-white/80 transition-colors p-1"
                  aria-label="Back to search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.06] flex-shrink-0">
                  {activePlaylist.artwork ? (
                    <img src={activePlaylist.artwork} alt="" className="w-full h-full object-cover opacity-80" onError={handleImgError} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white/90 text-sm font-medium truncate">{activePlaylist.name}</h3>
                  <p className="text-white/40 text-[10px]">
                    {activePlaylist.tracks.length} track{activePlaylist.tracks.length !== 1 ? 's' : ''}
                    {activePlaylist.isNew && ' · draft'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {activePlaylist.tracks.length > 0 && (
                    <button
                      onClick={handlePlaylistRadio}
                      className="p-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80
                                 rounded-lg transition-all duration-300"
                      title="Start radio from playlist"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {activePlaylist.tracks.length > 0 && (
                    <button
                      onClick={handleCopyAllUrls}
                      className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-[10px]
                                 tracking-wider rounded-lg transition-all duration-300 uppercase"
                      title="Copy all track URLs"
                    >
                      copy urls
                    </button>
                  )}
                  <button
                    onClick={handlePasteUrls}
                    disabled={pasteLoading}
                    className="px-2.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-[10px]
                               tracking-wider rounded-lg transition-all duration-300 disabled:opacity-40 uppercase"
                    title="Paste Audius URLs from clipboard"
                  >
                    {pasteLoading ? '...' : 'paste urls'}
                  </button>
                  {activePlaylist.isNew && (
                    <button
                      onClick={handlePublishPlaylist}
                      disabled={saving || !draftMeta?.name}
                      className="px-3 py-1.5 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[10px]
                                 tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30
                                 disabled:cursor-not-allowed uppercase"
                    >
                      {saving ? 'saving...' : 'save to audius'}
                    </button>
                  )}
                </div>
              </div>
              {saveResult && (
                <p className={`text-[10px] px-4 pb-2 ${saveResult.startsWith('Error') ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                  {saveResult}
                </p>
              )}

              {loadingPlaylistTracks ? (
                <div className="flex justify-center py-16">
                  <div className="w-5 h-5 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
                </div>
              ) : activePlaylist.tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <svg className="text-white/20" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  <p className="text-white/40 text-xs">
                    {activePlaylist.isNew ? 'Search for tracks and tap + to add them' : 'No tracks in this playlist'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {activePlaylist.tracks.map((track) => {
                    const isActive = nowPlaying?.id === track.id
                    const art = artwork(track)
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg transition-all duration-200
                          ${isActive ? 'bg-purple-500/10' : 'hover:bg-white/[0.04]'}`}
                      >
                        <button
                          onClick={() => handlePreview(track)}
                          className="relative flex-shrink-0 w-9 h-9 rounded-md overflow-hidden bg-white/[0.06] group"
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
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs truncate transition-colors duration-200 ${isActive ? 'text-purple-200' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-white/70 text-[10px] truncate">{track.user?.name}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-[10px] font-mono text-white/70">
                          {track.bpm ? <span className="w-14 text-right">{Math.round(track.bpm)} bpm</span> : <span className="w-14" />}
                          <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                        </div>
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
                                onClick={() => removeFromPlaylist(track.id)}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400/80 hover:bg-white/[0.06] hover:text-red-300 transition-colors flex items-center gap-2"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Remove from playlist
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
          ) : (
            <>
              {searching && (
                <div className="flex justify-center py-16">
                  <div className="w-5 h-5 border border-purple-400/30 border-t-purple-400/80 rounded-full animate-spin" />
                </div>
              )}

              <div className={`max-w-4xl mx-auto px-6 sm:px-8 pb-4 ${!searching && results.length === 0 ? 'hidden' : ''}`}>
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
                        className={`flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg transition-all duration-200
                          ${isActive
                            ? 'bg-purple-500/10'
                            : 'hover:bg-white/[0.04]'
                          }`}
                      >
                        {/* Artwork + play overlay */}
                        <button
                          onClick={() => handlePreview(track)}
                          className="relative flex-shrink-0 w-9 h-9 rounded-md overflow-hidden bg-white/[0.06] group"
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
                          <p className={`text-xs truncate transition-colors duration-200 ${isActive ? 'text-purple-200' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-white/70 text-[10px] truncate">{track.user?.name}</p>
                        </div>

                        {/* Metadata */}
                        <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-[10px] font-mono text-white/70">
                          {track.bpm ? <span className="w-14 text-right">{Math.round(track.bpm)} bpm</span> : <span className="w-14" />}
                          {track.musical_key ? <span className="w-20 text-right">{track.musical_key}</span> : <span className="w-20" />}
                          <span className="w-10 text-right">{formatDuration(track.duration)}</span>
                        </div>

                        {/* Start radio from track */}
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

                        {/* Add to playlist button (visible when panel is open) */}
                        {showPlaylist && (
                          <button
                            onClick={(e) => showPlaylistPicker(track, e)}
                            disabled={inActive}
                            className={`flex-shrink-0 p-1 transition-colors duration-200
                              ${inActive ? 'text-purple-400/50' : 'text-white/30 hover:text-purple-300'}`}
                            aria-label="Add to playlist"
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
            </>
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
            className="relative h-3 group/seek cursor-pointer flex items-center"
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
            <div className="flex items-center gap-2.5 min-w-0 w-1/3">
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
            <div className="flex items-center justify-center gap-3 w-1/3">
              <button
                onClick={handlePrev}
                className="text-white/40 hover:text-white/80 transition-colors p-1"
                aria-label="Previous"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="5" width="2" height="14" />
                  <polygon points="19,5 9,12 19,19" />
                </svg>
              </button>
              <button
                onClick={() => handlePreview(nowPlaying)}
                className="text-white/80 hover:text-white transition-colors p-1.5 bg-white/[0.06] rounded-full hover:bg-white/[0.1]"
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
                className="text-white/40 hover:text-white/80 transition-colors p-1"
                aria-label="Next"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5,5 15,12 5,19" />
                  <rect x="19" y="5" width="2" height="14" />
                </svg>
              </button>
            </div>

            {/* Right — time, like, repost, menu */}
            <div className="flex items-center justify-end gap-1 w-1/3">
              <div className="hidden sm:flex items-center gap-1.5 mr-2 text-[10px] font-mono text-white/50">
                <span>{formatDuration(currentTime)}</span>
                <span>/</span>
                <span>{formatDuration(duration || nowPlaying.duration)}</span>
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
