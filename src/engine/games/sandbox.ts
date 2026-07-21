import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A wooden dig box. Drag across the sand to scoop it away; whatever's buried
// underneath surfaces as you clear it (a coin, a gem, an old key, a shell, a
// little bone). Press the wooden frame to smooth it all over and re-bury a
// fresh set — the whole point is the reveal, so it resets for another dig.

const PW = 560       // outer box width
const PH = 380       // outer box height
const FR = 26        // wooden frame thickness
const CELL = 22      // target dig-grid cell size
const BRUSH = 40     // dig radius in world px

const SAND = '#e8cd92'
const HOLE = '#bd9750'      // damp sand at the bottom of a scoop
const WOOD = '#7a4e28'
const WOOD_HI = '#9c6a38'

type Kind = 'coin' | 'gem' | 'key' | 'shell' | 'bone'
const KINDS: Kind[] = ['coin', 'gem', 'key', 'shell', 'bone']
interface Buried { x: number; y: number; kind: Kind; tilt: number; found: boolean; pop: number }
interface Grain { x: number; y: number; vx: number; vy: number; life: number }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function createSandbox(cx: number, cy: number): TableGame {
  // outer box + inner sand rect
  const ox = cx - PW / 2, oy = cy - PH / 2
  const sx = ox + FR, sy = oy + FR, sw = PW - FR * 2, sh = PH - FR * 2
  const cols = Math.round(sw / CELL), rows = Math.round(sh / CELL)
  const cw = sw / cols, ch = sh / rows
  const depth = new Float32Array(cols * rows) // 1 = full sand, 0 = scooped clean

  const grains: Grain[] = []
  const treasures: Buried[] = []
  let grab = false
  let last: { x: number; y: number } | null = null
  const cur = { x: cx, y: cy }

  const inSand = (x: number, y: number): boolean => x >= sx && x <= sx + sw && y >= sy && y <= sy + sh
  const inBox = (x: number, y: number): boolean => x >= ox && x <= ox + PW && y >= oy && y <= oy + PH

