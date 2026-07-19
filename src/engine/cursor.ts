import { CURSORS, faceImg, anyPaint, GOLD } from '../config/cursors'
import type { CursorDef } from '../config/cursors'
import { theme } from '../config/theme'

// ---- ownership + wallet (the shop spends against this; prices are 0 for now) ----
const OWNED_KEY = 'dw-cursors-owned'
const EQUIP_KEY = 'dw-cursor-equipped'
const COINS_KEY = 'dw-coins'
const INK = theme.colors.ink

interface Wallet { owned: Set<string>; equipped: string; coins: number }

function load(): Wallet {
  let owned = new Set<string>(['arrow-ink'])
  let equipped = 'arrow-ink'
  let coins = 0
  try {
    const o = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')
    if (Array.isArray(o)) owned = new Set<string>(['arrow-ink', ...o])
    equipped = localStorage.getItem(EQUIP_KEY) || equipped
    coins = parseInt(localStorage.getItem(COINS_KEY) || '0', 10) || 0
  } catch { /* fresh visitor */ }
  return { owned, equipped, coins }
}
const wallet = load()
function save(): void {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...wallet.owned]))
    localStorage.setItem(EQUIP_KEY, wallet.equipped)
    localStorage.setItem(COINS_KEY, String(wallet.coins))
  } catch { /* private mode */ }
}

const byId = (id: string): CursorDef | undefined => CURSORS.find(k => k.id === id)
const listeners: Array<() => void> = []
export function onCursorChange(fn: () => void): void { listeners.push(fn) }
const emit = (): void => listeners.forEach(fn => fn())

export function getWallet(): Wallet { return wallet }
export function isOwned(id: string): boolean { return wallet.owned.has(id) }
export function equippedId(): string { return wallet.equipped }

/** Try to buy (if needed) and equip a cursor. Returns false if too poor. */
export function buyEquip(id: string): boolean {
  const cur = byId(id)
  if (!cur) return false
  if (!wallet.owned.has(id)) {
    if (wallet.coins < cur.price) return false
    wallet.coins -= cur.price
    wallet.owned.add(id)
  }
  wallet.equipped = id
  applyCursor(cur)
  save()
  emit()
  return true
}

// ---- render a cursor sticker to a data URL and apply it as the CSS cursor ----
const urlCache: Record<string, string> = {}
export function cursorUrl(cur: CursorDef, size = 32): string {
  const key = cur.id + '@' + size
  if (!urlCache[key]) {
    const cv = document.createElement('canvas')
    cv.width = size; cv.height = size
    const g = cv.getContext('2d')!
    g.scale(size / 32, size / 32)
    cur.draw(g)
    const url = cv.toDataURL('image/png')
    if (cur.id === 'dylan' && !faceImg.complete) return url // don't cache before portrait loads
    urlCache[key] = url
  }
  return urlCache[key]
}

let styleEl: HTMLStyleElement | null = null
function applyCursor(cur: CursorDef): void {
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'dw-cursor-style'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent =
    `html, body, #game, .dw-shop, .dw-shop * { cursor: url("${cursorUrl(cur)}") ${cur.hot[0]} ${cur.hot[1]}, auto !important; }`
}
faceImg.addEventListener('load', () => {
  for (const k of Object.keys(urlCache)) if (k.startsWith('dylan@')) delete urlCache[k]
  const cur = byId(wallet.equipped)
  if (cur && cur.id === 'dylan') applyCursor(cur)
  emit()
})

// ---- fx overlay: a fixed canvas of typed particles above the world ----
interface Particle {
  kind: 'dot' | 'star' | 'ring' | 'face'
  x: number; y: number; vx: number; vy: number; g: number
  life: number; decay: number
  r: number; rot: number; vrot: number; color: string
}
const parts: Particle[] = []
let fxCanvas: HTMLCanvasElement | null = null
let fxCtx: CanvasRenderingContext2D | null = null
let raf = 0
const jit = (n: number): number => (Math.random() - 0.5) * n

function ensureFx(): void {
  if (!fxCanvas) {
    fxCanvas = document.createElement('canvas')
    fxCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;'
    document.body.appendChild(fxCanvas)
    fxCtx = fxCanvas.getContext('2d')
    const size = (): void => { fxCanvas!.width = window.innerWidth; fxCanvas!.height = window.innerHeight }
    size(); window.addEventListener('resize', size)
  }
  if (!raf) raf = requestAnimationFrame(loop)
}
function push(p: Particle): void {
  parts.push(p)
  if (parts.length > 400) parts.splice(0, parts.length - 400)
  ensureFx()
}

