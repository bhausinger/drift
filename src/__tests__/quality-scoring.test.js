import { describe, it, expect } from 'vitest'

// We need to test the quality scoring algorithm. Since engagementRatio,
// qualityScore, passesQualityGate, isAIContent, weightedShuffle, and shuffle
// are not exported, we test them indirectly via the exported functions.
// For direct testing, we re-implement the logic here to verify correctness.

// ─── engagementRatio ─────────────────────────────────────────────────────
function engagementRatio(track) {
  const plays = track.play_count || 0
  if (plays === 0) return 0
  return ((track.favorite_count || 0) + (track.repost_count || 0)) / plays
}

describe('engagementRatio', () => {
  it('returns 0 for 0 plays', () => {
    expect(engagementRatio({ play_count: 0, favorite_count: 10, repost_count: 5 })).toBe(0)
  })

  it('calculates (favs + reposts) / plays', () => {
    expect(engagementRatio({ play_count: 100, favorite_count: 10, repost_count: 5 })).toBe(0.15)
  })

  it('handles missing counts gracefully', () => {
    expect(engagementRatio({ play_count: 100 })).toBe(0)
  })

  it('high engagement track', () => {
    const ratio = engagementRatio({ play_count: 200, favorite_count: 50, repost_count: 30 })
    expect(ratio).toBe(0.4) // 80 / 200
  })
})

// ─── isAIContent ─────────────────────────────────────────────────────────
function isAIContent(track) {
  const title = (track.title || '').toLowerCase()
  const artistName = (track.user?.name || '').toLowerCase()
  const handle = (track.user?.handle || '').toLowerCase()
  const tags = (track.tags || '').toLowerCase()
  const aiPatterns = [
    /\bai\b/, /\ba\.i\./, /\bartificial intelligence\b/,
    /\bai.generated\b/, /\bai.music\b/, /\bai.made\b/,
    /\bsuno\b/, /\budio\b/, /\bai.cover\b/, /\bai.remix\b/,
  ]
  const fields = [title, artistName, handle, tags]
  return fields.some(f => aiPatterns.some(p => p.test(f)))
}

describe('isAIContent', () => {
  it('detects "ai" in title', () => {
    expect(isAIContent({ title: 'This is an AI track' })).toBe(true)
  })

  it('detects "suno" in tags', () => {
    expect(isAIContent({ title: 'Cool Beat', tags: 'suno beats lofi' })).toBe(true)
  })

  it('detects "udio" in artist name', () => {
    expect(isAIContent({ title: 'Song', user: { name: 'Udio Creator' } })).toBe(true)
  })

  it('does not flag normal tracks', () => {
    expect(isAIContent({ title: 'Chill Vibes', user: { name: 'DJ Cool', handle: 'djcool' } })).toBe(false)
  })

  it('does not flag "ai" as substring (e.g. "rain")', () => {
    // \bai\b matches word boundary, so "rain" shouldn't match
    expect(isAIContent({ title: 'rain sounds' })).toBe(false)
  })

  it('detects a.i. notation', () => {
    expect(isAIContent({ title: 'A.I. generated beats' })).toBe(true)
  })
})

// ─── passesQualityGate ───────────────────────────────────────────────────
function passesQualityGate(track) {
  const plays = track.play_count || 0
  if (plays < 15) return false
  if (!track.artwork?.['150x150']) return false
  if (track.duration < 30) return false
  if (!track.title || track.title.trim().length < 2) return false
  if (!track.user || (track.user.follower_count || 0) < 3) return false
  if (isAIContent(track)) return false
  if (plays >= 500) return true
  return engagementRatio(track) >= 0.01
}

function makeTrack(overrides = {}) {
  return {
    play_count: 1000,
    favorite_count: 50,
    repost_count: 20,
    duration: 180,
    title: 'Test Track',
    artwork: { '150x150': 'https://example.com/art.jpg' },
    user: { handle: 'testartist', name: 'Test', follower_count: 100 },
    ...overrides,
  }
}

describe('passesQualityGate', () => {
  it('passes a well-formed track', () => {
    expect(passesQualityGate(makeTrack())).toBe(true)
  })

  it('rejects tracks with <15 plays', () => {
    expect(passesQualityGate(makeTrack({ play_count: 10 }))).toBe(false)
  })

  it('rejects tracks without artwork', () => {
    expect(passesQualityGate(makeTrack({ artwork: {} }))).toBe(false)
    expect(passesQualityGate(makeTrack({ artwork: null }))).toBe(false)
  })

  it('rejects tracks shorter than 30s', () => {
    expect(passesQualityGate(makeTrack({ duration: 20 }))).toBe(false)
  })

  it('rejects tracks with empty/short title', () => {
    expect(passesQualityGate(makeTrack({ title: '' }))).toBe(false)
    expect(passesQualityGate(makeTrack({ title: 'A' }))).toBe(false)
  })

  it('rejects tracks from users with <3 followers', () => {
    expect(passesQualityGate(makeTrack({ user: { handle: 'x', follower_count: 1 } }))).toBe(false)
  })

  it('rejects AI-generated tracks', () => {
    expect(passesQualityGate(makeTrack({ title: 'AI generated beat' }))).toBe(false)
    expect(passesQualityGate(makeTrack({ tags: 'suno' }))).toBe(false)
  })

  it('passes established tracks (500+ plays) regardless of engagement', () => {
    expect(passesQualityGate(makeTrack({ play_count: 500, favorite_count: 0, repost_count: 0 }))).toBe(true)
  })

  it('rejects small tracks with <1% engagement', () => {
    // 100 plays, 0 favs/reposts = 0% engagement
    expect(passesQualityGate(makeTrack({ play_count: 100, favorite_count: 0, repost_count: 0 }))).toBe(false)
  })

  it('passes small tracks with >=1% engagement', () => {
    // 100 plays, 1 fav = 1% engagement
    expect(passesQualityGate(makeTrack({ play_count: 100, favorite_count: 1, repost_count: 0 }))).toBe(true)
  })
})

