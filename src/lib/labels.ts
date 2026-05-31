import type { ProtocolVersion } from '../types'

export const CMD_NAMES: Record<number, string> = {
  0x01: 'Acknowledge',
  0x02: 'Connect',
  0x03: 'VerifyConnect',
  0x04: 'Disconnect',
  0x05: 'Ping',
  0x06: 'SendReliable',
  0x07: 'SendUnreliable',
  0x08: 'SendReliableFragment',
}

export const REL_MSG_TYPES: Record<number, string> = {
  0x02: 'OperationRequest',
  0x03: 'OtherOperationResponse',
  0x04: 'EventData',
  0x06: 'ExchangeKeys',
  0x07: 'OperationResponse',
}

export const V18_TYPE_NAMES: Record<number, string> = {
  0: 'Unknown', 2: 'Boolean', 3: 'Int8', 4: 'Int16', 5: 'Float32', 6: 'Float64',
  7: 'String', 8: 'Nil', 9: 'CompressedInt32', 10: 'CompressedInt64',
  11: 'Int8Positive', 12: 'Int8Negative', 13: 'Int16Positive', 14: 'Int16Negative',
  15: 'Long8Positive', 16: 'Long8Negative', 17: 'Long16Positive', 18: 'Long16Negative',
  19: 'Custom', 20: 'Dictionary', 21: 'Hashtable', 23: 'ObjectArray',
  24: 'OperationRequest', 25: 'OperationResponse', 26: 'EventData',
  27: 'BooleanFalse', 28: 'BooleanTrue',
  29: 'ShortZero', 30: 'IntZero', 31: 'LongZero',
  32: 'FloatZero', 33: 'DoubleZero', 34: 'ByteZero',
  0x40: 'Array', 0x42: 'BooleanArray', 0x43: 'ByteArray', 0x44: 'ShortArray',
  0x45: 'Float32Array', 0x46: 'Float64Array', 0x47: 'StringArray',
  0x49: 'CompressedIntArray', 0x4a: 'CompressedLongArray',
  0x53: 'CustomArray', 0x54: 'DictionaryArray', 0x55: 'HashtableArray',
  0x80: 'CustomSlim',
}

export const V16_TYPE_NAMES: Record<number, string> = {
  0x00: 'Unknown', 0x2a: 'Nil', 0x44: 'Dictionary', 0x61: 'StringArray',
  0x62: 'Int8', 0x63: 'Custom', 0x64: 'Double', 0x65: 'EventDate',
  0x66: 'Float32', 0x67: 'Float64', 0x68: 'Hashtable', 0x69: 'Int32',
  0x6b: 'Int16', 0x6c: 'Int64', 0x6e: 'Int32Array', 0x6f: 'Boolean',
  0x70: 'OperationResponse', 0x71: 'OperationRequest', 0x73: 'String',
  0x78: 'Int8Array', 0x79: 'Array', 0x7a: 'ObjectArray',
}

export function cmdName(code: number): string {
  return CMD_NAMES[code] ?? `Unknown(0x${code.toString(16).padStart(2, '0')})`
}

export function relName(code: number): string {
  return REL_MSG_TYPES[code] ?? `Unknown(0x${code.toString(16).padStart(2, '0')})`
}

export function paramTypeName(version: ProtocolVersion, code: number): string {
  const table = version === 'v18' ? V18_TYPE_NAMES : V16_TYPE_NAMES
  return table[code] ?? `Unknown(0x${code.toString(16).padStart(2, '0')})`
}

export function hex2(n: number): string {
  return `0x${(n & 0xff).toString(16).padStart(2, '0')}`
}

export function hex8(n: number): string {
  return `0x${(n >>> 0).toString(16).padStart(8, '0')}`
}

export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toPrecision(7)
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'bigint') return v.toString()
  if (Array.isArray(v)) {
    const preview = v.slice(0, 8).map(formatValue).join(', ')
    return `[${preview}${v.length > 8 ? ', …+' + (v.length - 8) : ''}]`
  }
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}
