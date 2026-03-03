import { useState, useCallback } from 'react'
import { removeHandle, clearHandleList } from '../utils/handleList'

export default function HandleListPanel({ handles, onUpdate, onClose }) {
  const [copied, setCopied] = useState(false)

  const handleCopyAll = useCallback(() => {
    if (handles.length === 0) return
    const text = handles.map((h) => `@${h}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [handles])

  const handleRemove = useCallback((handle) => {
    const updated = removeHandle(handle)
    onUpdate(updated)
  }, [onUpdate])

  const handleClear = useCallback(() => {
    const updated = clearHandleList()
    onUpdate(updated)
  }, [onUpdate])

  return (
    <div className="absolute right-0 top-0 bottom-0 w-full sm:w-64 z-20 border-l border-white/[0.06] bg-black/80 sm:bg-black/60 backdrop-blur-xl flex flex-col overflow-hidden shadow-xl shadow-black/30">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-white/90 text-[11px] tracking-wider uppercase">Handles</h3>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/70 transition-colors p-1 sm:hidden"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center gap-2">
        <button
          onClick={handleCopyAll}
          disabled={handles.length === 0}
          className="flex-1 px-3 py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20
                     text-purple-200 text-[10px] tracking-wider uppercase rounded-lg transition-all duration-300
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {copied ? 'copied!' : `copy all (${handles.length})`}
        </button>
        {handles.length > 0 && (
          <button
            onClick={handleClear}
            className="px-2.5 py-2 text-white/30 hover:text-red-400/80 text-[10px] tracking-wider uppercase
                       transition-colors duration-200"
            title="Clear list"
          >
            clear
          </button>
        )}
      </div>

      <div className="border-t border-white/[0.06] mx-4" />

      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-2">
        {handles.length === 0 ? (
          <p className="text-white/30 text-[10px] text-center py-8">
            Tap the clipboard icon on tracks to collect handles
          </p>
        ) : (
          <div className="space-y-0.5">
            {handles.map((handle) => (
              <div
                key={handle}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] group"
              >
                <span className="text-white/80 text-xs truncate">@{handle}</span>
                <button
                  onClick={() => handleRemove(handle)}
                  className="text-white/0 group-hover:text-white/30 hover:!text-red-400/70 transition-colors duration-200 flex-shrink-0 p-0.5"
                  aria-label={`Remove @${handle}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