  const cellOf = (x: number, y: number): number => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor((x - sx) / cw)))
    const r = Math.min(rows - 1, Math.max(0, Math.floor((y - sy) / ch)))
    return r * cols + c
  }
  const depthAt = (x: number, y: number): number => depth[cellOf(x, y)]

  function bury(): void {
    depth.fill(1)
    treasures.length = 0
    for (let i = 0; i < 4; i++) {
      // keep treasures off the very edge, and a bit apart
      let x = 0, y = 0, tries = 0
      do {
        x = sx + cw + Math.random() * (sw - cw * 2)
        y = sy + ch + Math.random() * (sh - ch * 2)
        tries++
      } while (tries < 20 && treasures.some(t => Math.hypot(t.x - x, t.y - y) < 120))
      treasures.push({
        x, y,
        kind: KINDS[(Math.random() * KINDS.length) | 0],
        tilt: (Math.random() - 0.5) * 0.5,
        found: false, pop: 0,
      })
    }
    // a poof of sand as it smooths over
    for (let i = 0; i < 26; i++) spawnGrain(cx + (Math.random() - 0.5) * sw, cy + (Math.random() - 0.5) * sh)
  }

  function spawnGrain(x: number, y: number): void {
    if (grains.length > 140) return
    grains.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 160, life: 0.4 + Math.random() * 0.3 })
  }

  function scoop(x: number, y: number): void {
    let removed = false
    const c0 = Math.max(0, Math.floor((x - BRUSH - sx) / cw))
    const c1 = Math.min(cols - 1, Math.floor((x + BRUSH - sx) / cw))
    const r0 = Math.max(0, Math.floor((y - BRUSH - sy) / ch))
    const r1 = Math.min(rows - 1, Math.floor((y + BRUSH - sy) / ch))
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = sx + (c + 0.5) * cw - x, dy = sy + (r + 0.5) * ch - y
        const d = Math.hypot(dx, dy)
        if (d > BRUSH) continue
        const i = r * cols + c
        const before = depth[i]
        depth[i] = Math.max(0, depth[i] - (1 - d / BRUSH) * 0.16)
        if (before - depth[i] > 0.001) removed = true
      }
    }
    if (removed) {
      if (Math.random() < 0.6) spawnGrain(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30)
      clunk(0.12) // soft scrape (rate-limited in audio.ts)
    }
  }

  bury()

  return {
    id: 'sandbox',
    onDown(x, y) {
      if (!inBox(x, y)) return false
      if (inSand(x, y)) {
        grab = true
        last = { x, y }
        cur.x = x; cur.y = y
        scoop(x, y)
      } else {
        bury() // pressed the frame — smooth over and re-hide
      }
      return true // capture any press on the box so the table doesn't pan
    },
    onMove(x, y) {
      if (!grab) return
      cur.x = x; cur.y = y
      const p = last ?? { x, y }
      const dist = Math.hypot(x - p.x, y - p.y)
      const steps = Math.max(1, Math.ceil(dist / 8))
      for (let s = 1; s <= steps; s++) {
        scoop(p.x + (x - p.x) * (s / steps), p.y + (y - p.y) * (s / steps))
      }
      last = { x, y }
    },
    onUp() { grab = false; last = null },
    update(dt) {
      // grains arc up and fall back into the sand
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i]
        g.vy += 1500 * dt
        g.x += g.vx * dt; g.y += g.vy * dt
        g.life -= dt
        if (g.life <= 0) grains.splice(i, 1)
      }
      // treasures emerge with the sand cleared over them; pop once uncovered
      for (const t of treasures) {
        const vis = clamp01((0.85 - depthAt(t.x, t.y)) / 0.6)
        if (!t.found && vis >= 0.95) {
          t.found = true; t.pop = 1
          clunk(0.5)
          for (let i = 0; i < 12; i++) spawnGrain(t.x + (Math.random() - 0.5) * 40, t.y - 10)
        }
        if (t.pop > 0) t.pop = Math.max(0, t.pop - dt * 1.6)
      }
    },
    draw(g: Ctx) {
      // hard offset shadow under the whole box
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, ox + 7, oy + 11, PW, PH, 20); g.fill()

      // wooden frame
      roundRect(g, ox, oy, PW, PH, 20); g.fillStyle = WOOD; g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // plank highlight along the top rail
      g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2
      g.beginPath(); g.moveTo(ox + 14, oy + 7); g.lineTo(ox + PW - 14, oy + 7); g.stroke()

      // sand bed
      roundRect(g, sx, sy, sw, sh, 8); g.fillStyle = SAND; g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()

      g.save()
      roundRect(g, sx, sy, sw, sh, 8); g.clip()

      // faint raked ripples on the undug surface
      g.strokeStyle = 'rgba(180,150,95,0.5)'; g.lineWidth = 2
      for (let k = 0; k < 4; k++) {
        const ly = sy + (k + 0.7) * (sh / 5)
        g.beginPath(); g.moveTo(sx, ly)
        for (let x = sx; x <= sx + sw; x += 26) g.lineTo(x, ly + Math.sin((x + k * 40) / 34) * 4)
        g.stroke()
      }

      // scooped holes — overlapping circles read as a continuous excavation
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const d = depth[r * cols + c]
          if (d >= 0.985) continue
          const cxp = sx + (c + 0.5) * cw, cyp = sy + (r + 0.5) * ch
          g.globalAlpha = (1 - d) * 0.9
          g.fillStyle = HOLE
          g.beginPath(); g.arc(cxp, cyp, cw * 0.85 * (1 - d) + 2, 0, Math.PI * 2); g.fill()
        }
      }
      g.globalAlpha = 1

      // buried things, fading in as the sand clears over them
      for (const t of treasures) {
        const vis = clamp01((0.85 - depthAt(t.x, t.y)) / 0.6)
        if (vis <= 0.01) continue
        g.save()
        g.globalAlpha = Math.min(1, vis + 0.15)
        g.translate(t.x, t.y - t.pop * 8)
        g.scale(0.55 + 0.45 * vis + t.pop * 0.12, 0.55 + 0.45 * vis + t.pop * 0.12)
        g.rotate(t.tilt)
        drawTreasure(g, t.kind)
        g.restore()
      }

      // sand grains mid-air
      g.fillStyle = '#d9bd80'
      for (const gr of grains) {
        g.globalAlpha = Math.min(1, gr.life * 3)
        g.beginPath(); g.arc(gr.x, gr.y, 2.4, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
      g.restore()

      // corner bolts on the frame
      g.fillStyle = WOOD_HI
      for (const [bx, by] of [[ox + 13, oy + 13], [ox + PW - 13, oy + 13], [ox + 13, oy + PH - 13], [ox + PW - 13, oy + PH - 13]]) {
        g.beginPath(); g.arc(bx, by, 5, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      }

      // sparkles on freshly uncovered treasure
      for (const t of treasures) {
        if (t.pop <= 0) continue
        g.globalAlpha = t.pop
        g.strokeStyle = '#fff7d8'; g.lineWidth = 2.5; g.lineCap = 'round'
        for (let s = 0; s < 5; s++) {
          const a = s * ((Math.PI * 2) / 5) - t.pop * 3
          const rr = 22 + (1 - t.pop) * 18
          g.beginPath()
          g.moveTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr)
          g.lineTo(t.x + Math.cos(a) * (rr + 7), t.y + Math.sin(a) * (rr + 7))
          g.stroke()
        }
        g.globalAlpha = 1
      }

      // the trowel follows the cursor while digging
      if (grab) drawTrowel(g, cur.x, cur.y)
    },
  }
}

