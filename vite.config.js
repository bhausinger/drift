import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      nodePolyfills({
        include: ['buffer', 'crypto', 'stream', 'util', 'process'],
        globals: { Buffer: true, global: true, process: true },
      }),
      // Dev-only: handle /api/track-action locally since Vercel serverless isn't available
      {
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use('/api/create-playlist', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) body += chunk
            const { userId, playlistName, trackIds, description, isPrivate, artworkUrl } = JSON.parse(body)

            if (!userId || !playlistName || !trackIds?.length) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing userId, playlistName, or trackIds' }))
              return
            }

            const apiKey = env.AUDIUS_API_KEY
            const apiSecret = env.AUDIUS_API_SECRET
            if (!apiKey || !apiSecret) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Missing AUDIUS_API_KEY or AUDIUS_API_SECRET in .env' }))
              return
            }

            try {
              const { sdk } = await import('@audius/sdk')
              const s = sdk({ apiKey, apiSecret, appName: 'drift' })
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
              for (const trackId of trackIds) {
                await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId })
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ playlistId }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message || 'Failed to create playlist' }))
            }
          })

          server.middlewares.use('/api/playlist-action', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) body += chunk
            const { action, userId, playlistId, trackId, trackIds } = JSON.parse(body)

            if (!action || !userId || !playlistId) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing action, userId, or playlistId' }))
              return
            }

            const apiKey = env.AUDIUS_API_KEY
            const apiSecret = env.AUDIUS_API_SECRET
            if (!apiKey || !apiSecret) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Missing AUDIUS_API_KEY or AUDIUS_API_SECRET in .env' }))
              return
            }

            try {
              const { sdk } = await import('@audius/sdk')
              const s = sdk({ apiKey, apiSecret, appName: 'drift' })
              switch (action) {
                case 'addTrack': {
                  if (!trackId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing trackId' })); return }
                  await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId })
                  break
                }
                case 'addTracks': {
                  if (!trackIds?.length) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing trackIds' })); return }
                  for (const id of trackIds) {
                    await s.playlists.addTrackToPlaylist({ userId, playlistId, trackId: id })
                  }
                  break
                }
                case 'removeTrack': {
                  if (!trackId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing trackId' })); return }
                  await s.playlists.removeTrackFromPlaylist({ userId, playlistId, trackId })
                  break
                }
                default:
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Invalid action' }))
                  return
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message || 'Action failed' }))
            }
          })

          server.middlewares.use('/api/track-action', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            for await (const chunk of req) body += chunk
            const { action, userId, trackId } = JSON.parse(body)

            if (!action || !userId || !trackId) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing params' }))
              return
            }

            const apiKey = env.AUDIUS_API_KEY
            const apiSecret = env.AUDIUS_API_SECRET
            if (!apiKey || !apiSecret) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Missing AUDIUS_API_KEY or AUDIUS_API_SECRET in .env' }))
              return
            }

            // Use the SDK dynamically in dev
            try {
              const { sdk } = await import('@audius/sdk')
              const s = sdk({ apiKey, apiSecret, appName: 'drift' })
              switch (action) {
                case 'favorite': await s.tracks.favoriteTrack({ userId, trackId }); break
                case 'unfavorite': await s.tracks.unfavoriteTrack({ userId, trackId }); break
                case 'repost': await s.tracks.repostTrack({ userId, trackId }); break
                case 'unrepost': await s.tracks.unrepostTrack({ userId, trackId }); break
                default:
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Invalid action' }))
                  return
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message || 'Action failed' }))
            }
          })
        },
      },
    ],
    server: { port: 3006 },
  }
})
