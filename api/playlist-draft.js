import { Redis } from '@upstash/redis'

let redis = null

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

function draftKey(userId, playlistId) {
  return `draft:${userId}:${playlistId}`
}

function userDraftsKey(userId) {
  return `drafts:${userId}`
}

export default async function handler(req, res) {
  const { method } = req

  // GET /api/playlist-draft?userId=X&playlistId=Y  — get one draft
  // GET /api/playlist-draft?userId=X               — list all drafts for user
  if (method === 'GET') {
    const { userId, playlistId } = req.query
    if (!userId) return res.status(400).json({ error: 'Missing userId' })

    const r = getRedis()

    if (playlistId) {
      const data = await r.get(draftKey(userId, playlistId))
      return res.status(200).json({ draft: data || null })
    }

    // List all draft playlist IDs for this user
    const ids = await r.smembers(userDraftsKey(userId))
    return res.status(200).json({ playlistIds: ids || [] })
  }

  // POST — save or delete a draft
  if (method === 'POST') {
    const { userId, playlistId, tracks, action } = req.body
    if (!userId || !playlistId) return res.status(400).json({ error: 'Missing userId or playlistId' })

    const r = getRedis()

    if (action === 'delete') {
      await r.del(draftKey(userId, playlistId))
      await r.srem(userDraftsKey(userId), playlistId)
      return res.status(200).json({ ok: true })
    }

    if (!tracks) return res.status(400).json({ error: 'Missing tracks' })

    // Save draft (expire after 90 days)
    await r.set(draftKey(userId, playlistId), JSON.stringify(tracks), { ex: 90 * 24 * 60 * 60 })
    await r.sadd(userDraftsKey(userId), playlistId)
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
