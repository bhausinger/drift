export default function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--c-deep)]">
      {/* Rotating base gradient — more vivid colors */}
      <div className="absolute inset-[-50%] animate-rotate-slow
                      bg-[conic-gradient(from_0deg,var(--c-deep),var(--c-indigo),var(--c-purple),var(--c-teal),var(--c-deep))]
                      opacity-90" />

      {/* Large primary orb — indigo/blue */}
      <div className="absolute w-[60vmax] h-[60vmax] rounded-full blur-[120px] opacity-40
                      bg-[var(--c-indigo)] top-[-20%] left-[-15%] animate-float-1" />

      {/* Purple orb */}
      <div className="absolute w-[50vmax] h-[50vmax] rounded-full blur-[100px] opacity-35
                      bg-[var(--c-purple)] bottom-[-15%] right-[-15%] animate-float-2" />

      {/* Center violet orb */}
      <div className="absolute w-[40vmax] h-[40vmax] rounded-full blur-[100px] opacity-30
                      bg-[var(--c-violet)] top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 animate-float-3" />

      {/* Teal accent orb */}
      <div className="absolute w-[30vmax] h-[30vmax] rounded-full blur-[80px] opacity-25
                      bg-[var(--c-teal)] top-[10%] right-[10%] animate-float-4" />

      {/* Grain overlay */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
             backgroundRepeat: 'repeat',
             backgroundSize: '128px 128px',
           }} />

      {/* Vignette — softer */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,16,0.5)_100%)]" />
    </div>
  )
}
