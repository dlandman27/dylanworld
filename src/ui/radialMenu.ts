import { pop as popSound } from '../engine/audio'
import { theme } from '../config/theme'

// The secret right-click wheel — an easter egg (no on-screen hint, you find it).
// Right-click anywhere to pop a hand-drawn paper pie wheel: Emotes, Effects,
// Party, Clear. The hovered wedge lights up; the center cancels / goes back.
// Emote pops + ambient effects render on a separate fx canvas above the world.

type Ctx = CanvasRenderingContext2D
const c = theme.colors
const INK = c.ink
const CONFETTI = [c.coral, c.sky, c.lime, c.purple, c.orange, c.pink, c.teal, '#f7c948']
const rnd = (a = 1, b = 0): number => b + Math.random() * (a - b)

// ---------------------------------------------------------------------------
// fx overlay: emote pops (one-shot) + ambient effects (confetti / sparkle / bubbles)
// ---------------------------------------------------------------------------
let cv: HTMLCanvasElement | null = null
let fx: Ctx | null = null
let raf = 0
interface Pop { x: number; y: number; kind: string; life: number }
interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vrot: number; col: string; r: number; kind: string; g: number; life: number }
const pops: Pop[] = []
const bits: Bit[] = []
let effect: 'confetti' | 'sparkle' | 'bubbles' | null = null

function ensureFx(): void {
  if (!cv) {
    cv = document.createElement('canvas')
    cv.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;'
    document.body.appendChild(cv)
    fx = cv.getContext('2d')
    const size = (): void => { cv!.width = window.innerWidth; cv!.height = window.innerHeight }
    size(); window.addEventListener('resize', size)
  }
  if (!raf) raf = requestAnimationFrame(loop)
}

function spawnAmbient(W: number): void {
  const col = CONFETTI[(Math.random() * CONFETTI.length) | 0]
  if (effect === 'bubbles') bits.push({ x: rnd(W), y: window.innerHeight + 20, vx: rnd(0.6, -0.6), vy: rnd(-2.4, -1.2), rot: 0, vrot: 0, col: 'rgba(150,200,235,0.55)', r: rnd(16, 6), kind: 'bubble', g: 0, life: 1 })
  else if (effect === 'sparkle') bits.push({ x: rnd(W), y: -20, vx: rnd(0.5, -0.5), vy: rnd(2.4, 1), rot: rnd(6), vrot: rnd(0.2, -0.2), col: '#f7c948', r: rnd(9, 5), kind: 'sparkle', g: 0, life: 1 })
  else bits.push({ x: rnd(W), y: -20, vx: rnd(1.4, -1.4), vy: rnd(3.4, 1.6), rot: rnd(6), vrot: rnd(0.35, -0.35), col, r: rnd(7, 4), kind: 'confetti', g: 0.02, life: 1 })
}

function drawBit(g: Ctx, b: Bit): void {
  g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.globalAlpha = b.life
  if (b.kind === 'confetti') { g.fillStyle = b.col; g.fillRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2) }
  else if (b.kind === 'bubble') { g.strokeStyle = b.col; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.stroke() }
  else drawStar(g, b.r, b.col)
  g.restore()
}

function drawStar(g: Ctx, r: number, col: string): void {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.42
    const a = -Math.PI / 2 + (Math.PI * i) / 5
    i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke()
}

