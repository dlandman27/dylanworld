import PartySocket from 'partysocket'
import { equippedId } from './cursor'

// Phase-1 presence networking. Connects only when a room code is in the URL,
// broadcasts this cursor at <=20Hz, and keeps an interpolation-ready peer map.
// Peers are ghosts: nothing here touches physics or games.

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
let lastSend = 0
let lastX = 0
let lastY = 0

function connect(code: string): void {
  room = code
  // party: 'table' = the kebab-cased Durable Object binding name ("Table")
  socket = new PartySocket({ host: HOST, room: code, party: 'table' })
  socket.addEventListener('message', (e: MessageEvent) => {
    let m: { t?: string; id?: string; x?: number; y?: number; cur?: string; name?: string }
    try { m = JSON.parse(e.data as string) } catch { return }
    if (!m.id) return
    if (m.t === 'leave') { peerMap.delete(m.id); return }
    if (m.t === 'c' && typeof m.x === 'number' && typeof m.y === 'number') {
      const existing = peerMap.get(m.id)
      if (existing) {
        existing.tx = m.x
        existing.ty = m.y
        existing.cur = m.cur ?? existing.cur
        existing.name = m.name ?? existing.name
        existing.lastSeen = performance.now()
      } else {
        peerMap.set(m.id, {
          id: m.id, name: m.name ?? 'someone', cur: m.cur ?? 'arrow-ink',
          x: m.x, y: m.y, tx: m.x, ty: m.y, lastSeen: performance.now(),
        })
      }
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
  if (!socket) return
  const now = performance.now()
  if (now - lastSend < 50) return
  if (Math.hypot(x - lastX, y - lastY) < 2 && now - lastSend < 500) return
  lastSend = now
  lastX = x
  lastY = y
  socket.send(JSON.stringify({ t: 'c', x, y, cur: equippedId(), name }))
}

/** Live peer map; prune anyone silent for 30s before returning. */
export function peers(): Map<string, Peer> {
  const now = performance.now()
  for (const [id, p] of peerMap) {
    if (now - p.lastSeen > 30_000) peerMap.delete(id)
  }
  return peerMap
}
