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
// each wheel wedge gets its own house colour (ordered so it doesn't clash with
// the sticker icon that sits on it)
const WEDGE = [c.sky, c.lime, c.purple, c.orange, c.pink, c.teal, c.coral, '#f7c948']
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

// the house sticker treatment: hard offset ink shadow + fill + bold ink outline
// (the same recipe the cursor stickers use, so these match the rest of the app)
function sticker(g: Ctx, body: (x: Ctx) => void, fill: string): void {
  g.save(); g.translate(2, 2.5); body(g); g.fillStyle = INK; g.fill(); g.restore()
  body(g); g.fillStyle = fill; g.lineWidth = 2.5; g.lineJoin = 'round'; g.strokeStyle = INK; g.fill(); g.stroke()
}
const circleBody = (r: number) => (x: Ctx): void => { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2) }
const starBody = (r: number) => (x: Ctx): void => {
  x.beginPath()
  for (let i = 0; i < 10; i++) { const rr = i % 2 === 0 ? r : r * 0.42; const a = -Math.PI / 2 + (Math.PI * i) / 5; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  x.closePath()
}
const heartBody = (x: Ctx): void => { x.beginPath(); x.moveTo(0, 12); x.bezierCurveTo(-17, -4, -10, -19, 0, -8); x.bezierCurveTo(10, -19, 17, -4, 0, 12); x.closePath() }
const flameBody = (x: Ctx): void => { x.beginPath(); x.moveTo(0, -16); x.bezierCurveTo(12, -6, 9, 8, 2, 13); x.bezierCurveTo(6, 3, -1, 4, -2, 11); x.bezierCurveTo(-8, 6, -7, -3, -3, -6); x.bezierCurveTo(-3, -2, 0, -2, 0, -6); x.bezierCurveTo(0, -11, -1, -13, 0, -16); x.closePath() }

// emote art as stickers, centered at the origin (~30px tall)
function drawEmote(g: Ctx, kind: string): void {
  if (kind === 'heart') {
    sticker(g, heartBody, c.coral)
  } else if (kind === 'star') {
    sticker(g, starBody(15), '#f7c948')
  } else if (kind === 'fire') {
    sticker(g, flameBody, c.orange)
    g.fillStyle = '#f7c948'; g.beginPath()
    g.moveTo(0, -5); g.bezierCurveTo(6, 0, 4, 7, 0, 11); g.bezierCurveTo(2, 5, -2, 5, -2, 10); g.bezierCurveTo(-4, 6, -3, 1, 0, -5); g.closePath(); g.fill()
  } else if (kind === 'party') {
    sticker(g, (x) => { x.beginPath(); x.moveTo(-14, 14); x.lineTo(-2, -14); x.lineTo(14, 2); x.closePath() }, c.coral)   // popper cone
    for (const [dx, dy, col] of [[2, -16, c.sky], [10, -9, c.lime], [15, -16, c.purple], [7, -20, '#f7c948']] as const) {
      g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.5
      g.beginPath(); g.arc(dx, dy, 3, 0, Math.PI * 2); g.fill(); g.stroke()
    }
  } else {   // a sticker face — laugh / wow / love / cool / cry
    sticker(g, circleBody(15), '#f7c948')
    g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineWidth = 2.5
    if (kind === 'wow') {
      g.beginPath(); g.arc(-6, -3, 2.4, 0, Math.PI * 2); g.arc(6, -3, 2.4, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.arc(0, 6, 3.6, 0, Math.PI * 2); g.fill()
    } else if (kind === 'love') {
      for (const ex of [-6, 6]) { g.fillStyle = c.coral; g.beginPath(); g.moveTo(ex, -1); g.bezierCurveTo(ex - 4, -5, ex - 2, -8, ex, -6); g.bezierCurveTo(ex + 2, -8, ex + 4, -5, ex, -1); g.closePath(); g.fill() }
      g.strokeStyle = INK; g.beginPath(); g.arc(0, 2, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
    } else if (kind === 'cool') {
      g.fillStyle = INK
      g.fillRect(-12, -6, 9, 7); g.fillRect(3, -6, 9, 7); g.fillRect(-3, -4, 6, 2)          // two lenses + bridge
      g.strokeStyle = INK; g.beginPath(); g.arc(-1, 3, 6, 0, 0.55 * Math.PI); g.stroke()    // smirk
    } else if (kind === 'cry') {
      g.fillStyle = INK; g.beginPath(); g.arc(-6, -2, 2, 0, Math.PI * 2); g.arc(6, -2, 2, 0, Math.PI * 2); g.fill()
      g.strokeStyle = INK; g.beginPath(); g.arc(0, 11, 6, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke()   // frown
      g.fillStyle = c.sky; g.beginPath(); g.moveTo(-6, 2); g.bezierCurveTo(-9, 6, -9, 10, -6, 10); g.bezierCurveTo(-3, 10, -3, 6, -6, 2); g.closePath(); g.fill()   // tear
      g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke()
    } else {   // laugh
      g.beginPath(); g.arc(-6, -4, 3, Math.PI, Math.PI * 2); g.arc(6, -4, 3, Math.PI, Math.PI * 2); g.stroke()
      g.beginPath(); g.arc(0, 1, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.fill()
    }
  }
}
function drawEmoteMini(g: Ctx, kind: string): void { g.save(); g.scale(0.9, 0.9); drawEmote(g, kind); g.restore() }
function drawEraser(g: Ctx): void {
  g.save(); g.rotate(-0.35)
  sticker(g, (x) => { x.beginPath(); x.rect(-12, -7, 24, 14) }, c.pink)
  g.fillStyle = '#fefaf0'; g.fillRect(-12, -7, 9, 14)
  g.lineWidth = 2.2; g.strokeStyle = INK; g.strokeRect(-12, -7, 9, 14)
  g.restore()
}
function drawConfettiIcon(g: Ctx): void {
  for (const [dx, dy, rot, col] of [[-9, -6, 0.3, c.coral], [1, -1, -0.4, c.sky], [-4, 6, 0.5, c.lime]] as const) {
    g.save(); g.translate(dx, dy); g.rotate(rot)
    g.fillStyle = INK; g.fillRect(-4 + 2, -3 + 2.5, 8, 6)
    g.fillStyle = col; g.fillRect(-4, -3, 8, 6); g.lineWidth = 1.6; g.strokeStyle = INK; g.strokeRect(-4, -3, 8, 6)
    g.restore()
  }
}
function drawBubblesIcon(g: Ctx): void {
  for (const [dx, dy, r] of [[-4, 1, 8], [8, 5, 5]] as const) {
    g.fillStyle = 'rgba(32,26,23,0.25)'; g.beginPath(); g.arc(dx + 2, dy + 2.5, r, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#cfe8f7'; g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill()
    g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(dx - r * 0.3, dy - r * 0.3, r * 0.25, 0, Math.PI * 2); g.fill()
  }
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
let menuScale = 1             // 0..1 pop-in on open
let mraf = 0
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
  menuScale = 0.35            // spring open
  popSound()
  if (!mraf) mraf = requestAnimationFrame(animMenu)
}
function animMenu(): void {
  mraf = 0
  if (!menuOpen) return
  menuScale += (1 - menuScale) * 0.32
  drawMenu()
  if (1 - menuScale > 0.008) mraf = requestAnimationFrame(animMenu)
  else { menuScale = 1; drawMenu() }
}
function closeMenu(): void {
  menuOpen = false; hovered = -1
  if (mcv && mg) { mcv.style.pointerEvents = 'none'; mg.clearRect(0, 0, mcv.width, mcv.height) }
}

function drawMenu(): void {
  if (!menuOpen || !mg || !mcv) return
  const g = mg, st = step()
  g.clearRect(0, 0, mcv.width, mcv.height)
  g.save()
  g.translate(mox, moy); g.scale(menuScale, menuScale); g.translate(-mox, -moy)   // pop-in
  // hard offset shadow behind the whole wheel
  g.fillStyle = 'rgba(32,26,23,0.22)'
  g.beginPath(); g.arc(mox + 7, moy + 9, OUT, 0, Math.PI * 2); g.fill()
  // wedges — each its own house colour, hovered one brightens
  const mr = (INN + OUT) / 2
  items.forEach((it, i) => {
    const a = angleOf(i)
    const path = (): void => { g.beginPath(); g.arc(mox, moy, OUT, a - st / 2, a + st / 2); g.arc(mox, moy, INN, a + st / 2, a - st / 2, true); g.closePath() }
    path(); g.fillStyle = WEDGE[i % WEDGE.length]; g.fill()
    g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
    if (i === hovered) { path(); g.fillStyle = 'rgba(255,255,255,0.34)'; g.fill(); path(); g.lineWidth = 5; g.stroke() }
    // icon above, label always BELOW it (never off to the side on L/R wedges)
    const wx = mox + Math.cos(a) * mr, wy = moy + Math.sin(a) * mr
    const hasLabel = it.label.length > 0
    g.save(); g.translate(wx, wy - (hasLabel ? 12 : 0)); g.scale(hasLabel ? 1.1 : 1.5, hasLabel ? 1.1 : 1.5); it.draw(g); g.restore()
    if (hasLabel) {
      g.font = `800 13px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
      g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(it.label, wx, wy + 18)
      g.fillStyle = '#fff'; g.fillText(it.label, wx, wy + 18)
    }
  })
  // centre hole
  g.beginPath(); g.arc(mox, moy, INN, 0, Math.PI * 2); g.fillStyle = c.paper; g.fill()
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
  g.fillStyle = INK; g.font = `800 14px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(level === 'main' ? 'close' : '‹ back', mox, moy)
  g.restore()
}

function mainRing(): void {
  show([
    { label: 'Emotes', draw: (g) => drawEmoteMini(g, 'heart'), onClick: emoteRing },
    { label: 'Effects', draw: (g) => drawEmoteMini(g, 'star'), onClick: effectRing },
    { label: 'Party', draw: (g) => drawEmoteMini(g, 'party'), onClick: () => { partyBurst(clickX, clickY); closeMenu() } },
    { label: 'Clear', draw: drawEraser, onClick: () => { clearAll(); closeMenu() } },
  ], 'main')
}
function emoteRing(): void {
  // icon-only (no names) — a fuller set of reactions
  const es = ['heart', 'laugh', 'love', 'wow', 'cool', 'cry', 'fire', 'star', 'party']
  show(es.map((k) => ({
    label: '', draw: (g: Ctx) => drawEmoteMini(g, k), onClick: () => { popEmote(k, clickX, clickY); closeMenu() },
  })), 'sub')
}
function effectRing(): void {
  show([
    { label: 'Confetti', draw: drawConfettiIcon, onClick: () => { effect = 'confetti'; ensureFx(); closeMenu() } },
    { label: 'Sparkles', draw: (g) => drawEmoteMini(g, 'star'), onClick: () => { effect = 'sparkle'; ensureFx(); closeMenu() } },
    { label: 'Bubbles', draw: drawBubblesIcon, onClick: () => { effect = 'bubbles'; ensureFx(); closeMenu() } },
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