// emote art, drawn centered at the origin (~28px tall)
function drawEmote(g: Ctx, kind: string): void {
  g.lineJoin = 'round'; g.lineWidth = 2.5; g.strokeStyle = INK
  if (kind === 'heart') {
    g.fillStyle = c.coral; g.beginPath()
    g.moveTo(0, 11); g.bezierCurveTo(-17, -4, -10, -19, 0, -8); g.bezierCurveTo(10, -19, 17, -4, 0, 11); g.closePath(); g.fill(); g.stroke()
  } else if (kind === 'star') {
    drawStar(g, 15, '#f7c948')
  } else if (kind === 'party') {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, d = 8 + (i % 3) * 5; g.fillStyle = CONFETTI[i % CONFETTI.length]; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 3, 0, Math.PI * 2); g.fill() }
  } else {
    g.fillStyle = '#f7c948'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill(); g.stroke()
    g.fillStyle = INK
    if (kind === 'wow') {
      g.beginPath(); g.arc(-6, -3, 2.4, 0, Math.PI * 2); g.arc(6, -3, 2.4, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.arc(0, 6, 3.4, 0, Math.PI * 2); g.fill()
    } else {
      g.lineWidth = 2.5; g.beginPath(); g.arc(-6, -4, 3, Math.PI, Math.PI * 2); g.arc(6, -4, 3, Math.PI, Math.PI * 2); g.stroke()
      g.beginPath(); g.arc(0, 1, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.fillStyle = INK; g.fill()
    }
  }
}
function drawEmoteMini(g: Ctx, kind: string): void { g.save(); g.scale(0.9, 0.9); drawEmote(g, kind); g.restore() }
function drawEraser(g: Ctx): void {
  g.save(); g.rotate(-0.4)
  g.fillStyle = c.pink; g.strokeStyle = INK; g.lineWidth = 2.5; g.lineJoin = 'round'
  g.beginPath(); g.rect(-11, -6, 22, 12); g.fill(); g.stroke()
  g.fillStyle = '#fefaf0'; g.fillRect(-11, -6, 8, 12); g.strokeRect(-11, -6, 8, 12)
  g.restore()
}

function loop(): void {
  raf = 0
  const g = fx!, W = cv!.width, H = cv!.height
  g.clearRect(0, 0, W, H)
  if (effect) for (let i = 0; i < 3; i++) spawnAmbient(W)
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i]
    b.x += b.vx; b.y += b.vy; b.vy += b.g; b.rot += b.vrot
    if (b.y > H + 40 || b.y < -60 || b.life <= 0) { bits.splice(i, 1); continue }
    drawBit(g, b)
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]
    p.life -= 0.014
    if (p.life <= 0) { pops.splice(i, 1); continue }
    const t = 1 - p.life, s = Math.min(1.7, 0.4 + t * 5)
    g.save(); g.globalAlpha = Math.min(1, p.life * 2.2)
    g.translate(p.x, p.y - t * 80); g.scale(s, s)
    drawEmote(g, p.kind); g.restore()
  }
  g.globalAlpha = 1
  if (bits.length || pops.length || effect) raf = requestAnimationFrame(loop)
}

function popEmote(kind: string, x: number, y: number): void { pops.push({ x, y, kind, life: 1 }); ensureFx(); popSound() }
function partyBurst(x: number, y: number): void {
  for (let i = 0; i < 60; i++) { const a = rnd(Math.PI * 2), sp = rnd(11, 3); bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, rot: rnd(6), vrot: rnd(0.4, -0.4), col: CONFETTI[(Math.random() * CONFETTI.length) | 0], r: rnd(7, 4), kind: 'confetti', g: 0.22, life: 1 }) }
  ensureFx(); popSound()
}
function clearAll(): void { effect = null; bits.length = 0; pops.length = 0; window.dispatchEvent(new Event('dw-clear-doodles')) }

// ---------------------------------------------------------------------------
// the radial menu — a hand-drawn paper pie wheel on its own canvas
// ---------------------------------------------------------------------------
interface Item { label: string; draw: (g: Ctx) => void; onClick: () => void }
let mcv: HTMLCanvasElement | null = null
let mg: Ctx | null = null
let menuOpen = false
let mox = 0, moy = 0          // wheel centre (clamped on-screen)
let clickX = 0, clickY = 0    // the actual click point (where pops originate)
let hovered = -1
let level: 'main' | 'sub' = 'main'
let items: Item[] = []
const OUT = 140, INN = 54

function ensureMenu(): void {
  if (mcv) return
  mcv = document.createElement('canvas')
  mcv.style.cssText = 'position:fixed;inset:0;z-index:61;pointer-events:none;'
  document.body.appendChild(mcv)
  mg = mcv.getContext('2d')
  const size = (): void => { mcv!.width = window.innerWidth; mcv!.height = window.innerHeight }
  size(); window.addEventListener('resize', size)
  mcv.addEventListener('pointermove', (e) => { updateHover(e.clientX, e.clientY); drawMenu() })
  mcv.addEventListener('pointerdown', (e) => {
    updateHover(e.clientX, e.clientY)
    if (hovered >= 0) { items[hovered].onClick(); return }
    const dist = Math.hypot(e.clientX - mox, e.clientY - moy)
    if (dist < INN && level === 'sub') mainRing()   // centre = back
    else closeMenu()                                // centre (main) or outside = cancel
  })
}

const step = (): number => (Math.PI * 2) / items.length
const angleOf = (i: number): number => -Math.PI / 2 + i * step()

