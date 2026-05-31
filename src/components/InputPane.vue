<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useHistory } from '../composables/useHistory'
import type { HistoryEntry } from '../types'

const props = defineProps<{
  modelValue: string
  status: { text: string; kind: 'ok' | 'error' | 'info' }
  wasmReady: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'parse'): void
  (e: 'load-history', entry: HistoryEntry): void
}>()

const { entries, remove, rename, clear, labelFor } = useHistory()

const historyOptions = computed(() =>
  entries.value.map((e) => ({ label: labelFor(e), value: e.id, entry: e })),
)

const selectedId = computed(() => null as string | null)

function onHistoryPick(id: string | null) {
  if (!id) return
  const entry = entries.value.find((e) => e.id === id)
  if (entry) emit('load-history', entry)
}

function onRename() {
  const picked = prompt('History entry id to rename (blank = most recent):') ?? ''
  const id = picked || entries.value[0]?.id
  const target = entries.value.find((e) => e.id === id)
  if (!target) return
  const name = prompt(`Name this packet (empty to clear):`, target.name ?? '')
  if (name === null) return
  rename(target.id, name)
}

function onDelete() {
  const id = entries.value[0]?.id
  if (!id) return
  if (!confirm(`Delete the most recent history entry?`)) return
  remove(id)
}

function onClearAll() {
  if (!confirm('Delete all saved packets?')) return
  clear()
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    if (props.wasmReady) emit('parse')
  }
}

const statusClass = computed(() => ({
  'text-[color:var(--fg-dim)]': props.status.kind === 'info',
  'text-[color:var(--ok)]': props.status.kind === 'ok',
  'text-[color:var(--err)]': props.status.kind === 'error',
}))
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
      Input (Wireshark hex)
    </h2>

    <!-- History toolbar -->
    <div
      class="flex items-center gap-2 px-3 py-1.5 border-b text-xs"
      style="background: var(--bg-2); border-color: var(--border)"
    >
      <label for="history-select" class="text-xs" style="color: var(--fg-dim)">
        History
      </label>
      <Select
        id="history-select"
        :model-value="selectedId"
        @update:model-value="onHistoryPick"
        :options="historyOptions"
        option-label="label"
        option-value="value"
        :placeholder="
          entries.length === 0
            ? '— empty —'
            : `${entries.length} saved ${entries.length === 1 ? 'entry' : 'entries'} — pick one…`
        "
        :disabled="entries.length === 0"
        class="!text-[11.5px] flex-1"
      />
      <Button
        label="Rename"
        size="small"
        severity="secondary"
        text
        :disabled="entries.length === 0"
        @click="onRename"
      />
      <Button
        label="Delete"
        size="small"
        severity="secondary"
        text
        :disabled="entries.length === 0"
        @click="onDelete"
      />
      <Button
        label="Clear all"
        size="small"
        severity="secondary"
        text
        :disabled="entries.length === 0"
        @click="onClearAll"
      />
    </div>

    <div class="flex-1 min-h-0 p-3 flex">
      <Textarea
        :model-value="modelValue"
        @update:model-value="(v) => emit('update:modelValue', String(v ?? ''))"
        @keydown="onKeydown"
        spellcheck="false"
        class="w-full h-full !font-mono !text-[12.5px] leading-relaxed resize-none"
        placeholder="Paste any hex format:
• Wireshark: '0000   79 9e 00 03 00 00 04 ef ... y.....'
• Raw hex:   '799e00030000...'
• Colons:    '79:9e:00:03:...'
Then press Parse (⌘/Ctrl+Enter)."
      />
    </div>

    <div
      class="px-3 py-1.5 text-[11px] whitespace-pre-wrap border-t"
      style="background: var(--bg-2); border-color: var(--border)"
      :class="statusClass"
    >
      {{ status.text }}
    </div>
  </section>
</template>
