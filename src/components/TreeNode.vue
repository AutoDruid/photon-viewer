<script setup lang="ts">
import { inject, ref, watch, type Ref } from 'vue'
import type { TreeNode } from '../types'

const props = defineProps<{
  node: TreeNode
  depth: number
  highlightId: number | null
  /** Kinds that should start collapsed on first render when depth > 0. */
  defaultCollapsedKinds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'hover-node', node: TreeNode | null): void
  (e: 'click-node', node: TreeNode): void
}>()

// Each node starts expanded unless it's one of the "noisy" kinds nested in
// the tree (cmd/ack/ping) — that keeps the first view of a packet readable.
function initialExpanded() {
  return !(
    props.depth > 0 &&
    props.node.children.length > 0 &&
    props.defaultCollapsedKinds.has(props.node.kind)
  )
}

const expanded = ref(initialExpanded())

// Shared expand-all / collapse-all signal, published by the enclosing
// ParseTree via provide().
type ExpandSignal = { tick: number; value: boolean } | null
const expandSignal = inject<Ref<ExpandSignal>>('expand-signal', ref(null))

watch(
  () => expandSignal.value?.tick,
  () => {
    if (expandSignal.value && props.node.children.length > 0) {
      expanded.value = expandSignal.value.value
    }
  },
)

// Re-seed initial expansion when a brand-new tree arrives (fresh parse).
watch(
  () => props.node.id,
  () => {
    expanded.value = initialExpanded()
  },
)

function onChevClick(e: MouseEvent) {
  e.stopPropagation()
  if (!props.node.children.length) return
  expanded.value = !expanded.value
}

function onRowClick() {
  emit('click-node', props.node)
}

function onRowEnter() {
  emit('hover-node', props.node)
}

function onRowLeave() {
  emit('hover-node', null)
}

function onDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.chev')) return
  if (!props.node.children.length) return
  expanded.value = !expanded.value
  e.preventDefault()
}

// Skip `data-kind` on the root (depth 0) so filtering out the `session`
// kind can't hide the whole tree.
const kindAttr = props.depth > 0 && props.node.kind ? props.node.kind : null
</script>

<template>
  <div class="node-wrap" :data-kind="kindAttr ?? undefined">
    <div
      class="tree-node py-[2px] px-1.5 rounded-r cursor-pointer whitespace-pre-wrap border-l-2 border-transparent hover:bg-[color:var(--bg-2)] hover:border-l-[color:var(--accent)]"
      :class="{ highlight: highlightId === node.id }"
      :data-id="node.id"
      :data-start="node.start"
      :data-end="node.end"
      @click="onRowClick"
      @mouseenter="onRowEnter"
      @mouseleave="onRowLeave"
      @dblclick="onDblClick"
    >
      <span
        class="chev"
        :class="{
          leaf: node.children.length === 0,
          expanded: expanded && node.children.length > 0,
        }"
        @click="onChevClick"
      >{{ node.children.length ? '▸' : '·' }}</span>
      <span class="kind-tag" :class="node.kind">
        {{ node.kind || 'byte' }}
      </span>
      <span style="color: var(--fg)">{{ node.label }}</span>
      <span class="ml-1.5 text-[11px]" style="color: var(--fg-dim)">
        @ 0x{{ node.start.toString(16).padStart(4, '0') }}..0x{{
          node.end.toString(16).padStart(4, '0')
        }}
        ({{ node.end - node.start }}B)
      </span>
      <span v-if="node.extra" style="color: var(--fg-dim)">
        &nbsp;—&nbsp;{{ node.extra }}
      </span>
    </div>
    <div v-show="expanded && node.children.length" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :highlight-id="highlightId"
        :default-collapsed-kinds="defaultCollapsedKinds"
        @hover-node="(n) => emit('hover-node', n)"
        @click-node="(n) => emit('click-node', n)"
      />
    </div>
  </div>
</template>
