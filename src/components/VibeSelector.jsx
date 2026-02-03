import { VIBES } from '../utils/audius'

export default function VibeSelector({ current, onChange }) {
  return (
    <div className="flex items-center gap-6">
      {Object.entries(VIBES).map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`text-xs tracking-[0.2em] uppercase transition-all duration-500
            ${key === current
              ? 'text-white/70'
              : 'text-white/20 hover:text-white/40'
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
