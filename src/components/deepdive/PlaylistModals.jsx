export function PasteUrlsModal({
  showPastePanel, setShowPastePanel,
  pasteText, setPasteText, pasteLoading, handleSubmitPasteUrls,
  activePlaylist,
}) {
  if (!showPastePanel) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) { setShowPastePanel(false); setPasteText('') } }}
    >
      <div className="w-full max-w-xl mx-4 bg-[#0a0a1a] border border-white/10 rounded-xl p-5 space-y-3 shadow-2xl">
        <h3 className="text-white/80 text-xs tracking-wider uppercase">Paste Audius URLs</h3>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste Audius URLs here, one per line..."
          rows={12}
          className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white
                     placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300
                     resize-none font-mono leading-relaxed"
          autoFocus
        />
        <div className="flex items-center justify-between">
          <p className="text-white/30 text-[10px]">
            {pasteText.split(/[\n,\s]+/).filter((s) => s.includes('audius.co')).length} URLs detected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowPastePanel(false); setPasteText('') }}
              className="px-3 py-1.5 text-[10px] text-white/50 hover:text-white/80 transition-colors"
            >
              cancel
            </button>
            {activePlaylist?.tracks.length > 0 && (
              <button
                onClick={() => handleSubmitPasteUrls(true)}
                disabled={pasteLoading || !pasteText.trim()}
                className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300/90 text-[10px]
                           tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30 uppercase"
              >
                {pasteLoading ? '...' : 'replace all'}
              </button>
            )}
            <button
              onClick={() => handleSubmitPasteUrls(false)}
              disabled={pasteLoading || !pasteText.trim()}
              className="px-3 py-1.5 bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 text-[10px]
                         tracking-wider rounded-lg transition-all duration-300 disabled:opacity-30 uppercase"
            >
              {pasteLoading ? 'adding...' : 'keep & add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreatePlaylistModal({
  showCreateModal, setShowCreateModal,
  playlistName, setPlaylistName,
  createDescription, setCreateDescription,
  createIsPrivate, setCreateIsPrivate,
  createArtwork, artworkInputRef, handleArtworkSelect,
  handleStartDraft,
}) {
  if (!showCreateModal) return null

  return (
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
            <input
              type="text"
              placeholder="Playlist name..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                         placeholder:text-white/40 focus:outline-none focus:border-purple-500/40 transition-colors duration-300"
            />
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

        <p className="text-white/40 text-[10px]">
          Create a draft playlist, then add tracks and save to Audius.
        </p>

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
  )
}

export function EditPlaylistModal({
  showEditModal, setShowEditModal,
  editName, setEditName, editDescription, setEditDescription,
  editIsPrivate, setEditIsPrivate,
  editArtwork, activePlaylist,
  editArtworkInputRef, handleEditArtworkSelect,
  editSaving, handleSaveEdit,
}) {
  if (!showEditModal) return null

  return (
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
  )
}

export function PlaylistPickerModal({
  playlistPicker, setPlaylistPicker, pickerRef,
  artwork, addToPlaylistDirect,
  draftMeta, userPlaylists,
}) {
  if (!playlistPicker) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setPlaylistPicker(null) }}
    >
      <div
        ref={pickerRef}
        className="w-full max-w-sm mx-4 bg-[#0a0a1a] border border-white/10
                   rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-white/80 text-xs tracking-wider uppercase">Add to playlist</h3>
          <button
            onClick={() => setPlaylistPicker(null)}
            className="text-white/40 hover:text-white/70 transition-colors p-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-2 pb-2 max-h-[60vh] overflow-y-auto">
          {/* Track being added */}
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg bg-white/[0.03]">
            <div className="w-8 h-8 rounded bg-white/[0.06] flex-shrink-0 overflow-hidden">
              {artwork(playlistPicker.track) && (
                <img src={artwork(playlistPicker.track)} alt="" className="w-full h-full object-cover opacity-80" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white/70 text-xs truncate">{playlistPicker.track.title}</p>
              <p className="text-white/40 text-[10px] truncate">{playlistPicker.track.user?.name}</p>
            </div>
          </div>
          {draftMeta && (
            <button
              onClick={() => addToPlaylistDirect(playlistPicker.track, 'draft')}
              className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white
                         transition-colors flex items-center gap-3 rounded-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-300/60 flex-shrink-0">
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
              className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white
                         transition-colors flex items-center gap-3 rounded-lg"
            >
              {pl.artwork?.['150x150'] ? (
                <img src={pl.artwork['150x150']} alt="" className="w-6 h-6 rounded flex-shrink-0 object-cover opacity-70" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-white/40">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              )}
              <span className="truncate">{pl.playlistName || pl.playlist_name || 'Untitled'}</span>
            </button>
          ))}
          {!draftMeta && userPlaylists.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-white/30">No playlists yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
