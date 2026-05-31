import { reactive, computed, watch } from 'vue'
import type { TreeKind } from '../types'

export const ALL_KINDS: Exclude<TreeKind, ''>[] = [
  'session',
  'cmd',
  'ack',
  'ping',
  'rel',
  'param',
  'raw',
]

const FILTER_KEY = 'photon-packet-visualizer:filters:v1'

function loadEnabled(): Set<TreeKind> {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return new Set(ALL_KINDS)
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set(ALL_KINDS)
    return new Set(arr.filter((k) => ALL_KINDS.includes(k)))
  } catch {
    return new Set(ALL_KINDS)
  }
}

const state = reactive({
  enabled: Array.from(loadEnabled()) as TreeKind[],
})

watch(
  () => state.enabled.slice(),
  (next) => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(next))
    } catch (e) {
      console.warn('localStorage write failed:', e)
    }
  },
  { deep: true },
)

export function useFilters() {
  const enabledSet = computed(() => new Set(state.enabled))

  function isEnabled(kind: TreeKind) {
    return enabledSet.value.has(kind)
  }

  function toggle(kind: TreeKind) {
    const i = state.enabled.indexOf(kind)
    if (i >= 0) state.enabled.splice(i, 1)
    else state.enabled.push(kind)
  }

  function setAll(enabled: boolean) {
    if (enabled) state.enabled = [...ALL_KINDS]
    else state.enabled = []
  }

  return { state, enabledSet, isEnabled, toggle, setAll }
}
