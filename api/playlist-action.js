import { sdk } from '@audius/sdk'

let audiusSdk = null

function getSdk() {
  if (!audiusSdk) {
    audiusSdk = sdk({
      apiKey: process.env.AUDIUS_API_KEY,
      apiSecret: process.env.AUDIUS_API_SECRET,
      appName: 'drift',
    })
  }
  return audiusSdk
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, userId, playlistId, trackId, trackIds } = req.body

  if (!action || !userId || !playlistId) {
    return res.status(400).json({ error: 'Missing action, userId, or playlistId' })
  }

  const s = getSdk()

  try {
    switch (action) {
      case 'addTrack': {
        if (!trackId) return res.status(400).json({ error: 'Missing trackId' })
        await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId })
        return res.status(200).json({ ok: true })
      }
      case 'addTracks': {
        if (!trackIds?.length) return res.status(400).json({ error: 'Missing trackIds' })
        // Add tracks sequentially to preserve order
        for (const id of trackIds) {
          await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId: id })
        }
        return res.status(200).json({ ok: true })
      }
      case 'removeTrack': {
        if (!trackId) return res.status(400).json({ error: 'Missing trackId' })
        await s.playlists.removeTrackFromPlaylist({ userId, playlistId, trackId })
        return res.status(200).json({ ok: true })
      }
      case 'syncPlaylist': {
        // Sync playlist to match desired track list
        // mode: 'replace' (remove old + add new) or 'append' (only add new)
        if (!trackIds) return res.status(400).json({ error: 'Missing trackIds' })
        const { originalTrackIds, mode } = req.body
        if (!originalTrackIds) return res.status(400).json({ error: 'Missing originalTrackIds' })

        if (mode === 'append') {
          // Only add tracks that are new
          const toAdd = trackIds.filter((id) => !originalTrackIds.includes(id))
          for (const id of toAdd) {
            await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId: id })
          }
          return res.status(200).json({ ok: true, added: toAdd.length, removed: 0 })
        }

        // Default: replace mode — remove tracks not in new list, add new ones
        const toRemove = originalTrackIds.filter((id) => !trackIds.includes(id))
        const toAdd = trackIds.filter((id) => !originalTrackIds.includes(id))
        for (const id of toRemove) {
          await s.playlists.removeTrackFromPlaylist({ userId, playlistId, trackId: id })
        }
        for (const id of toAdd) {
          await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId: id })
        }
        return res.status(200).json({ ok: true, added: toAdd.length, removed: toRemove.length })
      }
      case 'updatePlaylist': {
        const { metadata } = req.body
        if (!metadata) return res.status(400).json({ error: 'Missing metadata' })
        await s.playlists.updatePlaylist({ userId, playlistId, metadata })
        return res.status(200).json({ ok: true })
      }
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Action failed' })
  }
}
