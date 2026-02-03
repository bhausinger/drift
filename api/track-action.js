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

  const { action, userId, trackId } = req.body

  if (!action || !userId || !trackId) {
    return res.status(400).json({ error: 'Missing action, userId, or trackId' })
  }

  const s = getSdk()

  try {
    switch (action) {
      case 'favorite':
        await s.tracks.favoriteTrack({ userId, trackId })
        break
      case 'unfavorite':
        await s.tracks.unfavoriteTrack({ userId, trackId })
        break
      case 'repost':
        await s.tracks.repostTrack({ userId, trackId })
        break
      case 'unrepost':
        await s.tracks.unrepostTrack({ userId, trackId })
        break
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Action failed' })
  }
}
