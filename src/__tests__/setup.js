import '@testing-library/jest-dom'

// Mock localStorage
const store = {}
const localStorageMock = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
  clear: () => { for (const k in store) delete store[k] },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Reset localStorage between tests
afterEach(() => localStorageMock.clear())