function updateHover(mx: number, my: number): void {
  const dx = mx - mox, dy = my - moy, dist = Math.hypot(dx, dy)
  if (dist < INN || dist > OUT + 24) { hovered = -1; return }
  const rel = (((Math.atan2(dy, dx) + Math.PI / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  hovered = Math.round(rel / step()) % items.length
}

function show(list: Item[], lvl: 'main' | 'sub'): void {
  items = list; level = lvl; hovered = -1; menuOpen = true
  ensureMenu(); if (mcv) mcv.style.pointerEvents = 'auto'
  drawMenu()
}
function closeMenu(): void {
  menuOpen = false; hovered = -1
  if (mcv && mg) { mcv.style.pointerEvents = 'none'; mg.clearRect(0, 0, mcv.width, mcv.height) }
}

function drawMenu(): void {
  if (!menuOpen || !mg || !mcv) return
  const g = mg, st = step()
  g.clearRect(0, 0, mcv.width, mcv.height)
  // hard offset shadow behind the whole wheel
  g.fillStyle = 'rgba(32,26,23,0.22)'
  g.beginPath(); g.arc(mox + 7, moy + 9, OUT, 0, Math.PI * 2); g.fill()
  // wedges
  const mr = (INN + OUT) / 2
  items.forEach((it, i) => {
    const a = angleOf(i)
    g.beginPath(); g.arc(mox, moy, OUT, a - st / 2, a + st / 2); g.arc(mox, moy, INN, a + st / 2, a - st / 2, true); g.closePath()
    g.fillStyle = i === hovered ? c.lime : c.card; g.fill()
    g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
    g.save(); g.translate(mox + Math.cos(a) * mr, moy + Math.sin(a) * mr - 6); g.scale(1.15, 1.15); it.draw(g); g.restore()
    g.fillStyle = INK; g.font = `800 13px ${theme.fonts.display}, sans-serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(it.label, mox + Math.cos(a) * (mr + 26), moy + Math.sin(a) * (mr + 26))
  })
  // centre hole
  g.beginPath(); g.arc(mox, moy, INN, 0, Math.PI * 2); g.fillStyle = c.paper; g.fill()
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
  g.fillStyle = INK; g.font = `800 14px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(level === 'main' ? 'close' : '‹ back', mox, moy)
}

function mainRing(): void {
  show([
    { label: 'Emotes', draw: (g) => drawEmoteMini(g, 'heart'), onClick: emoteRing },
    { label: 'Effects', draw: (g) => drawStar(g, 14, '#f7c948'), onClick: effectRing },
    { label: 'Party', draw: (g) => drawEmoteMini(g, 'party'), onClick: () => { partyBurst(clickX, clickY); closeMenu() } },
    { label: 'Clear', draw: drawEraser, onClick: () => { clearAll(); closeMenu() } },
  ], 'main')
}
function emoteRing(): void {
  show(['heart', 'laugh', 'wow', 'star', 'party'].map((k) => ({
    label: k, draw: (g: Ctx) => drawEmoteMini(g, k), onClick: () => { popEmote(k, clickX, clickY); closeMenu() },
  })), 'sub')
}
function effectRing(): void {
  show([
    { label: 'Confetti', draw: (g) => { g.fillStyle = c.coral; g.fillRect(-9, -8, 8, 5); g.fillStyle = c.sky; g.fillRect(2, -1, 8, 5); g.fillStyle = c.lime; g.fillRect(-5, 4, 8, 5) }, onClick: () => { effect = 'confetti'; ensureFx(); closeMenu() } },
    { label: 'Sparkles', draw: (g) => drawStar(g, 14, '#f7c948'), onClick: () => { effect = 'sparkle'; ensureFx(); closeMenu() } },
    { label: 'Bubbles', draw: (g) => { g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.arc(-4, 0, 8, 0, Math.PI * 2); g.arc(8, 4, 4.5, 0, Math.PI * 2); g.stroke() }, onClick: () => { effect = 'bubbles'; ensureFx(); closeMenu() } },
    { label: 'Off', draw: drawEraser, onClick: () => { effect = null; closeMenu() } },
  ], 'sub')
}

export function initRadialMenu(): void {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    clickX = e.clientX; clickY = e.clientY
    // keep the whole wheel on-screen even when right-clicking near an edge
    mox = Math.min(Math.max(e.clientX, OUT + 12), window.innerWidth - OUT - 12)
    moy = Math.min(Math.max(e.clientY, OUT + 12), window.innerHeight - OUT - 12)
    mainRing()
  })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu() })
}
