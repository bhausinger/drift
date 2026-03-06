import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#050510] flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-white/60 text-sm tracking-[0.3em] uppercase font-light mb-4">drift</h1>
          <p className="text-white/40 text-xs tracking-wider mb-6">Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-white/50 text-xs tracking-wider border border-white/10 rounded-lg
                       hover:border-white/20 hover:text-white/70 transition-colors"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
