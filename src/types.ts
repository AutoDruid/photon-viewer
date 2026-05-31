export type TreeKind =
  | 'session'
  | 'cmd'
  | 'ack'
  | 'ping'
  | 'rel'
  | 'param'
  | 'raw'
  | ''

export interface TreeNode {
  id: number
  label: string
  start: number
  end: number
  kind: TreeKind
  extra?: string
  children: TreeNode[]
}

export type ProtocolVersion = 'v16' | 'v18'

/** Top-level app layout: the classic split view (input + hex + tree) vs. a
 *  flat, groupable field-by-field debugging breakdown. */
export type ViewMode = 'split' | 'fields'

/** Matches the JSON returned by ressources/wasm/main.go -> photonparser.Session. */
export interface SessionJSON {
  peer_id: number
  crc_enabled: number
  command_count: number
  timestamp: number
  challenge: number
  /** JSON key depends on Go tag presence; we accept either casing. */
  Commands?: CommandJSON[]
  commands?: CommandJSON[]
}

export interface CommandJSON {
  type: number
  channel_id: number
  flags: number
  reserved_byte: number
  length: number
  reliable_sequence_number: number
  payload: unknown
}

export interface HistoryEntry {
  id: string
  name: string | null
  timestamp: number
  version: ProtocolVersion
  bytes: number
  preview: string
  fingerprint: string
  text: string
}
