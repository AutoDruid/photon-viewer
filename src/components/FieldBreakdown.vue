<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import type { TreeKind, TreeNode } from '../types'

const props = defineProps<{
  bytes: Uint8Array
  root: TreeNode | null
}>()

interface FieldRow {
  id: number
  name: string
  value: string
  start: number
  end: number
  kind: TreeKind
  depth: number
}

interface Group {
  id: number
  label: string
  kind: TreeKind
  start: number
  end: number
  rows: FieldRow[]
}

const search = ref('')
const hoverId = ref<number | null>(null)

/** Splits "Name: value" on the first colon. Nodes whose label has no colon
 *  (container headers, the root, raw-bytes placeholders) get an empty value. */
function splitLabel(label: string): { name: string; value: string } {
  const idx = label.indexOf(':')
  if (idx < 0) return { name: label.trim(), value: '' }
  return {
    name: label.slice(0, idx).trim(),
    value: label.slice(idx + 1).trim(),
  }
}

/** Considers a node a "leaf field" either when it has no children, or when
 *  all its children cover the same byte range (meaning the parent is already
 *  the most specific thing we can point at). */
function isLeafField(n: TreeNode): boolean {
  if (n.children.length === 0) return true
  return n.children.every(
    (c) => c.start === n.start && c.end === n.end && c.children.length === 0,
  )
}

function collectRows(
  n: TreeNode,
  out: FieldRow[],
  depth: number,
): void {
  if (isLeafField(n)) {
    const { name, value } = splitLabel(n.label)
    out.push({
      id: n.id,
      name,
      value: value || n.extra || '',
      start: n.start,
      end: n.end,
      kind: n.kind,
      depth,
    })
    return
  }
  for (const c of n.children) collectRows(c, out, depth + 1)
}

/** Top-level sections inside the root (session header, each command, trailing
 *  bytes) become groups; anything else is flattened inside its group. */
const groups = computed<Group[]>(() => {
  if (!props.root) return []
  const out: Group[] = []
  for (const section of props.root.children) {
    const rows: FieldRow[] = []
    collectRows(section, rows, 0)
    out.push({
      id: section.id,
      label: section.label,
      kind: section.kind,
      start: section.start,
      end: section.end,
      rows,
    })
  }
  return out
})

const filteredGroups = computed<Group[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.value.toLowerCase().includes(q) ||
          hexBytes(r.start, r.end).toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.rows.length > 0)
})

const totalFields = computed(() =>
  groups.value.reduce((acc, g) => acc + g.rows.length, 0),
)
const shownFields = computed(() =>
  filteredGroups.value.reduce((acc, g) => acc + g.rows.length, 0),
)

function hexBytes(start: number, end: number): string {
  const n = Math.min(end, props.bytes.length)
  if (n <= start) return ''
  const parts: string[] = []
  for (let i = start; i < n; i++) {
    parts.push(props.bytes[i].toString(16).padStart(2, '0'))
  }
  return parts.join(' ')
}

function asciiBytes(start: number, end: number): string {
  const n = Math.min(end, props.bytes.length)
  if (n <= start) return ''
  let out = ''
  for (let i = start; i < n; i++) {
    const b = props.bytes[i]
    out += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'
  }
  return out
}

function range(start: number, end: number): string {
  const len = Math.max(0, end - start)
  if (len === 0) return `@${start}`
  if (len === 1) return `@${start}`
  return `@${start}…${end - 1}`
}

async function copyRow(row: FieldRow) {
  const text = `${row.name}: ${row.value}  [${hexBytes(row.start, row.end)}]`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* best-effort; ignore clipboard failures */
  }
}
</script>

