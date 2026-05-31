<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import AppHeader from './components/AppHeader.vue'
import InputPane from './components/InputPane.vue'
import HexView from './components/HexView.vue'
import ParseTree from './components/ParseTree.vue'
import FieldBreakdown from './components/FieldBreakdown.vue'

import { useWasm } from './composables/useWasm'
import { useHistory } from './composables/useHistory'
import { sanitizeHex } from './lib/hex'
import { buildTreeFromSession, buildPositionIndex } from './lib/tree'
import type {
  CommandJSON,
  HistoryEntry,
  ProtocolVersion,
  SessionJSON,
  TreeNode,
  ViewMode,
} from './types'

const SAMPLE = `0000   00 00 00 08 ad b8 d0 29 7c 11 66 bd 01 00 00 00
0010   00 00 00 14 00 00 00 00 00 00 00 65 00 00 3f a7
0020   06 00 01 00 00 00 00 18 00 00 00 97 f3 04 01 02
0030   00 11 9b 0d fc 04 01 00 06 00 01 00 00 00 00 1a
0040   00 00 00 98 f3 04 01 02 00 0a 82 d6 86 01 fc 04
0050   01 00 06 00 01 00 00 00 00 1a 00 00 00 99 f3 04
0060   01 02 00 0a c6 d6 86 01 fc 04 01 00 06 00 01 00
0070   00 00 00 18 00 00 00 9a f3 04 01 02 00 11 e4 0c
0080   fc 04 01 00 06 00 01 00 00 00 00 18 00 00 00 9b
0090   f3 04 01 02 00 11 88 02 fc 04 01 00 06 00 01 00
00a0   00 00 00 18 00 00 00 9c f3 04 01 02 00 11 84 11
00b0   fc 04 01 00 06 00 01 00 00 00 00 18 00 00 00 9d
00c0   f3 04 01 02 00 11 85 11 fc 04 01 00`

const wasm = useWasm()
const history = useHistory()

const inputText = ref('')
const version = ref<ProtocolVersion>('v18')
const view = ref<ViewMode>('split')

const bytes = ref<Uint8Array>(new Uint8Array())
const tree = ref<TreeNode | null>(null)
// Per-byte position → [ancestor stack]. Built once per parse; used to
// highlight the innermost tree node when the user hovers the hex view.
const byPos = ref<TreeNode[][]>([])

const hoverRange = ref<{ start: number; end: number } | null>(null)
const hoverNodeId = ref<number | null>(null)

const status = ref<{ text: string; kind: 'ok' | 'error' | 'info' }>({
  text: 'Booting WebAssembly parser…',
  kind: 'info',
})

const canParse = computed(() => wasm.state.ready && !wasm.state.loading)

type RawObject = Record<string, unknown>

function asObject(value: unknown): RawObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawObject)
    : {}
}

function own(obj: RawObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function numberField(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number') return value
  }
  return 0
}

function normalizeParameters(payload: RawObject): RawObject {
  const rawParams = payload.Parameters ?? payload.parameters
  if (!Array.isArray(rawParams)) return payload

  const parameters = rawParams.map((rawParam) => {
    const param = asObject(rawParam)
    const header = asObject(param.header)
    const id = numberField(header.id, param.ID, param.id)
    const type = numberField(header.type, param.Type, param.type)
    const value = own(param, 'decoded')
      ? param.decoded
      : (param.Value ?? param.value)

    return {
      ...param,
      ID: id,
      id,
      Type: type,
      type,
      Value: value,
      value,
    }
  })

  return {
    ...payload,
    Parameters: parameters,
    parameters,
  }
}

function normalizeCommand(rawCommand: unknown): CommandJSON {
  const command = asObject(rawCommand)
  const header = asObject(command.header)
  const payload = command.payload
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? normalizeParameters(payload as RawObject)
      : payload

  return {
    type: numberField(header.type, command.type),
    channel_id: numberField(header.channel_id, command.channel_id),
    flags: numberField(header.flags, command.flags),
    reserved_byte: numberField(header.reserved_byte, command.reserved_byte),
    length: numberField(header.length, command.length),
    reliable_sequence_number: numberField(
      header.reliable_sequence_number,
      command.reliable_sequence_number,
    ),
    payload: normalizedPayload,
  }
}

function normalizeSession(rawSession: unknown): SessionJSON {
  const session = asObject(rawSession)
  const header = asObject(session.header)
  const rawCommands = session.commands ?? session.Commands
  const commands = Array.isArray(rawCommands)
    ? rawCommands.map(normalizeCommand)
    : []

  return {
    peer_id: numberField(header.peer_id, session.peer_id),
    crc_enabled: numberField(header.crc_enabled, session.crc_enabled),
    command_count: numberField(
      header.command_count,
      session.command_count,
      commands.length,
    ),
    timestamp: numberField(header.timestamp, session.timestamp),
    challenge: numberField(header.challenge, session.challenge),
    commands,
  }
}

