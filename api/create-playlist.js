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

  const { userId, playlistName, trackIds, description, isPrivate, artworkUrl } = req.body

  if (!userId || !playlistName) {
    return res.status(400).json({ error: 'Missing userId or playlistName' })
  }

  const s = getSdk()

  try {
    const metadata = {
      playlistName,
      description: description || '',
      isPrivate: isPrivate !== false,
    }
    const result = await s.playlists.createPlaylist({
      userId,
      metadata,
      coverArtFile: artworkUrl || undefined,
    })
    const playlistId = result.playlistId || result
    // Add tracks one by one after creation
    const ids = trackIds || []
    for (const trackId of ids) {
      await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId })
    }
    return res.status(200).json({ playlistId, trackIds: ids })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create playlist' })
  }
}
