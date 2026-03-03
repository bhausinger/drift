const STORAGE_KEY = 'drift:handleList'

export function getHandleList() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

export function addHandle(handle) {
  const list = getHandleList()
  const normalized = handle.toLowerCase().replace(/^@/, '')
  if (list.includes(normalized)) return list
  const updated = [...list, normalized]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function removeHandle(handle) {
  const normalized = handle.toLowerCase().replace(/^@/, '')
  const updated = getHandleList().filter((h) => h !== normalized)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function clearHandleList() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}