// ---- treasures (flat, ink-outlined, top-down; drawn centered at 0,0) --------
function drawTreasure(g: Ctx, kind: Kind): void {
  g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round'
  // shared soft contact shadow
  g.fillStyle = 'rgba(32,26,23,0.18)'
  g.beginPath(); g.ellipse(2, 4, 17, 12, 0, 0, Math.PI * 2); g.fill()
  if (kind === 'coin') {
    g.fillStyle = '#f7c948'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill(); g.stroke()
    g.fillStyle = '#e0a92a'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill()
    g.lineWidth = 1.6; g.stroke()
  } else if (kind === 'gem') {
    g.fillStyle = '#f0563e'
    g.beginPath(); g.moveTo(0, -15); g.lineTo(14, -3); g.lineTo(0, 16); g.lineTo(-14, -3); g.closePath(); g.fill(); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.4)'
    g.beginPath(); g.moveTo(0, -15); g.lineTo(6, -4); g.lineTo(0, 3); g.lineTo(-6, -4); g.closePath(); g.fill()
  } else if (kind === 'key') {
    g.fillStyle = '#f7c948'
    g.beginPath(); g.arc(-7, 0, 8, 0, Math.PI * 2); g.fill(); g.stroke()
    g.fillStyle = '#efe0b8'; g.beginPath(); g.arc(-7, 0, 3.5, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f7c948'
    g.beginPath(); roundRectP(g, 1, -3, 16, 6, 2); g.fill(); g.stroke()
    g.beginPath(); roundRectP(g, 12, -3, 4, 9, 1.5); g.fill(); g.stroke()
  } else if (kind === 'shell') {
    g.fillStyle = '#ff7fa5'
    g.beginPath(); g.arc(0, 4, 15, Math.PI, 0); g.closePath(); g.fill(); g.stroke()
    g.lineWidth = 1.6
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.moveTo(0, 4); g.lineTo(i * 6, 4 - 14 + Math.abs(i) * 1.5); g.stroke()
    }
  } else { // bone
    g.fillStyle = '#f5ecd6'
    g.beginPath(); roundRectP(g, -9, -3.5, 18, 7, 3.5); g.fill(); g.stroke()
    for (const sxk of [-9, 9]) {
      g.beginPath(); g.arc(sxk, -4, 4.5, 0, Math.PI * 2); g.fill(); g.stroke()
      g.beginPath(); g.arc(sxk, 4, 4.5, 0, Math.PI * 2); g.fill(); g.stroke()
    }
  }
}

function drawTrowel(g: Ctx, x: number, y: number): void {
  g.save()
  g.translate(x, y)
  g.rotate(-0.5)
  // hard shadow
  g.fillStyle = 'rgba(32,26,23,0.22)'
  g.beginPath(); g.moveTo(3, 16); g.lineTo(-11, 22); g.lineTo(3, 50); g.closePath(); g.fill()
  // steel scoop
  g.fillStyle = '#cfd3d6'
  g.beginPath(); g.moveTo(0, 12); g.lineTo(-14, 18); g.lineTo(0, 46); g.lineTo(14, 18); g.closePath()
  g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
  // wooden handle
  g.fillStyle = WOOD
  g.beginPath(); roundRectP(g, -5, -20, 10, 34, 5); g.fill(); g.stroke()
  g.restore()
}

function roundRectP(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
