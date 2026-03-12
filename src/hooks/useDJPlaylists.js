import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  getDraftPlaylist, saveDraftPlaylist, fetchUserPlaylists, fetchPlaylistTracks,
  resolveTrackUrl, fetchPlaylistDraft, savePlaylistDraft, clearPlaylistDraft, fetchAllPlaylistDraftIds,
} from '../utils/audius'

export function useDJPlaylists(user, setToast) {
  // Draft playlist (local)
  const [playlist, setPlaylist] = useState(() => getDraftPlaylist())
  const [playlistName, setPlaylistName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  // User's Audius playlists
  const [userPlaylists, setUserPlaylists] = useState([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)

  // Active playlist detail view
  const [activePlaylist, setActivePlaylist] = useState(null)
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false)
  const restoredPlaylistRef = useRef(false)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDescription, setCreateDescription] = useState('')
  const [createIsPrivate, setCreateIsPrivate] = useState(true)
  const [createArtwork, setCreateArtwork] = useState(null)
  const artworkInputRef = useRef(null)

  // Draft metadata
  const [draftMeta, setDraftMeta] = useState(null)

  // Server-side draft IDs
  const [draftPlaylistIds, setDraftPlaylistIds] = useState(new Set())

  // Recently-published — prevent refetch overwrite
  const recentlyPublishedRef = useRef(new Set())

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editIsPrivate, setEditIsPrivate] = useState(true)
  const [editArtwork, setEditArtwork] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const editArtworkInputRef = useRef(null)

  // Publishing edits
  const [publishingEdits, setPublishingEdits] = useState(false)

  // Paste URLs
  const [pasteLoading, setPasteLoading] = useState(false)
  const [showPastePanel, setShowPastePanel] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // Drag-and-drop
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const dragOverIdxRef = useRef(null)

  // --- Effects ---

  // Fetch user's playlists + draft IDs
  useEffect(() => {
    if (!user) return
    setLoadingPlaylists(true)
    Promise.all([
      fetchUserPlaylists(user.userId),
      fetchAllPlaylistDraftIds(user.userId),
    ]).then(([pl, draftIds]) => {
      setUserPlaylists((prev) => {
        const fetchedIds = new Set(pl.map((p) => p.id))
        const optimistic = prev.filter((p) => recentlyPublishedRef.current.has(p.id) && !fetchedIds.has(p.id))
        return [...optimistic, ...pl]
      })
      setDraftPlaylistIds(new Set(draftIds))
    }).finally(() => setLoadingPlaylists(false))
  }, [user])

  // Persist active playlist ID to sessionStorage
  useEffect(() => {
    try {
      if (activePlaylist?.id) sessionStorage.setItem('drift:dj:activePlaylistId', activePlaylist.id)
      else if (activePlaylist?.isNew) sessionStorage.setItem('drift:dj:activePlaylistId', 'draft')
      else sessionStorage.removeItem('drift:dj:activePlaylistId')
    } catch { /* ignore */ }
  }, [activePlaylist?.id, activePlaylist?.isNew])

  // Restore active playlist from sessionStorage
  useEffect(() => {
    if (restoredPlaylistRef.current || !user || loadingPlaylists) return
    const stored = sessionStorage.getItem('drift:dj:activePlaylistId')
    if (!stored) return
    restoredPlaylistRef.current = true
    if (stored === 'draft' && draftMeta) {
      setActivePlaylist({ id: null, name: draftMeta.name, artwork: draftMeta.artwork, tracks: playlist, isNew: true })
    } else if (stored !== 'draft' && userPlaylists.length > 0) {
      const match = userPlaylists.find((pl) => pl.id === stored)
      if (match) openPlaylist(match)
    }
  }, [user, userPlaylists, loadingPlaylists, draftMeta])

  // Sync draft playlist to localStorage
  useEffect(() => { saveDraftPlaylist(playlist) }, [playlist])

  // Persist draft edits for existing playlists (debounced)
  const saveDraftTimer = useRef(null)
  useEffect(() => {
    if (!user || !activePlaylist || activePlaylist.isNew || !activePlaylist.id || !activePlaylist.originalTracks) return
    const currentIds = activePlaylist.tracks.map((t) => t.id).join(',')
    const originalIds = activePlaylist.originalTracks.map((t) => t.id).join(',')
    const hasChanges = currentIds !== originalIds
    const plId = activePlaylist.id
    setDraftPlaylistIds((prev) => {
      const next = new Set(prev)
      if (hasChanges) next.add(plId); else next.delete(plId)
      return next
    })
    clearTimeout(saveDraftTimer.current)
    saveDraftTimer.current = setTimeout(() => {
      if (hasChanges) savePlaylistDraft(user.userId, plId, activePlaylist.tracks)
      else clearPlaylistDraft(user.userId, plId)
    }, 1000)
    return () => clearTimeout(saveDraftTimer.current)
  }, [activePlaylist, user])

  // --- Callbacks ---

  const openPlaylist = useCallback(async (pl) => {
    setActivePlaylist({
      id: pl.id,
      name: pl.playlistName || pl.playlist_name || 'Untitled',
      artwork: pl.artwork?.['150x150'] || null,
      tracks: [], originalTracks: [], isNew: false,
      description: pl.description || '',
      isPrivate: pl.is_private ?? pl.isPrivate ?? false,
    })
    setLoadingPlaylistTracks(true)
    try {
      const [tracks, savedDraft] = await Promise.all([
        fetchPlaylistTracks(pl.id),
        user ? fetchPlaylistDraft(user.userId, pl.id) : null,
      ])
      setActivePlaylist((prev) => prev ? { ...prev, tracks: savedDraft || tracks, originalTracks: tracks } : null)
      if (savedDraft) {
        setToast('Restored unsaved draft')
        setTimeout(() => setToast(null), 2000)
      }
    } finally {
      setLoadingPlaylistTracks(false)
    }
  }, [user, setToast])

  const openDraftPlaylist = useCallback(() => {
    setActivePlaylist({ id: null, name: draftMeta?.name || playlistName || 'New Playlist', artwork: draftMeta?.artwork || null, tracks: playlist, isNew: true })
  }, [playlist, playlistName, draftMeta])

  const backToLibrary = useCallback(() => {
    setActivePlaylist(null)
    setSaveResult(null)
  }, [])

  const addToPlaylistDirect = useCallback((track, targetPlaylistId) => {
    if (targetPlaylistId === 'draft' || (!targetPlaylistId && activePlaylist?.isNew)) {
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
      if (activePlaylist?.id === targetPlaylistId) {
        setActivePlaylist((prev) => {
          if (!prev) return prev
          if (prev.tracks.some((t) => t.id === track.id)) return prev
          return { ...prev, tracks: [...prev.tracks, track] }
        })
      }
      setToast('Added to playlist (draft)')
      setTimeout(() => setToast(null), 1500)
    } else if (activePlaylist && !activePlaylist.isNew) {
      setActivePlaylist((prev) => {
        if (!prev) return prev
        if (prev.tracks.some((t) => t.id === track.id)) return prev
        return { ...prev, tracks: [...prev.tracks, track] }
      })
      setToast(`Added to ${activePlaylist.name}`)
      setTimeout(() => setToast(null), 1500)
    } else {
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
  }, [activePlaylist, draftMeta, playlistName, setToast])

  const addToPlaylist = useCallback((track) => {
    addToPlaylistDirect(track)
  }, [addToPlaylistDirect])

  const removeFromPlaylist = useCallback((trackId) => {
    if (activePlaylist?.isNew) {
      setPlaylist((prev) => prev.filter((t) => t.id !== trackId))
      setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev)
    } else if (activePlaylist && !activePlaylist.isNew) {
      setActivePlaylist((prev) => prev ? { ...prev, tracks: prev.tracks.filter((t) => t.id !== trackId) } : prev)
    } else {
      setPlaylist((prev) => prev.filter((t) => t.id !== trackId))
    }
  }, [activePlaylist])

  const handleDragDrop = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const reorder = (tracks) => {
      const arr = [...tracks]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return arr
    }
    setActivePlaylist((prev) => prev ? { ...prev, tracks: reorder(prev.tracks) } : prev)
    if (activePlaylist?.isNew) setPlaylist((prev) => reorder(prev))
  }, [activePlaylist])

  const hasDraftChanges = useMemo(() => {
    if (!activePlaylist || activePlaylist.isNew || !activePlaylist.originalTracks) return false
    const currentIds = activePlaylist.tracks.map((t) => t.id).join(',')
    const originalIds = activePlaylist.originalTracks.map((t) => t.id).join(',')
    return currentIds !== originalIds
  }, [activePlaylist])

  const handleRevertEdits = useCallback(() => {
    if (!activePlaylist || activePlaylist.isNew || !activePlaylist.originalTracks) return
    setActivePlaylist((prev) => prev ? { ...prev, tracks: [...prev.originalTracks] } : prev)
    if (user && activePlaylist.id) {
      clearPlaylistDraft(user.userId, activePlaylist.id)
      setDraftPlaylistIds((prev) => { const next = new Set(prev); next.delete(activePlaylist.id); return next })
    }
    setToast('Changes reverted')
    setTimeout(() => setToast(null), 1500)
  }, [activePlaylist, user, setToast])

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
          action: 'syncPlaylist', userId: user.userId, playlistId: activePlaylist.id,
          trackIds: currentIds, originalTrackIds: originalIds, mode,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to publish')
      }
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
  }, [user, activePlaylist, setToast])

  // Create modal handlers
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
    setActivePlaylist({ id: null, name: meta.name, artwork: meta.artwork, tracks: playlist, isNew: true })
  }, [playlistName, createDescription, createIsPrivate, createArtwork, playlist])

  const handlePublishPlaylist = useCallback(async () => {
    if (!user || !draftMeta?.name) return
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch('/api/create-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId, playlistName: draftMeta.name,
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
      setActivePlaylist({ id: playlistId, name: draftMeta.name, artwork: draftMeta.artwork, tracks: [...playlist], isNew: false })
      setSaveResult('Playlist created on Audius!')
      recentlyPublishedRef.current.add(playlistId)
      setTimeout(() => recentlyPublishedRef.current.delete(playlistId), 60000)
      setUserPlaylists((prev) => [{
        id: playlistId, playlist_name: draftMeta.name, playlistName: draftMeta.name,
        is_private: draftMeta.isPrivate, artwork: draftMeta.artwork ? { '150x150': draftMeta.artwork } : null,
        track_count: playlist.length, description: draftMeta.description || '',
      }, ...prev])
      setPlaylist([])
      setPlaylistName('')
      setDraftMeta(null)
      setTimeout(async () => {
        try {
          const playlists = await fetchUserPlaylists(user.userId)
          if (playlists.length > 0) setUserPlaylists(playlists)
        } catch { /* ignore */ }
      }, 5000)
    } catch (err) {
      setSaveResult(`Error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [user, playlist, draftMeta])

  // Edit modal
  const openEditModal = useCallback(() => {
    if (!activePlaylist || activePlaylist.isNew) return
    setEditName(activePlaylist.name || '')
    setEditDescription(activePlaylist.description || '')
    setEditIsPrivate(activePlaylist.isPrivate ?? true)
    setEditArtwork(null)
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
      const body = { action: 'updatePlaylist', userId: user.userId, playlistId: activePlaylist.id, metadata }
      if (editArtwork) body.artworkUrl = editArtwork
      await fetch('/api/playlist-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setActivePlaylist((prev) => prev ? {
        ...prev, name: editName.trim() || prev.name,
        description: editDescription.trim(), isPrivate: editIsPrivate,
        artwork: editArtwork || prev.artwork,
      } : prev)
      setUserPlaylists((prev) => prev.map((p) =>
        p.id === activePlaylist.id ? {
          ...p, playlistName: editName.trim() || p.playlistName || p.playlist_name,
          playlist_name: editName.trim() || p.playlist_name || p.playlistName,
          description: editDescription.trim(), is_private: editIsPrivate,
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
  }, [user, activePlaylist, editName, editDescription, editIsPrivate, editArtwork, setToast])

  // Paste URLs
  const handleSubmitPasteUrls = useCallback(async (clearExisting) => {
    const urls = pasteText.split(/[\n,\s]+/).filter((s) => s.includes('audius.co')).map((s) => s.trim()).filter(Boolean)
    if (urls.length === 0) {
      setToast('No Audius URLs found')
      setTimeout(() => setToast(null), 2000)
      return
    }
    setPasteLoading(true)
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
    for (const track of resolved) addToPlaylist(track)
    setPasteLoading(false)
    setPasteText('')
    setShowPastePanel(false)
    setToast(resolved.length > 0 ? `Added ${resolved.length} track${resolved.length !== 1 ? 's' : ''}${clearExisting ? ' (replaced)' : ''}` : 'No tracks found')
    setTimeout(() => setToast(null), 2000)
  }, [pasteText, addToPlaylist, activePlaylist, setToast])

  // Copy all URLs
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
  }, [activePlaylist, playlist, setToast])

  return {
    // Draft
    playlist, setPlaylist, playlistName, setPlaylistName,
    saving, saveResult, setSaveResult,
    draftMeta, setDraftMeta,
    draftPlaylistIds,
    // User playlists
    userPlaylists, setUserPlaylists, loadingPlaylists,
    // Active playlist
    activePlaylist, setActivePlaylist,
    loadingPlaylistTracks,
    hasDraftChanges,
    // Actions
    openPlaylist, openDraftPlaylist, backToLibrary,
    addToPlaylistDirect, addToPlaylist, removeFromPlaylist,
    handleDragDrop, handleRevertEdits, handlePublishEdits, publishingEdits,
    handlePublishPlaylist, handleStartDraft,
    handleCopyAllUrls,
    // Create modal
    showCreateModal, setShowCreateModal, openCreateModal,
    createDescription, setCreateDescription,
    createIsPrivate, setCreateIsPrivate,
    createArtwork, setCreateArtwork,
    artworkInputRef, handleArtworkSelect,
    // Edit modal
    showEditModal, setShowEditModal, openEditModal,
    editName, setEditName, editDescription, setEditDescription,
    editIsPrivate, setEditIsPrivate, editArtwork, setEditArtwork,
    editSaving, editArtworkInputRef, handleEditArtworkSelect, handleSaveEdit,
    // Paste
    showPastePanel, setShowPastePanel, pasteText, setPasteText,
    pasteLoading, handleSubmitPasteUrls,
    // Drag
    dragIdx, setDragIdx, dragOverIdx, setDragOverIdx, dragOverIdxRef,
  }
}
