import type {
  CommandJSON,
  ProtocolVersion,
  SessionJSON,
  TreeKind,
  TreeNode,
} from '../types'
import {
  cmdName,
  formatValue,
  hex2,
  hex8,
  paramTypeName,
  relName,
} from './labels'

// Node IDs — bumped for every call to `buildTreeFromSession`.
let NODE_ID = 0

function node(
  label: string,
  start: number,
  end: number,
  kind: TreeKind = '',
  extra: string = '',
): TreeNode {
  return { id: ++NODE_ID, label, start, end, kind, extra, children: [] }
}

/** Walks the JSON returned by the Go parser and produces a displayable tree.
 *  Top-level byte ranges are reconstructed from each command's `length` field;
 *  nested parameter byte offsets aren't reported by the parser so those rows
 *  share the enclosing reliable-payload span.
 */
export function buildTreeFromSession(
  sess: SessionJSON,
  totalBytes: number,
  version: ProtocolVersion,
): TreeNode {
  NODE_ID = 0
  const root = node('Photon packet', 0, totalBytes, '', `${totalBytes} bytes`)

  const headerEnd = Math.min(12, totalBytes)
  const sessHeader = node('Session header', 0, headerEnd, 'session', '12 bytes')
  sessHeader.children.push(
    node(`PeerID: ${sess.peer_id}`, 0, 2, 'session'),
    node(`CRCEnabled: ${sess.crc_enabled}`, 2, 3, 'session'),
    node(`CommandCount: ${sess.command_count}`, 3, 4, 'session'),
    node(
      `Timestamp: ${sess.timestamp} (${hex8(sess.timestamp)})`,
      4, 8, 'session',
    ),
    node(
      `Challenge: ${sess.challenge} (${hex8(sess.challenge)})`,
      8, 12, 'session',
    ),
  )
  root.children.push(sessHeader)

  let cursor = headerEnd
  const cmds = sess.Commands ?? sess.commands ?? []
  cmds.forEach((cmd, idx) => {
    const start = cursor
    const length = Number(cmd.length || 0)
    const end = Math.min(totalBytes, start + Math.max(length, 12))
    root.children.push(buildCommandNode(cmd, idx, start, end, version))
    cursor = end
  })

  if (cursor < totalBytes) {
    root.children.push(
      node(`Trailing bytes (${totalBytes - cursor})`, cursor, totalBytes, 'raw'),
    )
  }
  return root
}

function buildCommandNode(
  cmd: CommandJSON,
  idx: number,
  start: number,
  end: number,
  version: ProtocolVersion,
): TreeNode {
  const type = Number(cmd.type)
  const name = cmdName(type)
  const kind: TreeKind =
    type === 0x01 ? 'ack' : type === 0x05 ? 'ping' : 'cmd'
  const seq = Number(cmd.reliable_sequence_number)
  const length = Number(cmd.length)

  const n = node(
    `Command #${idx}: ${name}  (seq=${seq}, length=${length})`,
    start, end, kind,
  )

  const hdrEnd = Math.min(end, start + 12)
  const hdr = node('Command header', start, hdrEnd, kind, '12 bytes')
  hdr.children.push(
    node(`Type: ${hex2(type)} (${name})`, start, start + 1, kind),
    node(`ChannelID: ${cmd.channel_id}`, start + 1, start + 2, kind),
    node(`Flags: ${hex2(cmd.flags)}`, start + 2, start + 3, kind),
    node(`ReservedByte: ${cmd.reserved_byte}`, start + 3, start + 4, kind),
    node(`Length: ${length}`, start + 4, start + 8, kind),
    node(`ReliableSequenceNumber: ${seq}`, start + 8, start + 12, kind),
  )
  n.children.push(hdr)

  const payload = cmd.payload as Record<string, unknown> | null | undefined
  const payStart = hdrEnd
  const payEnd = end
  if (payload == null) {
    if (payEnd > payStart) {
      n.children.push(
        node(
          `Payload (empty, ${payEnd - payStart} bytes reserved)`,
          payStart, payEnd, 'raw',
        ),
      )
    }
    return n
  }

  if (type === 0x01) {
    n.children.push(buildAcknowledgeNode(payload, payStart, payEnd))
  } else if (type === 0x05) {
    n.children.push(
      node(`Ping payload (${payEnd - payStart} bytes)`, payStart, payEnd, 'ping'),
    )
  } else if (type === 0x06 || type === 0x07) {
    n.children.push(buildReliableNode(payload, payStart, payEnd, version))
  } else {
    n.children.push(renderUnknownPayload(payload, payStart, payEnd))
  }
  return n
}

