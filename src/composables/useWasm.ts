import { reactive } from 'vue'
import type { ProtocolVersion, SessionJSON } from '../types'

type WasmState = {
  ready: boolean
  loading: boolean
  error: string | null
}

// Shared across every caller so the runtime only boots once.
const state = reactive<WasmState>({
  ready: false,
  loading: true,
  error: null,
})

let bootPromise: Promise<void> | null = null

async function bootOnce(): Promise<void> {
  if (bootPromise) return bootPromise
  bootPromise = (async () => {
    state.loading = true
    state.error = null
    try {
      if (typeof (globalThis as { Go?: unknown }).Go === 'undefined') {
        throw new Error('wasm_exec.js failed to load')
      }
      const go = new Go()
      const url = `${import.meta.env.BASE_URL}main.wasm`
      const resp = await fetch(url)
      if (!resp.ok) {
        throw new Error(`fetch main.wasm: ${resp.status} ${resp.statusText}`)
      }
      let instance: WebAssembly.Instance
      if (typeof WebAssembly.instantiateStreaming === 'function') {
        ;({ instance } = await WebAssembly.instantiateStreaming(
          resp,
          go.importObject,
        ))
      } else {
        const buf = await resp.arrayBuffer()
        ;({ instance } = await WebAssembly.instantiate(buf, go.importObject))
      }
      go.run(instance)
      state.ready = true
    } catch (e) {
      state.error = e instanceof Error ? e.message : String(e)
      state.ready = false
    } finally {
      state.loading = false
    }
  })()
  return bootPromise
}

export function useWasm() {
  function parse(
    bytes: Uint8Array,
    version: ProtocolVersion,
  ): SessionJSON {
    if (!state.ready) throw new Error('WASM parser is not ready yet')
    const fn = window.doParsing
    if (typeof fn !== 'function') {
      throw new Error('doParsing() is not exported from main.wasm')
    }
    const raw = fn(bytes, version)
    if (raw == null) {
      throw new Error(
        'WASM parser returned null (likely a parse error — see devtools console)',
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error(
        `WASM returned non-JSON: ${String(raw).slice(0, 120)}`,
      )
    }
    // Accept either `{success,data,error}` envelopes or the raw Session JSON.
    const env = parsed as { success?: boolean; error?: string; data?: unknown }
    if (env && env.success === false && env.error) {
      throw new Error(env.error)
    }
    return (env && env.data ? env.data : parsed) as SessionJSON
  }

  return { state, boot: bootOnce, parse }
}
