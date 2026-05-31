<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  bytes: Uint8Array
  /** Byte range to highlight — [start, end) */
  highlight: { start: number; end: number } | null
}>()

const emit = defineEmits<{
  (e: 'hover-pos', pos: number | null): void
  (e: 'click-pos', pos: number): void
}>()

const ROW_BYTES = 16

interface Row {
  offset: number
  cells: { pos: number; byte: number; ch: string }[]
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (let off = 0; off < props.bytes.length; off += ROW_BYTES) {
    const cells: Row['cells'] = []
    for (let j = 0; j < ROW_BYTES; j++) {
      const pos = off + j
      if (pos >= props.bytes.length) break
      const byte = props.bytes[pos]
      cells.push({
        pos,
        byte,
        ch: byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '.',
      })
    }
    out.push({ offset: off, cells })
  }
  return out
})

function isHighlighted(pos: number) {
  const h = props.highlight
  return !!h && pos >= h.start && pos < h.end
}

function onMove(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]')
  if (!el) return
  const pos = Number(el.dataset.pos)
  if (Number.isFinite(pos)) emit('hover-pos', pos)
}

function onLeave() {
  emit('hover-pos', null)
}

function onClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-pos]')
  if (!el) return
  const pos = Number(el.dataset.pos)
  if (Number.isFinite(pos)) emit('click-pos', pos)
}
</script>

<template>
  <div
    class="font-mono text-[12.5px] leading-[1.55] whitespace-nowrap"
    @mousemove="onMove"
    @mouseleave="onLeave"
    @click="onClick"
  >
    <div
      v-if="bytes.length === 0"
      class="italic text-center py-8"
      style="color: var(--fg-dim)"
    >
      Parsed bytes will appear here.
    </div>
    <div
      v-for="row in rows"
      :key="row.offset"
      class="grid gap-3.5"
      style="grid-template-columns: 60px 1fr auto"
    >
      <div style="color: var(--fg-dim)">
        {{ row.offset.toString(16).padStart(4, '0') }}
      </div>
      <div class="tracking-wider">
        <template v-for="(cell, i) in row.cells" :key="cell.pos">
          <span
            class="hex-byte px-0.5 rounded-sm cursor-pointer"
            :class="{ highlight: isHighlighted(cell.pos) }"
            :data-pos="cell.pos"
          >{{ cell.byte.toString(16).padStart(2, '0') }}</span
          ><template v-if="i !== row.cells.length - 1"> </template
          ><template v-if="i === 7"> </template>
        </template>
      </div>
      <div style="color: var(--fg-dim)">
        <span
          v-for="cell in row.cells"
          :key="cell.pos"
          class="hex-ascii px-[1px] rounded-sm"
          :class="{ highlight: isHighlighted(cell.pos) }"
          :data-pos="cell.pos"
        >{{ cell.ch }}</span>
      </div>
    </div>
  </div>
</template>