function buildAcknowledgeNode(
  payload: Record<string, unknown>,
  start: number,
  end: number,
): TreeNode {
  const seq = Number(
    (payload.AckReliableSequenceNumber ??
      payload.ack_reliable_sequence_number ??
      0) as number,
  )
  const sent = Number(
    (payload.AckSentTime ?? payload.ack_sent_time ?? 0) as number,
  )
  const n = node(
    'Acknowledge payload',
    start,
    Math.min(end, start + 8),
    'ack',
    '8 bytes',
  )
  n.children.push(
    node(`AckReliableSequenceNumber: ${seq}`, start, start + 4, 'ack'),
    node(`AckSentTime: ${sent} (${hex8(sent)})`, start + 4, start + 8, 'ack'),
  )
  return n
}

function buildReliableNode(
  payload: Record<string, unknown>,
  start: number,
  end: number,
  version: ProtocolVersion,
): TreeNode {
  const sig = Number((payload.signature as number) ?? 0)
  const mtype = Number((payload.type as number) ?? 0)
  const evCode = Number((payload.event_code as number) ?? 0)
  const paramCount = Number((payload.parameter_count as number) ?? 0)
  const mname = relName(mtype)

  const hdr = node(
    `Reliable header: ${mname}  (eventCode=${evCode}, params=${paramCount})`,
    start,
    Math.min(end, start + 5),
    'rel',
  )
  hdr.children.push(
    node(`Signature: ${hex2(sig)}`, start, start + 1, 'rel'),
    node(`Type: ${hex2(mtype)} (${mname})`, start + 1, start + 2, 'rel'),
    node(`EventCode: ${evCode}`, start + 2, start + 3, 'rel'),
    node(`ParameterCount: ${paramCount}`, start + 3, start + 5, 'rel'),
  )

  const root = node('Reliable payload', start, end, 'rel')
  root.children.push(hdr)

  const params =
    ((payload.Parameters as unknown[]) ?? (payload.parameters as unknown[]) ?? []) as Array<Record<string, unknown>>
  const paramsNode = node(
    `Parameters [${params.length}]`,
    Math.min(end, start + 5),
    end,
    'param',
  )
  params.forEach((p, i) => {
    const id = Number((p.ID ?? p.id ?? 0) as number)
    const tc = Number((p.Type ?? p.type ?? 0) as number)
    const tn = paramTypeName(version, tc)
    const value = (p.Value ?? p.value) as unknown
    const pn = node(
      `Param #${i}  ID=${id}  Type=${hex2(tc)} (${tn})  =  ${formatValue(value)}`,
      paramsNode.start, paramsNode.end, 'param',
    )
    pn.children.push(
      node(`ID: ${id}`, paramsNode.start, paramsNode.end, 'param'),
      node(`Type: ${hex2(tc)} (${tn})`, paramsNode.start, paramsNode.end, 'param'),
      ...expandValueNodes(value, paramsNode.start, paramsNode.end),
    )
    paramsNode.children.push(pn)
  })
  root.children.push(paramsNode)
  return root
}

function expandValueNodes(
  value: unknown,
  start: number,
  end: number,
): TreeNode[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) =>
      node(`${k}: ${formatValue(v)}`, start, end, 'param'),
    )
  }
  if (Array.isArray(value)) {
    const out = [node(`Value: ${formatValue(value)}`, start, end, 'param')]
    if (value.length && value.length <= 32) {
      value.forEach((item, i) => {
        out.push(node(`[${i}]: ${formatValue(item)}`, start, end, 'param'))
      })
    }
    return out
  }
  return [node(`Value: ${formatValue(value)}`, start, end, 'param')]
}

function renderUnknownPayload(
  payload: Record<string, unknown>,
  start: number,
  end: number,
): TreeNode {
  if (payload && typeof payload === 'object' && 'Raw' in payload) {
    const raw = payload.Raw as unknown
    const kind = payload.Kind as number
    const rawLen = Array.isArray(raw) ? raw.length : '?'
    return node(
      `Unknown payload (kind=${cmdName(Number(kind))}, ${rawLen} bytes)`,
      start, end, 'raw',
    )
  }
  return node(`Unparsed payload (${end - start} bytes)`, start, end, 'raw')
}

/** Builds a position -> [ancestor stack] index so the hex view can report
 *  the innermost node under any byte. */
export function buildPositionIndex(
  root: TreeNode,
  bytesLen: number,
): TreeNode[][] {
  const byPos: TreeNode[][] = Array.from({ length: bytesLen }, () => [])
  const walk = (n: TreeNode) => {
    for (let i = n.start; i < n.end; i++) {
      if (i >= 0 && i < byPos.length) byPos[i].push(n)
    }
    for (const c of n.children) walk(c)
  }
  walk(root)
  return byPos
}