function drawStar(g: CanvasRenderingContext2D, p: Particle, a: number): void {
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? p.r : p.r * 0.42
    const ang = -Math.PI / 2 + (Math.PI * i) / 5
    i === 0 ? g.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr)
  }
  g.closePath()
  g.globalAlpha = a; g.fillStyle = p.color; g.fill()
  g.lineWidth = Math.max(1.2, p.r * 0.22); g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke()
  g.restore()
}

function loop(): void {
  raf = 0
  const g = fxCtx!
  g.clearRect(0, 0, fxCanvas!.width, fxCanvas!.height)
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life -= p.decay
    if (p.life <= 0) { parts.splice(i, 1); continue }
    p.vy += p.g
    p.x += p.vx; p.y += p.vy; p.rot += p.vrot
    const a = Math.min(1, p.life)
    if (p.kind === 'dot') {
      const dr = p.r * (0.4 + a * 0.6)
      g.globalAlpha = a; g.beginPath(); g.arc(p.x, p.y, dr, 0, Math.PI * 2)
      g.fillStyle = p.color; g.fill()
      if (dr > 1.6) { g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke() }
    } else if (p.kind === 'ring') {
      g.globalAlpha = a; g.lineWidth = 3; g.strokeStyle = p.color
      g.beginPath(); g.arc(p.x, p.y, p.r * (1.4 - a), 0, Math.PI * 2); g.stroke()
    } else if (p.kind === 'star') {
      drawStar(g, p, a)
    } else if (p.kind === 'face') {
      g.globalAlpha = a; g.imageSmoothingEnabled = false
      if (faceImg.complete && faceImg.naturalWidth) g.drawImage(faceImg, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
    }
  }
  g.globalAlpha = 1
  if (parts.length) raf = requestAnimationFrame(loop)
}

function emitTrail(cur: CursorDef, x: number, y: number): void {
  const col = cur.fx.color || anyPaint()
  if (cur.fx.trail === 'comet') {
    push({ kind: 'dot', x: x + jit(4), y: y + jit(4), vx: jit(0.6), vy: jit(0.6), g: 0, life: 1, decay: 0.04, r: 3.2, rot: 0, vrot: 0, color: col })
  } else if (cur.fx.trail === 'stars') {
    push({ kind: 'star', x, y, vx: jit(0.8), vy: jit(0.8) - 0.3, g: 0, life: 1, decay: 0.03, r: 6, rot: Math.random() * 6, vrot: jit(0.3), color: col })
  } else if (cur.fx.trail === 'drips') {
    push({ kind: 'dot', x: x + jit(3), y, vx: jit(0.4), vy: 0.5 + Math.random(), g: 0.06, life: 1, decay: 0.02, r: 3.5, rot: 0, vrot: 0, color: anyPaint() })
  }
}

function fireClick(cur: CursorDef, x: number, y: number): void {
  const col = cur.fx.color || anyPaint()
  switch (cur.fx.click) {
    case 'confetti':
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5
        push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.18, life: 1, decay: 0.02, r: 3.5, rot: 0, vrot: 0, color: cur.fx.color ? col : anyPaint() })
      }
      break
    case 'nova':
      push({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, life: 1, decay: 0.035, r: 26, rot: 0, vrot: 0, color: col })
      push({ kind: 'star', x, y, vx: 0, vy: 0, g: 0, life: 1, decay: 0.03, r: 13, rot: 0, vrot: 0.2, color: col })
      break
    case 'paint':
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * Math.PI * 2, sp = Math.random() * 4
        push({ kind: 'dot', x: x + jit(6), y: y + jit(6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 1.3, decay: 0.012, r: 4 + Math.random() * 5, rot: 0, vrot: 0, color: anyPaint() })
      }
      break
    case 'facePop':
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4
        push({ kind: 'face', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.15, life: 1, decay: 0.02, r: 11, rot: 0, vrot: 0, color: GOLD })
      }
      break
  }
}

/** Start the cursor system: apply the equipped cursor and wire trails/clicks. */
export function initCursors(): void {
  const cur = byId(wallet.equipped) || CURSORS[0]
  wallet.equipped = cur.id
  wallet.owned.add(cur.id)
  applyCursor(cur)

  let acc = 0
  let lx = 0, ly = 0, has = false
  window.addEventListener('pointermove', (e) => {
    const active = byId(wallet.equipped)
    if (!active || active.fx.trail === 'none') { lx = e.clientX; ly = e.clientY; has = true; return }
    if (has) acc += Math.hypot(e.clientX - lx, e.clientY - ly)
    lx = e.clientX; ly = e.clientY; has = true
    if (acc >= active.fx.every) { acc = 0; emitTrail(active, e.clientX, e.clientY) }
  })
  window.addEventListener('pointerdown', (e) => {
    const active = byId(wallet.equipped)
    if (active) fireClick(active, e.clientX, e.clientY)
  })
}
