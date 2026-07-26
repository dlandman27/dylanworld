import PartySocket from 'partysocket'
import { equippedId } from './cursor'
import type { Prop } from '../types'

// Phase-1 presence + prop-snapshot networking. Connects only when a room code
// is in the URL; guests broadcast cursor (≤20Hz) and host broadcasts prop
// snapshots (≤20Hz, keyframe every 1.5s). Keeps interpolation-ready peer map
// and per-prop snapshot targets.

export interface Peer {
  id: string
  name: string
  cur: string
  x: number      // rendered (interpolated) world position
  y: number
  tx: number     // latest network target
  ty: number
  lastSeen: number
}

export interface SnapTarget {
  x: number; y: number; rot: number
  texx: number; texy: number
  grabbed: boolean
}

const HOST =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'localhost:1999'
    : 'dylanworld-party.dylan-944.workers.dev' // Cloudflare Worker (partyserver)

const ADJ = ['lucky', 'coral', 'wobbly', 'shiny', 'sneaky', 'golden', 'dizzy', 'tiny', 'brave', 'noisy']
const NOUN = ['marble', 'die', 'pawn', 'domino', 'top', 'coin', 'chip', 'block', 'duck', 'card']

const name = `${ADJ[(Math.random() * ADJ.length) | 0]} ${NOUN[(Math.random() * NOUN.length) | 0]}`
const peerMap = new Map<string, Peer>()
let socket: PartySocket | null = null
let room: string | null = null
let host = false
let lastSend = 0
let lastX = 0
let lastY = 0
let lastSnap = 0
let lastKey = 0
const remoteMap = new Map<number, SnapTarget>()

function upsertPeerCursor(id: string, x: number, y: number, cur?: string, name?: string): void {
  const existing = peerMap.get(id)
  if (existing) {
    existing.tx = x
    existing.ty = y
    existing.cur = cur ?? existing.cur
    existing.name = name ?? existing.name
    existing.lastSeen = performance.now()
  } else {
    peerMap.set(id, {
      id, name: name ?? 'someone', cur: cur ?? 'arrow-ink',
      x, y, tx: x, ty: y, lastSeen: performance.now(),
    })
  }
}

function connect(code: string): void {
  room = code
  host = false
  // party: 'table' = the kebab-cased Durable Object binding name ("Table")
  socket = new PartySocket({ host: HOST, room: code, party: 'table' })
  socket.addEventListener('message', (e: MessageEvent) => {
    let m: { t?: string; id?: string; x?: number; y?: number; cur?: string; name?: string; isHost?: boolean; p?: number[][]; cx?: number; cy?: number }
    try { m = JSON.parse(e.data as string) } catch { return }
    if (m.t === 'role') { host = !!m.isHost; return }
    if (!m.id) return
    if (m.t === 'leave') { peerMap.delete(m.id); return }
    if (m.t === 'c' && typeof m.x === 'number' && typeof m.y === 'number') {
      upsertPeerCursor(m.id, m.x, m.y, m.cur, m.name)
      return
    }
    if ((m.t === 'snap' || m.t === 'key') && Array.isArray(m.p)) {
      for (const row of m.p) {
        remoteMap.set(row[0], {
          x: row[1], y: row[2], rot: row[3],
          texx: row[4], texy: row[5], grabbed: row[6] === 1,
        })
      }
      // the host's own cursor rides the snapshot → keep its ghost cursor alive
      if (typeof m.cx === 'number' && typeof m.cy === 'number') {
        upsertPeerCursor(m.id, m.cx, m.cy, m.cur, m.name)
      }
      return
    }
  })
}

export function initNet(): void {
  const code = new URLSearchParams(location.search).get('room')
  if (code) {
    const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
    if (sanitized) connect(sanitized)
  }
}

export function netConnected(): boolean {
  return socket !== null
}

export function isHost(): boolean {
  return host
}

export function roomCode(): string | null {
  return room
}

export function myName(): string {
  return name
}

export function hostRoom(): string {
  const code = Array.from({ length: 4 }, () =>
    'ABCDEFGHJKMNPQRSTVWXYZ23456789'[(Math.random() * 30) | 0]).join('')
  const url = new URL(location.href)
  url.searchParams.set('room', code)
  history.pushState(null, '', url)
  connect(code)
  return code
}

/** Call every frame with the cursor's world position; throttles itself. */
export function sendCursor(x: number, y: number): void {
  if (!socket || host) return   // host cursor rides prop snapshots instead
  const now = performance.now()
  if (now - lastSend < 50) return
  if (Math.hypot(x - lastX, y - lastY) < 2 && now - lastSend < 500) return
  lastSend = now
  lastX = x
  lastY = y
  socket.send(JSON.stringify({ t: 'c', x, y, cur: equippedId(), name }))
}

/** Latest decoded per-prop network targets (guest side). */
export function remoteTargets(): Map<number, SnapTarget> {
  return remoteMap
}

/** Host-only: broadcast prop state. 20 Hz delta of awake/grabbed props, with a
 *  full keyframe of every prop every 1.5s so late joiners converge. The host's
 *  own cursor rides along, so the host does not also send a 'c' message. */
export function broadcastProps(props: Prop[], cx: number, cy: number): void {
  if (!socket || !host) return
  const now = performance.now()
  if (now - lastSnap < 50) return
  lastSnap = now
  const full = now - lastKey > 1500
  if (full) lastKey = now
  const rows: number[][] = []
  for (const p of props) {
    if (!full && p.sleeping && !p.grabbed) continue
    rows.push([
      p.id,
      Math.round(p.pos.x), Math.round(p.pos.y),
      Math.round(p.rotation * 100) / 100,
      Math.round(p.tex.x * 10) / 10, Math.round(p.tex.y * 10) / 10,
      p.grabbed ? 1 : 0,
    ])
  }
  if (!full && rows.length === 0) return
  socket.send(JSON.stringify({
    t: full ? 'key' : 'snap', p: rows,
    cx: Math.round(cx), cy: Math.round(cy), cur: equippedId(), name,
  }))
}

/** Live peer map; prune anyone silent for 30s before returning. */
export function peers(): Map<string, Peer> {
  const now = performance.now()
  for (const [id, p] of peerMap) {
    if (now - p.lastSeen > 30_000) peerMap.delete(id)
  }
  return peerMap
}
