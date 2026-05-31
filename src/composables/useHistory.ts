import { ref, type Ref } from 'vue'
import type { HistoryEntry, ProtocolVersion } from '../types'
import { fingerprint, summarizeBytes } from '../lib/hex'

const HISTORY_KEY = 'photon-packet-visualizer:history:v1'
const HISTORY_MAX = 50

function loadFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeToStorage(list: HistoryEntry[]) {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, HISTORY_MAX)),
    )
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

// Single shared list — every composable consumer sees the same entries.
const entries: Ref<HistoryEntry[]> = ref(loadFromStorage())

export function useHistory() {
  function record(opts: {
    text: string
    version: ProtocolVersion
    bytes: Uint8Array
  }): HistoryEntry {
    const { text, version, bytes } = opts
    const list = entries.value.slice()
    const fp = fingerprint(bytes)
    const existingIdx = list.findIndex((e) => e.fingerprint === fp)
    const existing = existingIdx >= 0 ? list.splice(existingIdx, 1)[0] : null

    const entry: HistoryEntry = {
      id:
        existing?.id ??
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: existing?.name ?? null,
      timestamp: Date.now(),
      version,
      bytes: bytes.length,
      preview: summarizeBytes(bytes),
      fingerprint: fp,
      text,
    }
    list.unshift(entry)
    entries.value = list.slice(0, HISTORY_MAX)
    writeToStorage(entries.value)
    return entry
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    writeToStorage(entries.value)
  }

  function rename(id: string, name: string | null) {
    const list = entries.value.slice()
    const e = list.find((x) => x.id === id)
    if (!e) return
    e.name = name && name.trim() ? name.trim() : null
    entries.value = list
    writeToStorage(entries.value)
  }

  function clear() {
    entries.value = []
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // ignore
    }
  }

  function labelFor(entry: HistoryEntry): string {
    if (entry.name) return entry.name
    const d = new Date(entry.timestamp)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}  ·  ${entry.version}  ·  ${entry.bytes}B  ·  ${entry.preview}`
  }

  return { entries, record, remove, rename, clear, labelFor }
}
