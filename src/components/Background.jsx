export default function Background({ accentColor = null }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden"
         style={{ backgroundColor: 'var(--c-deep)', transition: 'background-color 1.5s ease' }}>

      {/* Large slow orb — top left */}
      <div className="absolute w-[70vmax] h-[70vmax] rounded-full blur-[140px] top-[-25%] left-[-20%] animate-float-1"
           style={{
             backgroundColor: 'var(--c-indigo)',
             opacity: 0.4,
             transition: 'background-color 1.5s ease',
           }} />

      {/* Large slow orb — bottom right */}
      <div className="absolute w-[60vmax] h-[60vmax] rounded-full blur-[120px] bottom-[-20%] right-[-15%] animate-float-2"
           style={{
             backgroundColor: 'var(--c-purple)',
             opacity: 0.35,
             transition: 'background-color 1.5s ease',
           }} />

      {/* Center orb — accent color */}
      <div className="absolute w-[45vmax] h-[45vmax] rounded-full blur-[100px] top-[50%] left-[50%] animate-float-3"
           style={{
             backgroundColor: accentColor || 'var(--c-violet)',
             opacity: 0.25,
             transform: 'translate(-50%, -50%)',
             transition: 'background-color 2s ease',
           }} />

      {/* Teal accent — top right */}
      <div className="absolute w-[35vmax] h-[35vmax] rounded-full blur-[90px] top-[5%] right-[5%] animate-float-4"
           style={{
             backgroundColor: 'var(--c-teal)',
             opacity: 0.2,
             transition: 'background-color 1.5s ease',
           }} />

      {/* Small ember — fast float */}
      <div className="absolute w-[12vmax] h-[12vmax] rounded-full blur-[50px] animate-ember-1"
           style={{
             backgroundColor: 'var(--c-violet)',
             opacity: 0.12,
             transition: 'background-color 1.5s ease',
           }} />

      {/* Tiny ember — accent */}
      <div className="absolute w-[8vmax] h-[8vmax] rounded-full blur-[40px] animate-ember-2"
           style={{
             backgroundColor: 'var(--c-teal)',
             opacity: 0.08,
             transition: 'background-color 1.5s ease',
           }} />

      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
             backgroundRepeat: 'repeat',
             backgroundSize: '128px 128px',
           }} />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,16,0.5)_100%)]" />
    </div>
  )
}
