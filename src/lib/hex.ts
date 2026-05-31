/**
 * Accepts Wireshark 3-column, raw hex, colon-separated, 0x-prefixed,
 * and strips ASCII columns. Throws if the result has an odd number of
 * nibbles.
 */
export function sanitizeHex(text: string): Uint8Array {
  if (!text) return new Uint8Array()
  const lines = text.split(/\r?\n/)
  let hex = ''
  for (let line of lines) {
    line = line.replace(/^\s*(0x)?[0-9a-fA-F]{4,8}[:\s]\s+/, '')
    const asciiCut = line.search(/\s{2,}[^\s0-9a-fA-F]/)
    if (asciiCut >= 0) line = line.slice(0, asciiCut)
    line = line.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '')
    hex += line
  }
  if (hex.length % 2 !== 0) {
    throw new Error(`Hex has odd number of nibbles (${hex.length})`)
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return out
}

/** Non-crypto fingerprint used to dedupe history entries. */
export function fingerprint(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5 | 0
  let h2 = 0xcbf29ce4 | 0
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193)
    h2 = Math.imul(h2 ^ bytes[bytes.length - 1 - i], 0x100000b3)
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  )
}

export function summarizeBytes(bytes: Uint8Array): string {
  const n = Math.min(6, bytes.length)
  let hex = ''
  for (let i = 0; i < n; i++) {
    hex += bytes[i].toString(16).padStart(2, '0') + (i < n - 1 ? ' ' : '')
  }
  return hex + (bytes.length > n ? '…' : '')
}
