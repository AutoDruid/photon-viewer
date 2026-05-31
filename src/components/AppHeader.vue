<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import WasmBadge from './WasmBadge.vue'
import type { ProtocolVersion, ViewMode } from '../types'

defineProps<{
  version: ProtocolVersion
  view: ViewMode
  wasmLoading: boolean
  wasmReady: boolean
  wasmError: string | null
  canParse: boolean
}>()

const emit = defineEmits<{
  (e: 'update:version', v: ProtocolVersion): void
  (e: 'update:view', v: ViewMode): void
  (e: 'parse'): void
  (e: 'sample'): void
  (e: 'clear'): void
}>()

const versionOptions = [
  { label: 'GpBinary v18', value: 'v18' as const },
  { label: 'GpBinary v16', value: 'v16' as const },
]

const viewOptions = [
  { label: 'Split view', value: 'split' as const },
  { label: 'Field breakdown', value: 'fields' as const },
]
</script>

<template>
  <header
    class="flex items-center gap-3 px-4 py-2.5 border-b"
    style="background: var(--bg-2); border-color: var(--border)"
  >
    <h1 class="text-sm font-semibold tracking-wide m-0">
      Photon Packet Visualizer
    </h1>
    <span class="text-xs" style="color: var(--fg-dim)">
      Paste a Wireshark hex dump — parsing runs in Go compiled to WebAssembly.
    </span>
    <span class="flex-1" />

    <WasmBadge :loading="wasmLoading" :ready="wasmReady" :error="wasmError" />

    <SelectButton
      :model-value="view"
      @update:model-value="(v: ViewMode) => v && emit('update:view', v)"
      :options="viewOptions"
      option-label="label"
      option-value="value"
      :allow-empty="false"
      size="small"
      class="!text-xs"
      v-tooltip.bottom="'Switch between the split view and the flat field breakdown'"
    />

    <label for="version" class="text-xs" style="color: var(--fg-dim)">Protocol:</label>
    <Select
      :model-value="version"
      @update:model-value="(v: ProtocolVersion) => emit('update:version', v)"
      :options="versionOptions"
      option-label="label"
      option-value="value"
      input-id="version"
      class="!text-xs min-w-[10rem]"
    />

    <Button
      label="Sample"
      severity="secondary"
      size="small"
      @click="emit('sample')"
      v-tooltip.bottom="'Load a sample packet'"
    />
    <Button
      label="Clear"
      severity="secondary"
      size="small"
      @click="emit('clear')"
      v-tooltip.bottom="'Clear the input'"
    />
    <Button
      label="Parse"
      size="small"
      :disabled="!canParse"
      @click="emit('parse')"
      v-tooltip.bottom="'Parse the pasted hex (⌘/Ctrl+Enter)'"
    />
  </header>
</template>
