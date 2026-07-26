import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import { pointer } from '../pointer'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'
import { cabinetLayout, drawCabinet, type CabinetBook } from './wallCabinet'

// The aquarium shelf: the shared 3D bookcase (wallCabinet.ts) with a living round
// fish BOWL and a slow-morphing LAVA LAMP set back on the ledge, books below.

const TAU = Math.PI * 2
const WATER = '#6fc2cf', WATER_HI = '#9bd6dd'
const LAVA_LIQUID = '#241a3d', WAX = '#ff7038', WAX_HI = '#ffb066'
const GRAVEL = ['#c98a5a', '#b8ab90', '#d9b06a', '#9fb37e', '#c46a5a']
const FISH_COLS = [theme.colors.orange, theme.colors.coral, '#f7c948']
const BOOK_COLS = [theme.colors.sky, theme.colors.coral, theme.colors.lime, theme.colors.purple, '#f7c948', theme.colors.teal, theme.colors.orange]

function hsh(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

export function createAquariumShelf(cx: number, cy: number): TableGame {
  const L = cabinetLayout(cx, cy, 420)
  const baseY = L.itemBaseY, span = L.itemRight - L.itemLeft

  // ---- round fish bowl (left) ----
  const bowlR = 74, bowlCX = L.itemLeft + span * 0.28, bowlCY = baseY - bowlR * 0.78
  const wCX = bowlCX, wCY = bowlCY + 8, wR = bowlR - 14
  const waterY = bowlCY - bowlR * 0.62, gravelY = bowlCY + bowlR * 0.62   // filled to just below the mouth
  const chestX = bowlCX + bowlR * 0.34, chestY = gravelY + 4   // bubbling ornament

  interface Fish { x: number; y: number; vx: number; vy: number; tx: number; ty: number; col: string; sz: number; head: number; wob: number; retarget: number }
  const fish: Fish[] = Array.from({ length: 4 }, (_, i) => ({
    x: wCX + (hsh(i * 5 + 1) - 0.5) * wR, y: wCY + (hsh(i * 5 + 2) - 0.5) * wR * 0.6, vx: 0, vy: 0,
    tx: wCX, ty: wCY, col: FISH_COLS[i % FISH_COLS.length], sz: 8 + hsh(i) * 3.5, head: 0, wob: hsh(i) * TAU, retarget: 0.5 + hsh(i) * 2,
  }))
  interface Bubble { x: number; y: number; r: number; v: number }
  const bubbles: Bubble[] = []; let bubbleTimer = 0.4
  interface Flake { x: number; y: number; vy: number; ph: number }
  const flakes: Flake[] = []

  // ---- lava lamp (right) ----
  const LW = 66, LH = 166, lCX = L.itemLeft + span * 0.76
  const baseH = 30, capH = 24
  const lampBot = baseY - 6, vBot = lampBot - baseH, vTop = vBot - LH, capTop = vTop - capH, lCY = (vTop + vBot) / 2
  // wax blobs: each drifts on its own slow cycle; rendered as merging metaballs
  const blobs = [0, 1, 2, 3].map((i) => ({ ph: hsh(i + 40) * TAU, sp: 0.10 + hsh(i + 41) * 0.06, baseR: 15 + hsh(i + 43) * 9 }))
  let lavaOn = true, lavaHeat = 1   // tap toggles power; heat eases so blobs warm up / settle

  const nBooks = 8
  const books: CabinetBook[] = Array.from({ length: nBooks }, (_, i) => ({
    col: BOOK_COLS[i % BOOK_COLS.length], hh: (L.caseBot - L.caseTop - 34) * (0.7 + hsh(i + 20) * 0.26), lean: (hsh(i + 22) - 0.5) * 0.14, tip: 0,
  }))

  registerObstacleProvider(() => [
    { x: L.cx - 130, y: (cy + L.caseTop) / 2, half: 150 },
    { x: L.cx + 130, y: (cy + L.caseTop) / 2, half: 150 },
  ])

  const inFootprint = (x: number, y: number): boolean =>
    x > L.ledgeL - 12 && x < L.ledgeR + 12 && y > L.ledgeBackY - 240 && y < cy + 10

  const scatter = (px: number, py: number): void => {
    for (const f of fish) { const dx = f.x - px, dy = f.y - py, d = Math.hypot(dx, dy) || 1; f.vx += (dx / d) * 480; f.vy += (dy / d) * 480 }
    for (let k = 0; k < 5; k++) bubbles.push({ x: px + (Math.random() - 0.5) * 30, y: py, r: 2 + Math.random() * 3, v: 55 + Math.random() * 45 })
  }

  return {
    id: 'aquarium',
    onDown(x, y) {
      if (!inFootprint(x, y)) return false
      const inBowl = Math.hypot(x - bowlCX, y - bowlCY) < bowlR + 6
      if (inBowl && y < waterY + 8) { for (let k = 0; k < 6; k++) flakes.push({ x: wCX + (Math.random() - 0.5) * wR, y: waterY + 4, vy: 12 + Math.random() * 8, ph: Math.random() * TAU }); spark(x, waterY, 0.1) }
      else if (inBowl) { scatter(x, y); spark(x, y, 0.12) }
      else if (Math.hypot(x - lCX, y - lCY) < LW) { lavaOn = !lavaOn; spark(lCX, lCY, 0.12) }   // power toggle
      else if (y > L.caseTop && y < L.caseBot) { books[Math.max(0, Math.min(nBooks - 1, Math.floor(((x - L.caseL) / (L.caseR - L.caseL)) * nBooks)))].tip = 1; spark(x, y, 0.1) }
      else spark(x, y, 0.1)
      return true
    },
    onMove() {},
    onUp() {},

    update(dt, t) {
      const ts = t * 0.001
      const p = pointer()
      for (const f of fish) {
        let tx = f.tx, ty = f.ty
        if (flakes.length) { let bd = Infinity; for (const fl of flakes) { const d = (fl.x - f.x) ** 2 + (fl.y - f.y) ** 2; if (d < bd) { bd = d; tx = fl.x; ty = fl.y } } }
        else { f.retarget -= dt; if (f.retarget <= 0) { f.tx = wCX - (f.x - wCX) * (0.5 + Math.random() * 0.5); f.ty = Math.min(gravelY - 8, Math.max(waterY + 12, wCY + (hsh((t * 21 + f.wob * 40) | 0) - 0.5) * wR * 0.9)); f.retarget = 1.3 + Math.random() * 2; tx = f.tx; ty = f.ty } }   // cross to the far side (back-and-forth)
        let ax = 0, ay = 0
        const dxp = f.x - p.x, dyp = f.y - p.y, dp = Math.hypot(dxp, dyp)
        if (dp < 120) { const s = (1 - dp / 120) * 380; ax += (dxp / dp) * s; ay += (dyp / dp) * s }
        const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1
        ax += (dx / d) * 95; ay += (dy / d) * 95
        f.vx += ax * dt; f.vy += ay * dt
        const fr = Math.exp(-3.8 * dt); f.vx *= fr; f.vy *= fr
        f.x += f.vx * dt; f.y += f.vy * dt
        const dcx = f.x - wCX, dcy = (f.y - wCY) / 0.72, dc = Math.hypot(dcx, dcy)
        if (dc > wR - 6) { const k = (wR - 6) / dc; f.x = wCX + dcx * k; f.y = wCY + dcy * 0.72 * k; f.vx *= 0.4; f.vy *= 0.4 }
        if (f.y < waterY + 10) { f.y = waterY + 10; f.vy = Math.abs(f.vy) * 0.4 }
        const spd = Math.hypot(f.vx, f.vy)
        if (spd > 3) { let dh = Math.atan2(f.vy, f.vx) - f.head; while (dh > Math.PI) dh -= TAU; while (dh < -Math.PI) dh += TAU; f.head += dh * Math.min(1, dt * 6) }   // turn smoothly toward travel
        f.wob += dt * (3 + spd * 0.05)                                                                 // tail wags faster when swimming
        if (Math.random() < dt * 0.22) bubbles.push({ x: f.x + Math.cos(f.head) * f.sz, y: f.y - 2, r: 1.6 + Math.random() * 1.4, v: 15 + Math.random() * 12 })   // fish blows a bubble
      }
      for (let i = flakes.length - 1; i >= 0; i--) {
        const fl = flakes[i]; fl.vy += (24 - fl.vy) * Math.min(1, dt * 2); fl.y += fl.vy * dt; fl.x += Math.sin(ts * 3 + fl.ph) * 7 * dt
        let eaten = false; for (const f of fish) if (Math.abs(f.x - fl.x) < f.sz && Math.abs(f.y - fl.y) < f.sz) { eaten = true; break }
        if (eaten) { spark(fl.x, fl.y, 0.07); flakes.splice(i, 1) }           // a gulp
        else if (fl.y > gravelY - 4) flakes.splice(i, 1)
      }
      bubbleTimer -= dt
      if (bubbleTimer <= 0) { bubbleTimer = 0.5 + Math.random() * 0.8; bubbles.push({ x: chestX + (Math.random() - 0.5) * 10, y: chestY - 12, r: 1.6 + Math.random() * 2.2, v: 20 + Math.random() * 16 }) }   // bubbles from the chest
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= b.v * dt; b.x += Math.sin(ts * 2.4 + b.y * 0.05) * 6 * dt; if (b.y < waterY + 3) bubbles.splice(i, 1) }
      lavaHeat += ((lavaOn ? 1 : 0) - lavaHeat) * Math.min(1, dt * 0.35)   // slow warm-up / cool-down
      for (const b of books) b.tip = Math.max(0, b.tip - dt * 4)
    },

    draw(g: Ctx, t) {
      const ts = t * 0.001
      drawCabinet(g, L, books)

      // ---------- lava lamp ----------
      const neckW = LW * 0.24, bellyW = LW * 0.5, baseNeckW = LW * 0.3
      const vessel = (): void => {
        g.beginPath(); g.moveTo(lCX - baseNeckW, vBot)
        g.bezierCurveTo(lCX - bellyW - 4, vBot - LH * 0.16, lCX - bellyW, vTop + LH * 0.34, lCX - neckW, vTop)
        g.lineTo(lCX + neckW, vTop)
        g.bezierCurveTo(lCX + bellyW, vTop + LH * 0.34, lCX + bellyW + 4, vBot - LH * 0.16, lCX + baseNeckW, vBot); g.closePath()
      }
      g.fillStyle = 'rgba(32,26,23,0.2)'; g.beginPath(); g.ellipse(lCX + 6, lampBot + 2, LW * 0.62, 12, 0, 0, TAU); g.fill()
      g.fillStyle = `rgba(255,140,80,${0.05 + (0.14 + Math.sin(ts * 0.8) * 0.03) * lavaHeat})`; g.beginPath(); g.ellipse(lCX, lCY, bellyW + 16, LH * 0.5, 0, 0, TAU); g.fill()   // warm glow, dims when off
      g.fillStyle = '#c2c7cb'; g.beginPath(); g.moveTo(lCX - baseNeckW - 16, lampBot); g.lineTo(lCX + baseNeckW + 16, lampBot); g.lineTo(lCX + baseNeckW, vBot); g.lineTo(lCX - baseNeckW, vBot); g.closePath(); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = 'rgba(32,26,23,0.16)'; g.beginPath(); g.moveTo(lCX + baseNeckW * 0.2, lampBot); g.lineTo(lCX + baseNeckW + 16, lampBot); g.lineTo(lCX + baseNeckW, vBot); g.lineTo(lCX + baseNeckW * 0.2, vBot); g.closePath(); g.fill()
      vessel(); g.fillStyle = LAVA_LIQUID; g.fill()
      g.save(); vessel(); g.clip()
      g.fillStyle = `rgba(255,170,80,${0.32 * lavaHeat})`; g.beginPath(); g.ellipse(lCX, vBot - 2, bellyW * 0.72, 34, 0, 0, TAU); g.fill()   // bulb light
      g.fillStyle = `rgba(255,120,70,${0.12 * lavaHeat})`; g.beginPath(); g.ellipse(lCX, lCY + 12, bellyW * 0.98, LH * 0.44, 0, 0, TAU); g.fill()
      // molten wax as merging METABALLS, oozing up from a heated pool. Heat (0..1)
      // gates how high the blobs climb — off → they settle into the pool.
      const usable = LH - 46
      const circ: { x: number; y: number; r: number }[] = [{ x: lCX, y: vBot - 12, r: bellyW * (0.6 + 0.2 * lavaHeat) }]   // pool
      for (const bl of blobs) {
        const ph = ts * bl.sp + bl.ph
        const frac = lavaHeat * (0.06 + 0.94 * (0.5 + 0.5 * Math.sin(ph)))
        circ.push({ x: lCX + Math.sin(ts * 0.18 + bl.ph) * bellyW * 0.16 * lavaHeat, y: vBot - 18 - frac * usable, r: bl.baseR * (0.58 + 0.5 * lavaHeat) * (1 + 0.22 * Math.cos(ph * 1.3)) })
      }
      circ.sort((a, b) => a.y - b.y)   // top → bottom
      g.fillStyle = WAX
      for (let k = 0; k < circ.length - 1; k++) {   // necks bridge vertically-adjacent blobs so they read as one wax
        const a = circ[k], b = circ[k + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1
        if (d > a.r + b.r + 30) continue
        const nx = -dy / d, ny = dx / d, wa = a.r * 0.68, wb = b.r * 0.68
        g.beginPath(); g.moveTo(a.x + nx * wa, a.y + ny * wa); g.lineTo(b.x + nx * wb, b.y + ny * wb); g.lineTo(b.x - nx * wb, b.y - ny * wb); g.lineTo(a.x - nx * wa, a.y - ny * wa); g.closePath(); g.fill()
      }
      for (const c of circ) { g.beginPath(); g.ellipse(c.x, c.y, c.r, c.r * 1.06, 0, 0, TAU); g.fill() }
      for (const c of circ) {   // per-blob sheen
        g.fillStyle = WAX_HI; g.beginPath(); g.ellipse(c.x - c.r * 0.3, c.y - c.r * 0.34, c.r * 0.36, c.r * 0.22, -0.4, 0, TAU); g.fill()
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(c.x - c.r * 0.34, c.y - c.r * 0.4, c.r * 0.14, c.r * 0.08, -0.5, 0, TAU); g.fill()
      }
      g.restore()
      vessel(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(lCX - bellyW * 0.5, lCY - LH * 0.1, 5, LH * 0.28, 0.05, 0, TAU); g.fill()
      g.fillStyle = '#c2c7cb'; g.beginPath(); g.moveTo(lCX - neckW - 6, vTop); g.lineTo(lCX + neckW + 6, vTop); g.lineTo(lCX + neckW * 0.5, capTop); g.lineTo(lCX - neckW * 0.5, capTop); g.closePath(); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#c2c7cb'; g.beginPath(); g.arc(lCX, capTop - 2, 5, 0, TAU); g.fill(); g.lineWidth = 2.4; g.stroke()

      // ---------- round fish bowl ----------
      g.fillStyle = 'rgba(32,26,23,0.2)'; g.beginPath(); g.ellipse(bowlCX + 6, baseY - 6, bowlR * 0.82, 13, 0, 0, TAU); g.fill()
      g.save(); g.beginPath(); g.arc(bowlCX, bowlCY, bowlR, 0, TAU); g.clip()
      g.fillStyle = '#eaf7f9'; g.fillRect(bowlCX - bowlR, bowlCY - bowlR, bowlR * 2, bowlR * 2)
      g.fillStyle = WATER; g.fillRect(bowlCX - bowlR, waterY, bowlR * 2, bowlR * 2)
      g.fillStyle = WATER_HI; g.fillRect(bowlCX - bowlR, waterY, bowlR * 2, 12)
      // caustic light ripples drifting near the surface
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 3; g.lineCap = 'round'
      for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = -bowlR; x <= bowlR; x += 8) { const yy = waterY + 16 + i * 11 + Math.sin(ts * 0.9 + x * 0.08 + i) * 3; x === -bowlR ? g.moveTo(bowlCX + x, yy) : g.lineTo(bowlCX + x, yy) } g.stroke() }
      // gravel bed with the odd bright pebble
      for (let i = 0; i < 26; i++) { const gx = bowlCX + (hsh(i * 2 + 3) - 0.5) * bowlR * 1.5, gy = gravelY + hsh(i * 2 + 4) * 18; g.fillStyle = i % 9 === 0 ? theme.colors.coral : i % 7 === 0 ? theme.colors.sky : GRAVEL[i % GRAVEL.length]; g.beginPath(); g.ellipse(gx, gy, 5 + hsh(i) * 3, 4 + hsh(i + 1) * 2, 0, 0, TAU); g.fill() }
      // kelp — strands in two greens, waving
      for (const k of [{ x: bowlCX - bowlR * 0.52, n: 4, c: '#3f8f4f' }, { x: bowlCX - bowlR * 0.34, n: 3, c: '#5cae61' }, { x: bowlCX - bowlR * 0.16, n: 4, c: '#4f9a55' }, { x: bowlCX + bowlR * 0.64, n: 3, c: '#3f8f4f' }]) {
        g.strokeStyle = k.c; g.lineWidth = 5.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(k.x, gravelY + 8)
        for (let s = 1; s <= k.n; s++) { const yy = gravelY + 8 - s * 15, xx = k.x + Math.sin(ts * 0.7 + s * 0.7 + k.x) * 7; g.lineTo(xx, yy) }
        g.stroke()
      }
      // treasure chest (the bubbler)
      const cw = 22, chh = 13
      g.fillStyle = '#8a5a2b'; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
      roundRect(g, chestX - cw / 2, chestY - chh, cw, chh, 3); g.fill(); g.stroke()
      g.fillStyle = '#a9763f'; g.beginPath(); g.moveTo(chestX - cw / 2, chestY - chh); g.arc(chestX, chestY - chh, cw / 2, Math.PI, 0); g.closePath(); g.fill(); g.stroke()
      g.strokeStyle = '#f2c14e'; g.lineWidth = 2; g.beginPath(); g.moveTo(chestX - cw / 2 + 1, chestY - chh - 1); g.lineTo(chestX + cw / 2 - 1, chestY - chh - 1); g.stroke()
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(chestX, chestY - chh + 1, 2.2, 0, TAU); g.fill()
      // starfish on the gravel
      g.save(); g.translate(bowlCX + bowlR * 0.08, gravelY + 9); g.fillStyle = '#f0563e'; g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath()
      for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? 3 : 8, a = -Math.PI / 2 + (k * Math.PI) / 5; k ? g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.8) : g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.8) }
      g.closePath(); g.fill(); g.stroke(); g.restore()
      for (const fl of flakes) { g.fillStyle = '#b8763a'; g.beginPath(); g.arc(fl.x, fl.y, 2.4, 0, TAU); g.fill() }
      for (const f of fish) {
        const s = f.sz, wag = Math.sin(f.wob)
        g.save(); g.translate(f.x, f.y); g.rotate(f.head); if (Math.cos(f.head) < 0) g.scale(1, -1)   // point where it swims, stay upright
        g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'; g.fillStyle = f.col
        // tail fin — a fan that sweeps side to side with the wag
        g.save(); g.translate(-s * 1.05, 0); g.rotate(wag * 0.5)
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-s * 1.0, -s * 0.85, -s * 1.6, -s * 0.55); g.quadraticCurveTo(-s * 1.0, 0, -s * 1.6, s * 0.55); g.quadraticCurveTo(-s * 1.0, s * 0.85, 0, 0); g.closePath(); g.fill(); g.stroke()
        g.restore()
        // dorsal fin
        g.beginPath(); g.moveTo(s * 0.15, -s * 0.72); g.quadraticCurveTo(-s * 0.35, -s * 1.25, -s * 0.75, -s * 0.6); g.closePath(); g.fill(); g.stroke()
        // body — teardrop, yawing slightly with the wag; eye + belly sheen ride with it
        g.save(); g.rotate(wag * 0.07)
        g.beginPath(); g.ellipse(0, 0, s * 1.15, s * 0.78, 0, 0, TAU); g.fill(); g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(s * 0.05, s * 0.24, s * 0.7, s * 0.24, 0, 0, TAU); g.fill()
        g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(s * 0.66, -s * 0.2, s * 0.22, 0, TAU); g.fill(); g.stroke()
        g.fillStyle = INK; g.beginPath(); g.arc(s * 0.71, -s * 0.2, s * 0.1, 0, TAU); g.fill()
        g.restore()
        // pectoral fin, flicking on the near side
        g.fillStyle = f.col; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(s * 0.25, s * 0.32); g.quadraticCurveTo(-s * 0.15, s * 0.9 + wag * s * 0.12, -s * 0.45, s * 0.5); g.closePath(); g.fill(); g.stroke()
        g.restore()
      }
      for (const b of bubbles) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke() }
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(bowlCX - bowlR * 0.4, bowlCY - bowlR * 0.4, bowlR * 0.16, bowlR * 0.34, -0.6, 0, TAU); g.fill()
      g.restore()
      g.lineWidth = 4; g.strokeStyle = INK; g.beginPath(); g.arc(bowlCX, bowlCY, bowlR, 0, TAU); g.stroke()
      g.fillStyle = '#cfe8ec'; g.beginPath(); g.ellipse(bowlCX, bowlCY - bowlR * 0.92, bowlR * 0.42, 12, 0, 0, TAU); g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
    },
  }
}
