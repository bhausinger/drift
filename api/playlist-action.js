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
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Action failed' })
  }
}
