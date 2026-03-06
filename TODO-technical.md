# Technical Improvements (Post-Launch)

## 1. Break up DJMode.jsx
`DJMode.jsx` is ~2,000+ lines. Extract into smaller components:
- `SearchFilters` — genre pills, BPM/key/mood/duration/date inputs
- `TrackList` — search results with per-track actions
- `PlaylistSidebar` — playlist library panel

## 2. Virtualize large result lists
Deep Dive can return 1,000+ tracks but renders them all. Use `@tanstack/react-virtual` to only render visible rows.

## 3. Wire up swipe gestures
`useGestures.js` exists but only swipe-left is used. Swipe right = previous is a natural mobile fit.

## 4. Dynamic CDN node discovery
`src/utils/audius.js` hardcodes Audius image CDN nodes. Fetch from discovery endpoint with hardcoded fallback.

## 5. Shareable links
Encode search query, filters, or playlist ID in URL hash so users can share discoveries.