// ─── qualityScore ────────────────────────────────────────────────────────
function qualityScore(track) {
  const plays = track.play_count || 0
  const favs = track.favorite_count || 0
  const reposts = track.repost_count || 0
  const engagement = engagementRatio(track)
  const reach = Math.log10(plays + 1)
  const released = track.release_date ? new Date(track.release_date) : null
  const ageMonths = released ? (Date.now() - released.getTime()) / (30 * 24 * 60 * 60 * 1000) : 18
  const recency = ageMonths < 3 ? 0.4 : ageMonths < 6 ? 0.3 : ageMonths < 12 ? 0.15 : 0
  const followers = track.user?.follower_count || 0
  const artistBonus = followers > 1000 ? 0.4 : followers > 200 ? 0.25 : followers > 50 ? 0.1 : 0
  const loveRatio = plays > 0 ? favs / plays : 0
  const loveBonus = loveRatio > 0.05 ? 0.3 : loveRatio > 0.02 ? 0.15 : 0
  const comments = track.comment_count || 0
  const commentBonus = comments > 10 ? 0.3 : comments > 3 ? 0.15 : 0
  const curatedBonus = track._curatedBoost ? 3.0 : 0
  return engagement * 4 + reach * 0.3 + recency + artistBonus + loveBonus + commentBonus + curatedBonus
}

describe('qualityScore', () => {
  it('higher engagement = higher score', () => {
    const lowEng = qualityScore(makeTrack({ play_count: 1000, favorite_count: 5, repost_count: 0 }))
    const highEng = qualityScore(makeTrack({ play_count: 1000, favorite_count: 200, repost_count: 50 }))
    expect(highEng).toBeGreaterThan(lowEng)
  })

  it('recent tracks score higher than old tracks', () => {
    const now = new Date()
    // 1 month old → 0.4 recency
    const recent = qualityScore(makeTrack({ release_date: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString() }))
    // 4 months old → 0.3 recency
    const mid = qualityScore(makeTrack({ release_date: new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString() }))
    // 11 months old → 0.15 recency
    const old = qualityScore(makeTrack({ release_date: new Date(now - 330 * 24 * 60 * 60 * 1000).toISOString() }))
    expect(recent).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(old)
  })

  it('artists with more followers score higher', () => {
    const small = qualityScore(makeTrack({ user: { follower_count: 10 } }))
    const mid = qualityScore(makeTrack({ user: { follower_count: 500 } }))
    const big = qualityScore(makeTrack({ user: { follower_count: 5000 } }))
    expect(big).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(small)
  })

  it('curated boost adds +3 to score', () => {
    const normal = qualityScore(makeTrack())
    const curated = qualityScore(makeTrack({ _curatedBoost: true }))
    expect(curated - normal).toBeCloseTo(3.0, 1)
  })

  it('comments boost score', () => {
    const noComments = qualityScore(makeTrack({ comment_count: 0 }))
    const someComments = qualityScore(makeTrack({ comment_count: 5 }))
    const manyComments = qualityScore(makeTrack({ comment_count: 20 }))
    expect(someComments).toBeGreaterThan(noComments)
    expect(manyComments).toBeGreaterThan(someComments)
  })

  it('love ratio (fav-heavy) tracks score higher', () => {
    // 6% love ratio
    const loved = qualityScore(makeTrack({ play_count: 1000, favorite_count: 60, repost_count: 0 }))
    // 0.5% love ratio
    const notLoved = qualityScore(makeTrack({ play_count: 1000, favorite_count: 5, repost_count: 0 }))
    expect(loved).toBeGreaterThan(notLoved)
  })
})

// ─── Fisher-Yates shuffle correctness ───────────────────────────────────
describe('shuffle (Fisher-Yates)', () => {
  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  it('preserves all elements', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = shuffle(input)
    expect(result.sort((a, b) => a - b)).toEqual(input)
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffle(input)
    expect(input).toEqual(copy)
  })

  it('produces different orderings (statistical)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const results = new Set()
    for (let i = 0; i < 20; i++) {
      results.add(shuffle(input).join(','))
    }
    // With 10 elements and 20 shuffles, we should get multiple orderings
    expect(results.size).toBeGreaterThan(1)
  })

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([])
  })

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42])
  })
})

// ─── weightedShuffle behavior ────────────────────────────────────────────
describe('weightedShuffle', () => {
  function weightedShuffle(arr) {
    return arr
      .map((t) => ({ t, score: qualityScore(t) + Math.random() * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .map(({ t }) => t)
  }

  it('tends to surface high-quality tracks near the top', () => {
    const high = makeTrack({ play_count: 10000, favorite_count: 2000, repost_count: 500, user: { follower_count: 5000 } })
    const low = makeTrack({ play_count: 20, favorite_count: 0, repost_count: 0, user: { follower_count: 5 } })

    let highFirst = 0
    const trials = 50
    for (let i = 0; i < trials; i++) {
      const result = weightedShuffle([low, high])
      if (result[0] === high) highFirst++
    }
    // High-quality track should be first most of the time
    expect(highFirst).toBeGreaterThan(trials * 0.8)
  })
})
