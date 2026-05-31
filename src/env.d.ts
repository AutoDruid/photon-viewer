/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare global {
  // Provided by public/wasm_exec.js (Go WebAssembly glue).
  class Go {
    importObject: WebAssembly.Imports
    run(instance: WebAssembly.Instance): void
  }
  interface Window {
    // Exported by src/parser/main.go -> public/main.wasm
    doParsing?: (bytes: Uint8Array, version: 'v16' | 'v18') => string | null
  }
}
export {}
