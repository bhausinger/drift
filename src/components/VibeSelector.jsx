import { VIBES } from '../utils/audius'
import { useAuth } from '../contexts/AuthContext'
import { isTeamMember } from '../utils/team'

export default function VibeSelector({ current, onChange }) {
  const { user } = useAuth() || {}
  const isTeam = isTeamMember(user)

  return (
    <div className="flex items-center justify-center w-full px-1">
      {Object.entries(VIBES)
        .filter(([, config]) => !config.teamOnly || isTeam)
        .map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`text-[11px] sm:text-xs tracking-[0.1em] sm:tracking-[0.2em] uppercase transition-all duration-500
            py-2 px-2 sm:px-3 rounded-md whitespace-nowrap flex-shrink-0
            ${key === current
              ? 'text-white/70'
              : 'text-white/35 hover:text-white/50'
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