<template>
  <section
    class="flex flex-col min-h-0 border-r"
    style="border-color: var(--border)"
  >
    <h2
      class="m-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.8px] border-b"
      style="
        color: var(--fg-dim);
        background: var(--bg-2);
        border-color: var(--border);
      "
    >
      Field breakdown
    </h2>

    <div
      class="flex items-center gap-2 px-3 py-1.5 border-b text-xs"
      style="background: var(--bg-2); border-color: var(--border)"
    >
      <i class="pi pi-search" style="color: var(--fg-dim); font-size: 11px" />
      <InputText
        v-model="search"
        placeholder="Filter field name, value, or hex (e.g. 9b 0d, Param, EventCode)…"
        class="!text-[11.5px] flex-1"
      />
      <span style="color: var(--fg-dim)">
        {{ shownFields }} / {{ totalFields }} fields
      </span>
    </div>

    <div class="flex-1 min-h-0 overflow-auto font-mono text-[12px]">
      <div
        v-if="!root"
        class="italic text-center py-8"
        style="color: var(--fg-dim)"
      >
        Paste a packet and press Parse to see a field-by-field breakdown.
      </div>

      <div
        v-else-if="filteredGroups.length === 0"
        class="italic text-center py-8"
        style="color: var(--fg-dim)"
      >
        No fields match “{{ search }}”.
      </div>

      <div
        v-for="g in filteredGroups"
        :key="g.id"
        class="border-b"
        style="border-color: var(--border)"
      >
        <header
          class="sticky top-0 z-[1] px-3 py-1.5 text-[11px] font-semibold flex items-center gap-2 backdrop-blur"
          style="background: rgba(21, 25, 36, 0.92); border-bottom: 1px solid var(--border)"
        >
          <span class="kind-tag" :class="g.kind">{{ g.kind || 'section' }}</span>
          <span class="truncate" style="color: var(--fg)">{{ g.label }}</span>
          <span class="flex-1" />
          <span style="color: var(--fg-dim)">
            {{ range(g.start, g.end) }} • {{ g.end - g.start }} B
          </span>
        </header>

        <table class="w-full border-collapse">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider">
              <th
                class="text-left px-3 py-1 border-b"
                style="color: var(--fg-dim); background: var(--bg); border-color: var(--border); width: 44px"
              >
                Off
              </th>
              <th
                class="text-left px-3 py-1 border-b"
                style="color: var(--fg-dim); background: var(--bg); border-color: var(--border); width: 220px"
              >
                Field
              </th>
              <th
                class="text-left px-3 py-1 border-b"
                style="color: var(--fg-dim); background: var(--bg); border-color: var(--border)"
              >
                Hex
              </th>
              <th
                class="text-left px-3 py-1 border-b"
                style="color: var(--fg-dim); background: var(--bg); border-color: var(--border); width: 88px"
              >
                ASCII
              </th>
              <th
                class="text-left px-3 py-1 border-b"
                style="color: var(--fg-dim); background: var(--bg); border-color: var(--border)"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in g.rows"
              :key="r.id"
              class="field-row"
              :class="[`k-${r.kind || 'none'}`, { hover: hoverId === r.id }]"
              @mouseenter="hoverId = r.id"
              @mouseleave="hoverId = null"
              @click="copyRow(r)"
              :title="'Click to copy · ' + range(r.start, r.end)"
            >
              <td class="px-3 py-0.5 align-top" style="color: var(--fg-dim)">
                {{ r.start.toString(16).padStart(4, '0') }}
              </td>
              <td class="px-3 py-0.5 align-top">
                <span class="kind-tag" :class="r.kind">{{ r.kind || '·' }}</span>
                <span style="color: var(--fg)">{{ r.name || '(unnamed)' }}</span>
              </td>
              <td class="px-3 py-0.5 align-top break-all" style="color: #d5e4ff">
                {{ hexBytes(r.start, r.end) || '—' }}
              </td>
              <td class="px-3 py-0.5 align-top" style="color: var(--fg-dim)">
                {{ asciiBytes(r.start, r.end) || '—' }}
              </td>
              <td class="px-3 py-0.5 align-top break-all" style="color: var(--ok)">
                {{ r.value || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.field-row {
  cursor: pointer;
  transition: background 0.08s;
}
.field-row:hover,
.field-row.hover {
  background: rgba(106, 169, 255, 0.08);
}
.field-row td {
  border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
}
</style>
