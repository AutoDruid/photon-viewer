<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import Button from 'primevue/button'
import TreeNode from './TreeNode.vue'
import { useFilters, ALL_KINDS } from '../composables/useFilters'
import type { TreeKind, TreeNode as TreeNodeT } from '../types'

defineProps<{
  root: TreeNodeT | null
  highlightId: number | null
}>()

const emit = defineEmits<{
  (e: 'hover-node', node: TreeNodeT | null): void
  (e: 'click-node', node: TreeNodeT): void
}>()

const { state: filterState, isEnabled, toggle, setAll } = useFilters()

// Nodes whose kind starts collapsed on first render (ignored on the root).
const DEFAULT_COLLAPSED = new Set<string>(['cmd', 'ack', 'ping'])

// Cross-component expand/collapse signal. Descendant TreeNodes inject this
// ref and watch its `.tick` — bumping the tick with `value=true/false` is an
// "expand/collapse everything" broadcast.
type ExpandSignal = { tick: number; value: boolean } | null
const expandSignal = ref<ExpandSignal>(null)
provide('expand-signal', expandSignal)

function expandAll() {
  expandSignal.value = { tick: (expandSignal.value?.tick ?? 0) + 1, value: true }
}
function collapseAll() {
  expandSignal.value = { tick: (expandSignal.value?.tick ?? 0) + 1, value: false }
}

// CSS hide-* classes, one per kind the user has disabled.
const hideClasses = computed(() => {
  const out: Record<string, boolean> = {}
  for (const k of ALL_KINDS) out[`hide-${k}`] = !isEnabled(k)
  return out
})
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
      Parse tree
    </h2>

    <div
      class="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b text-xs"
      style="background: var(--bg-2); border-color: var(--border); row-gap: 4px;"
    >
      <span class="text-xs mr-0.5" style="color: var(--fg-dim)">Show:</span>
      <button
        v-for="k in ALL_KINDS"
        :key="k"
        type="button"
        class="filter-chip"
        :class="[k, { on: isEnabled(k) }]"
        :title="`Toggle ${k}`"
        @click="toggle(k as TreeKind)"
      >
        {{ k }}
      </button>
      <button
        type="button"
        class="filter-chip on"
        style="background: transparent; border-color: var(--border); color: var(--fg-dim); text-decoration: none;"
        title="Show every kind"
        @click="setAll(true)"
      >all</button>
      <button
        type="button"
        class="filter-chip on"
        style="background: transparent; border-color: var(--border); color: var(--fg-dim); text-decoration: none;"
        title="Hide every kind"
        @click="setAll(false)"
      >none</button>
      <span class="flex-1" />
      <Button
        label="Expand all"
        size="small"
        severity="secondary"
        text
        :disabled="!root"
        @click="expandAll"
      />
      <Button
        label="Collapse all"
        size="small"
        severity="secondary"
        text
        :disabled="!root"
        @click="collapseAll"
      />
    </div>

    <div
      class="flex-1 min-h-0 overflow-auto px-3 py-2 font-mono text-[12.5px] leading-[1.5] tree"
      :class="hideClasses"
    >
      <div
        v-if="!root"
        class="italic text-center py-8"
        style="color: var(--fg-dim)"
      >
        Parsed structure will appear here.
      </div>
      <TreeNode
        v-else
        :node="root"
        :depth="0"
        :highlight-id="highlightId"
        :default-collapsed-kinds="DEFAULT_COLLAPSED"
        @hover-node="(n) => emit('hover-node', n)"
        @click-node="(n) => emit('click-node', n)"
      />
    </div>
  </section>
</template>

<style>
.tree.hide-session .node-wrap[data-kind='session'] { display: none; }
.tree.hide-cmd     .node-wrap[data-kind='cmd']     { display: none; }
.tree.hide-ack     .node-wrap[data-kind='ack']     { display: none; }
.tree.hide-ping    .node-wrap[data-kind='ping']    { display: none; }
.tree.hide-rel     .node-wrap[data-kind='rel']     { display: none; }
.tree.hide-param   .node-wrap[data-kind='param']   { display: none; }
.tree.hide-raw     .node-wrap[data-kind='raw']     { display: none; }
</style>