onMounted(async () => {
  await wasm.boot()
  if (wasm.state.ready) {
    status.value = {
      text: 'Ready. Paste a packet and press Parse (⌘/Ctrl+Enter).',
      kind: 'ok',
    }
  } else {
    status.value = {
      text: `Failed to load WebAssembly parser: ${wasm.state.error ?? 'unknown error'}`,
      kind: 'error',
    }
  }
})

function runParse(opts: { skipSave?: boolean } = {}) {
  try {
    const bs = sanitizeHex(inputText.value)
    if (bs.length < 12) {
      throw new Error(
        `need at least 12 bytes for the session header, got ${bs.length}`,
      )
    }
    const session = normalizeSession(wasm.parse(bs, version.value))
    const t = buildTreeFromSession(session, bs.length, version.value)

    bytes.value = bs
    tree.value = t
    byPos.value = buildPositionIndex(t, bs.length)
    hoverRange.value = null
    hoverNodeId.value = null

    const cmdCount = (session.commands ?? []).length
    status.value = {
      text: `Parsed ${bs.length} bytes  •  protocol=${version.value}  •  ${cmdCount} command(s)  •  via WebAssembly`,
      kind: 'ok',
    }
    if (!opts.skipSave) {
      history.record({
        text: inputText.value,
        version: version.value,
        bytes: bs,
      })
    }
  } catch (err) {
    status.value = {
      text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      kind: 'error',
    }
  }
}

function onSample() {
  inputText.value = SAMPLE
  version.value = 'v18'
  if (canParse.value) nextTick(() => runParse())
}

function onClear() {
  inputText.value = ''
  bytes.value = new Uint8Array()
  tree.value = null
  byPos.value = []
  hoverRange.value = null
  hoverNodeId.value = null
  status.value = {
    text: wasm.state.ready ? 'Ready.' : 'Booting WebAssembly parser…',
    kind: 'info',
  }
}

function onLoadHistory(entry: HistoryEntry) {
  inputText.value = entry.text
  version.value = entry.version
  if (canParse.value) nextTick(() => runParse({ skipSave: true }))
}

// HexView hover → look up the innermost tree node whose span covers that byte.
function onHexHover(pos: number | null) {
  if (pos === null) {
    hoverRange.value = null
    hoverNodeId.value = null
    return
  }
  const stack = byPos.value[pos]
  if (!stack || stack.length === 0) {
    hoverRange.value = null
    hoverNodeId.value = null
    return
  }
  const innermost = stack[stack.length - 1]
  hoverRange.value = { start: innermost.start, end: innermost.end }
  hoverNodeId.value = innermost.id
}

// Click a hex byte → scroll the matching tree node into view.
function onHexClick(pos: number) {
  const stack = byPos.value[pos]
  if (!stack || stack.length === 0) return
  const innermost = stack[stack.length - 1]
  const el = document.querySelector(`.tree-node[data-id="${innermost.id}"]`)
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// Tree hover → highlight the corresponding byte range in the hex view.
function onTreeHover(node: TreeNode | null) {
  if (!node) {
    hoverRange.value = null
    hoverNodeId.value = null
    return
  }
  hoverRange.value = { start: node.start, end: node.end }
  hoverNodeId.value = node.id
}

// Tree click → scroll the hex view to the first byte of that node.
function onTreeClick(node: TreeNode) {
  const el = document.querySelector(`.hex-byte[data-pos="${node.start}"]`)
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
</script>

<template>
  <div class="grid grid-rows-[auto_1fr] h-full min-h-0">
    <AppHeader
      :version="version"
      :view="view"
      :wasm-loading="wasm.state.loading"
      :wasm-ready="wasm.state.ready"
      :wasm-error="wasm.state.error"
      :can-parse="canParse"
      @update:version="(v) => (version = v)"
      @update:view="(v) => (view = v)"
      @parse="runParse"
      @sample="onSample"
      @clear="onClear"
    />

    <main
      v-if="view === 'split'"
      class="grid min-h-0"
      style="
        grid-template-columns: minmax(340px, 1fr) minmax(420px, 1.2fr) minmax(360px, 1fr);
      "
    >
      <InputPane
        v-model="inputText"
        :status="status"
        :wasm-ready="canParse"
        @parse="runParse"
        @load-history="onLoadHistory"
      />

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
          Hex view
        </h2>
        <div class="flex-1 min-h-0 overflow-auto px-3 py-2">
          <HexView
            :bytes="bytes"
            :highlight="hoverRange"
            @hover-pos="onHexHover"
            @click-pos="onHexClick"
          />
        </div>
      </section>

      <ParseTree
        :root="tree"
        :highlight-id="hoverNodeId"
        @hover-node="onTreeHover"
        @click-node="onTreeClick"
      />
    </main>

    <main
      v-else
      class="grid min-h-0"
      style="grid-template-columns: minmax(340px, 1fr) minmax(640px, 2fr);"
    >
      <InputPane
        v-model="inputText"
        :status="status"
        :wasm-ready="canParse"
        @parse="runParse"
        @load-history="onLoadHistory"
      />
      <FieldBreakdown :bytes="bytes" :root="tree" />
    </main>
  </div>
</template>
