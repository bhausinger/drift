export default function Background({ accentColor = null, levels = {}, parallax = {} }) {
  const { bass = 0, mid = 0, high = 0, pulse = 0 } = levels
  const { x: px = 0, y: py = 0 } = parallax

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden"
         style={{ backgroundColor: 'var(--c-deep)', transition: 'background-color 2s ease' }}>

      {/* Primary ambient field — slow drift, large coverage */}
      <div className="absolute will-change-transform animate-drift-1"
           style={{
             width: '60vmax', height: '60vmax',
             top: '-15%', left: '-10%',
             borderRadius: '50%',
             background: `radial-gradient(circle, var(--c-indigo) 0%, transparent 70%)`,
             opacity: 0.5,
             filter: 'blur(80px)',
             transition: 'background 2s ease',
             transform: `translate(${px * 12}px, ${py * 12}px) scale(${1 + bass * 0.08})`,
           }} />

      {/* Secondary ambient field — counter-drift */}
      <div className="absolute will-change-transform animate-drift-2"
           style={{
             width: '55vmax', height: '55vmax',
             bottom: '-10%', right: '-10%',
             borderRadius: '50%',
             background: `radial-gradient(circle, var(--c-purple) 0%, transparent 70%)`,
             opacity: 0.4 + mid * 0.15,
             filter: 'blur(80px)',
             transition: 'background 2s ease',
             transform: `translate(${px * -8}px, ${py * -8}px)`,
           }} />

      {/* Center glow — reacts to artwork accent + beat pulse */}
      <div className="absolute will-change-transform animate-breathe"
           style={{
             width: '40vmax', height: '40vmax',
             top: '50%', left: '50%',
             borderRadius: '50%',
             background: `radial-gradient(circle, ${accentColor || 'var(--c-violet)'} 0%, transparent 70%)`,
             opacity: 0.2 + pulse * 0.12,
             filter: 'blur(60px)',
             transition: 'background 3s ease',
             transform: `translate(calc(-50% + ${px * 4}px), calc(-50% + ${py * 4}px)) scale(${1 + pulse * 0.06})`,
           }} />

      {/* Accent wisp — slow orbit */}
      <div className="absolute will-change-transform animate-drift-3"
           style={{
             width: '30vmax', height: '30vmax',
             top: '10%', right: '5%',
             borderRadius: '50%',
             background: `radial-gradient(circle, var(--c-teal) 0%, transparent 70%)`,
             opacity: 0.2 + high * 0.15,
             filter: 'blur(60px)',
             transition: 'background 2s ease',
             transform: `translate(${px * -6}px, ${py * -6}px)`,
           }} />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
             backgroundRepeat: 'repeat',
             backgroundSize: '128px 128px',
           }} />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,16,0.6)_100%)]" />
    </div>
  )
}
