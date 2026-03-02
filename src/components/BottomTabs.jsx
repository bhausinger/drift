export default function BottomTabs({ activeTab, onTabChange }) {
  const tabs = [
    {
      id: 'vibe',
      label: 'Vibe',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      ),
    },
    {
      id: 'deepdive',
      label: 'Deep Dive',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-xl border-t border-white/[0.06]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-0.5 px-6 py-1.5 transition-colors duration-300
              ${activeTab === tab.id ? 'text-white/80' : 'text-white/25'}`}
          >
            {tab.icon}
            <span className="text-[10px] tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
