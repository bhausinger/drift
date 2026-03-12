import { describe, it, expect } from 'vitest'
import { isTeamMember } from '../utils/team'

describe('isTeamMember', () => {
  it('recognizes team handles', () => {
    expect(isTeamMember({ handle: 'sonictexturez' })).toBe(true)
    expect(isTeamMember({ handle: 'phuturecollective' })).toBe(true)
    expect(isTeamMember({ handle: 'audius' })).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isTeamMember({ handle: 'SonicTexturez' })).toBe(true)
    expect(isTeamMember({ handle: 'AUDIUS' })).toBe(true)
  })

  it('rejects non-team handles', () => {
    expect(isTeamMember({ handle: 'randomuser' })).toBe(false)
    expect(isTeamMember({ handle: 'djcool' })).toBe(false)
  })

  it('returns false for null/undefined user', () => {
    expect(isTeamMember(null)).toBe(false)
    expect(isTeamMember(undefined)).toBe(false)
    expect(isTeamMember({})).toBe(false)
    expect(isTeamMember({ handle: '' })).toBe(false)
  })
})
