# Drift

Minimal focus music player streaming from Audius.

## Stack
- React + Vite
- Tailwind CSS v4 (via @tailwindcss/vite plugin)
- Audius public API (raw fetch for search/stream, `@audius/sdk` for OAuth + write actions)

## Dev
```
npm run dev
```

## Architecture
- `src/utils/audius.js` — API helpers (search, stream URL, profile URL)
- `src/hooks/useAudius.js` — Track queue state management
- `src/contexts/AuthContext.jsx` — Audius OAuth auth state + SDK instance
- `src/components/Player.jsx` — Audio playback via HTML5 `<audio>` element
- `src/components/Background.jsx` — Animated gradient background
- `src/components/AuthButton.jsx` — Login/logout button (bottom-left)
- `src/components/TrackActions.jsx` — Like/repost icons (visible when logged in)

## Audius API
- Base URL: `https://api.audius.co`
- All requests include `?app_name=drift`
- Search: `GET /v1/tracks/search?query=lofi&mood=chill&genre=Electronic`
- Stream: `GET /v1/tracks/:id/stream`

## OAuth / Login
- SDK initialized with `appName: 'drift'` — no API key required
- OAuth popup flow via `sdk.oauth.login({ scope: 'write' })`
- User profile persisted to `localStorage` under `drift:user`
- Like/repost use `sdk.tracks.favoriteTrack()` / `sdk.tracks.repostTrack()`

## Notes
- No build-time env vars needed — Audius API is public
- Tracks are shuffled client-side for variety between sessions
- `prefers-reduced-motion` disables background animations
