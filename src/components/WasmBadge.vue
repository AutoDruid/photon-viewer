<script setup lang="ts">
import { computed } from 'vue'

defineProps<{
  loading: boolean
  ready: boolean
  error: string | null
}>()

const dotClass = computed(() => '')
</script>

<template>
  <span
    class="inline-flex items-center gap-2 font-mono text-[11px]"
    :class="{
      'text-[color:var(--fg-dim)]': loading,
      'text-[color:var(--ok)]': ready && !loading,
      'text-[color:var(--err)]': !!error,
    }"
  >
    <span
      class="h-2 w-2 rounded-full"
      :class="{
        'bg-[color:var(--warn)]': loading && !error,
        'bg-[color:var(--ok)]': ready && !loading,
        'bg-[color:var(--err)]': !!error,
      }"
      :style="{
        boxShadow: error
          ? '0 0 0 2px rgba(255,106,106,0.15)'
          : ready
          ? '0 0 0 2px rgba(126,231,135,0.15)'
          : '0 0 0 2px rgba(255,180,84,0.15)',
      }"
    />
    <span v-if="loading">Loading WASM…</span>
    <span v-else-if="error">WASM error</span>
    <span v-else>WASM ready</span>
  </span>
</template>
