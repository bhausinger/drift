const TEAM_HANDLES = ['sonictexturez', 'phuturecollective', 'audius']

export function isTeamMember(user) {
  return !!user?.handle && TEAM_HANDLES.includes(user.handle.toLowerCase())
}
