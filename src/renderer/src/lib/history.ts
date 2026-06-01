/**
 * Downloads history, persisted locally in the renderer (localStorage). Each
 * completed download records enough to display it and to re-open its folder.
 */

export interface HistoryItem {
  id: string
  title: string
  url: string
  /** Engine format label, e.g. "1080p" or "Audio Only". */
  format: string
  /** Absolute path of the saved file (used by "Open Folder"). */
  filepath: string
  /** Epoch milliseconds. */
  timestamp: number
}

const KEY = 'umd.history'
const MAX_ITEMS = 100

export function loadHistory(): HistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function addHistoryItem(item: Omit<HistoryItem, 'id'>): HistoryItem[] {
  const entry: HistoryItem = { ...item, id: `${item.timestamp}-${Math.random().toString(36).slice(2, 8)}` }
  const next = [entry, ...loadHistory()].slice(0, MAX_ITEMS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / storage failures */
  }
  return next
}

export function clearHistory(): HistoryItem[] {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  return []
}
