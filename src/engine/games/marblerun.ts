import { theme } from '../../config/theme'
import { spark } from '../physics'
import { chime, fanfare } from '../audio'
import type { Prop } from '../../types'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A Plinko board standing against the east wall. Grab any marble rolling around
// the room, carry it up, and drop it anywhere along the top: the board captures
// it and runs a little gravity sim — it rattles down through a staggered grid of
// pegs (each plinks a pentatonic note), settles into a bin, and drops out the
// bottom back onto the floor as a free marble again. Several can fall at once.
//
// Drawn in ELEVATION (like the bookshelf/bed): local "down" (+ly) maps to world
// +y, so the sim's gravity just pulls marbles down-screen. The captured marble's
// world pos is set from the sim each frame, so drawProps renders the real glass
// marble bouncing down IN FRONT of the pegs (which draw behind it in draw()).

const TW = 560, TH = 1000        // board footprint (local space)
const MR = 17                    // marble radius (pebble)
const PEG_R = 11
const HIT_R = MR + PEG_R
const WALL_L = 42, WALL_R = 518  // inner side walls
const G = 1650                   // gravity (local units / s²)
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0] // C5 D5 E5 G5 A5
const POP_WORDS = ['WOOO!', 'NICE!', 'YESSS!', 'BOOM!', "LET'S GO!"]

const ROWS = 7, PY0 = 185, DY = 78, PITCH = 64
const BIN_TOP = 700, BIN_BOT = 946
const DIV = [110, 178, 246, 314, 382, 450]              // bin dividers → 7 bins
const BIN_X = [76, 144, 212, 280, 348, 416, 484]        // bin centres
const BIN_VAL = ['90', '40', '10', '5', '10', '40', '90']
const BIN_NOTE = [261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 261.63]
// bins read hot→cold by payout: gold jackpots at the edges, muted 5 in the middle
const BIN_COLOR = ['#f7c948', theme.colors.coral, theme.colors.sky, '#c7bfa8', theme.colors.sky, theme.colors.coral, '#f7c948']
const BIN_TINT = ['rgba(247,201,72,0.34)', 'rgba(240,86,62,0.20)', 'rgba(90,160,219,0.20)', 'rgba(120,110,90,0.12)', 'rgba(90,160,219,0.20)', 'rgba(240,86,62,0.20)', 'rgba(247,201,72,0.34)']
const PEG_COLOR = [theme.colors.coral, theme.colors.orange, '#f7c948', theme.colors.lime, theme.colors.teal, theme.colors.sky, theme.colors.purple]
// arcade-cabinet palette
const CABINET = '#3f7cc0', CABINET_D = '#2f5f96', TRIM = '#f7c948'
const FIELD = '#f4edd8', FIELD2 = '#e8dcbb', MARQUEE = '#243b6b'

interface Peg { x: number; y: number; note: number; row: number }
interface Flight { p: Prop; lx: number; ly: number; vx: number; vy: number }

export function createMarbleRun(cx: number, cy: number, props: Prop[]): TableGame {
  const tx = cx - TW / 2, ty = cy - TH / 2
  const wx = (lx: number): number => tx + lx
  const wy = (ly: number): number => ty + ly

  // staggered peg grid
  const pegs: Peg[] = []
  let pi = 0
  for (let r = 0; r < ROWS; r++) {
    const y = PY0 + r * DY
    const off = (r % 2) * (PITCH / 2)
    for (let x = 56 + off; x <= TW - 56; x += PITCH) {
      pegs.push({ x, y, note: PENTA[pi % PENTA.length] * (r < 4 ? 2 : 1), row: r })
      pi++
    }
  }
  const pegFlash = new Array(pegs.length).fill(0)
  const binFlash = BIN_X.map(() => 0)

  const flights: Flight[] = []
  const owned = new Set<number>()
  const pops: { x: number; y: number; age: number; life: number; text: string; val: string; jackpot: boolean }[] = []
  let clock = 0, lastPlink = -1
  let hoverBin = -1, hoverX = 0   // lane preview while a marble is held over the board

  const step = (fl: Flight, dt: number): boolean => {
    fl.vy += G * dt
    fl.lx += fl.vx * dt
    fl.ly += fl.vy * dt
    // side walls
    if (fl.lx < WALL_L + MR) { fl.lx = WALL_L + MR; fl.vx = Math.abs(fl.vx) * 0.4 }
    if (fl.lx > WALL_R - MR) { fl.lx = WALL_R - MR; fl.vx = -Math.abs(fl.vx) * 0.4 }
    // pegs
    for (let k = 0; k < pegs.length; k++) {
      const pg = pegs[k]
      const dx = fl.lx - pg.x, dy = fl.ly - pg.y
      const d = Math.hypot(dx, dy)
      if (d >= HIT_R || d === 0) continue
      const nx = dx / d, ny = dy / d
      fl.lx = pg.x + nx * HIT_R; fl.ly = pg.y + ny * HIT_R
      const along = fl.vx * nx + fl.vy * ny
      if (along < 0) { fl.vx -= 1.55 * along * nx; fl.vy -= 1.55 * along * ny }
      fl.vx += (Math.random() - 0.5) * 80    // chaos kick
      pegFlash[k] = 1
      spark(wx(fl.lx), wy(fl.ly), 0.18)
      if (clock - lastPlink > 0.045) { chime(pg.note); lastPlink = clock }
    }
    // bin dividers (thin vertical walls near the bottom)
    if (fl.ly > BIN_TOP - MR) {
      for (const dv of DIV) {
        const gap = MR + 5 - Math.abs(fl.lx - dv)
        if (gap > 0 && fl.ly < BIN_BOT) {
          const s = fl.lx >= dv ? 1 : -1
          fl.lx += s * gap; fl.vx = s * Math.abs(fl.vx) * 0.35
        }
      }
    }
    return fl.ly < BIN_BOT + 16   // false → reached the bottom, exit
  }

  return {
    id: 'marblerun',
    onDown(x, y) {
      // capture presses on the board so the table doesn't pan mid-drop
      return x > tx - 16 && x < tx + TW + 16 && y > ty - 48 && y < ty + TH + 24
    },
    onMove() {}, onUp() {},
    update(dt) {
      clock += dt
      for (let i = 0; i < pegFlash.length; i++) pegFlash[i] = Math.max(0, pegFlash[i] - dt * 4)
      for (let i = 0; i < binFlash.length; i++) binFlash[i] = Math.max(0, binFlash[i] - dt * 3)
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].age += dt; if (pops[i].age >= pops[i].life) pops.splice(i, 1) }

      // capture a marble dropped into the top drop-zone (drop anywhere across it)
      for (const p of props) {
        if (p.kind !== 'pebble' || p.grabbed || owned.has(p.id)) continue
        if (p.pos.x > tx + 46 && p.pos.x < tx + TW - 46 && p.pos.y > ty - 42 && p.pos.y < ty + 130) {
          owned.add(p.id); p.grabbed = true
          flights.push({ p, lx: Math.min(WALL_R - MR, Math.max(WALL_L + MR, p.pos.x - tx)), ly: 128, vx: (Math.random() - 0.5) * 40, vy: 40 })
          chime(392)
        }
      }

      // highlight the lane under a marble the player is holding over the board
      hoverBin = -1
      for (const p of props) {
        if (p.kind !== 'pebble' || !p.grabbed || owned.has(p.id)) continue
        if (p.pos.x > tx + 24 && p.pos.x < tx + TW - 24 && p.pos.y > ty - 80 && p.pos.y < wy(BIN_TOP)) {
          const lx = Math.min(WALL_R, Math.max(WALL_L, p.pos.x - tx))
          let b = 0; for (const dv of DIV) if (lx > dv) b++
          hoverBin = b; hoverX = p.pos.x
          break
        }
      }

      // advance each falling marble (substepped so it can't tunnel through pegs)
      for (let i = flights.length - 1; i >= 0; i--) {
        const fl = flights[i]
        let alive = true
        for (let s = 0; s < 3 && alive; s++) alive = step(fl, dt / 3)
        fl.p.pos.x = wx(fl.lx); fl.p.pos.y = wy(fl.ly)
        fl.p.vel.x = 0; fl.p.vel.y = 0; fl.p.restTime = 0; fl.p.sleeping = false
        fl.p.tex.x += fl.vx * dt * 0.5; fl.p.tex.y += fl.vy * dt * 0.5
        if (!alive) {
          // landed in a bin → flash it, then drop out the bottom onto the floor
          let bin = 0; for (const dv of DIV) if (fl.lx > dv) bin++
          binFlash[bin] = 1; spark(wx(fl.lx), wy(fl.ly), 0.3)
          const jackpot = BIN_VAL[bin] === '90'
          if (jackpot) fanfare(); else chime(BIN_NOTE[bin])
          pops.push({ x: cx, y: ty + 330, age: 0, life: jackpot ? 2.3 : 1.6, val: BIN_VAL[bin], jackpot, text: jackpot ? 'JACKPOT!' : POP_WORDS[Math.floor(Math.random() * POP_WORDS.length)] })
          fl.p.grabbed = false
          fl.p.vel.x = (fl.lx - TW / 2) * 0.7 + (Math.random() - 0.5) * 60
          fl.p.vel.y = 150
          fl.p.restTime = 0
          owned.delete(fl.p.id)
          flights.splice(i, 1)
        }
      }
    },

    // ---- BACK of the board (behind the marbles) ----
    draw(g: Ctx, t: number) {
      const fx = tx + WALL_L - 8, fy = ty + 150, fw = (WALL_R - WALL_L) + 16, fh = TH - 210
      // shadow + blue arcade cabinet with gold trim
      g.fillStyle = 'rgba(32,26,23,0.22)'; roundRect(g, tx + 12, ty + 16, TW, TH, 26); g.fill()
      g.fillStyle = CABINET; roundRect(g, tx, ty, TW, TH, 26); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.lineWidth = 3; g.strokeStyle = TRIM; roundRect(g, tx + 10, ty + 10, TW - 20, TH - 20, 20); g.stroke()
      // recessed play field with a subtle carnival sunburst
      g.save(); roundRect(g, fx, fy, fw, fh, 14); g.clip()
      g.fillStyle = FIELD; g.fillRect(fx, fy, fw, fh)
      const ax = cx, ay = ty + 128, rays = 26
      g.fillStyle = FIELD2
      for (let i = 0; i < rays; i += 2) {
        const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 1) / rays) * Math.PI * 2
        g.beginPath(); g.moveTo(ax, ay)
        g.lineTo(ax + Math.cos(a0) * 1500, ay + Math.sin(a0) * 1500)
        g.lineTo(ax + Math.cos(a1) * 1500, ay + Math.sin(a1) * 1500)
        g.closePath(); g.fill()
      }
      g.restore()
      g.lineWidth = 2.5; g.strokeStyle = INK; roundRect(g, fx, fy, fw, fh, 14); g.stroke()
      // inner side walls
      g.fillStyle = CABINET_D
      for (const wxl of [WALL_L - 12, WALL_R]) { roundRect(g, tx + wxl, fy, 12, fh, 6); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke() }

      // pegs
      for (let k = 0; k < pegs.length; k++) {
        const pg = pegs[k], X = wx(pg.x), Y = wy(pg.y)
        g.fillStyle = 'rgba(32,26,23,0.22)'; g.beginPath(); g.arc(X + 2, Y + 3, PEG_R, 0, Math.PI * 2); g.fill()
        g.fillStyle = PEG_COLOR[pg.row % PEG_COLOR.length]; g.beginPath(); g.arc(X, Y, PEG_R, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(X - 3, Y - 3.5, PEG_R * 0.32, 0, Math.PI * 2); g.fill()
      }

      // bin dividers
      for (const dv of DIV) {
        const X = wx(dv)
        g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, X - 5 + 2, wy(BIN_TOP) + 3, 10, BIN_BOT - BIN_TOP, 6); g.fill()
        g.fillStyle = theme.colors.purple; roundRect(g, X - 5, wy(BIN_TOP), 10, BIN_BOT - BIN_TOP, 6); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      }
      // bin channels tinted by payout + value plaques that pop when a marble lands
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
      for (let b = 0; b < BIN_X.length; b++) {
        const lb = b === 0 ? WALL_L : DIV[b - 1]
        const rb = b === BIN_X.length - 1 ? WALL_R : DIV[b]
        g.fillStyle = BIN_TINT[b]; g.fillRect(wx(lb) + 7, wy(BIN_TOP), wx(rb) - wx(lb) - 14, BIN_BOT - BIN_TOP)
        const jackpot = BIN_VAL[b] === '90'
        g.save(); g.translate(wx(BIN_X[b]), wy(BIN_BOT - 24)); g.scale(1 + binFlash[b] * 0.3, 1 + binFlash[b] * 0.3)
        // star crown over the jackpot bins
        if (jackpot) {
          g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5; drawStar(g, 0, -30, 11); g.fill(); g.stroke()
          g.fillStyle = '#f7c948'; drawStar(g, 0, -30, 7); g.fill()
        }
        // plaque
        g.fillStyle = BIN_COLOR[b]; roundRect(g, -27, -18, 54, 36, 9); g.fill()
        g.lineWidth = jackpot ? 3.5 : 2.5; g.strokeStyle = INK; g.stroke()
        // number
        g.font = `900 ${jackpot ? 25 : 20}px "Arial Black", ${theme.fonts.display}, sans-serif`
        if (jackpot) { g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(BIN_VAL[b], 0, 1); g.fillStyle = '#fff' } else g.fillStyle = INK
        g.fillText(BIN_VAL[b], 0, 1)
        g.restore()
      }

      // ---- lit marquee header ----
      const mqx = tx + 28, mqy = ty + 16, mqw = TW - 56, mqh = 92
      g.fillStyle = 'rgba(32,26,23,0.22)'; roundRect(g, mqx + 4, mqy + 6, mqw, mqh, 14); g.fill()
      g.fillStyle = MARQUEE; roundRect(g, mqx, mqy, mqw, mqh, 14); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      g.lineWidth = 2.5; g.strokeStyle = TRIM; roundRect(g, mqx + 8, mqy + 8, mqw - 16, mqh - 16, 9); g.stroke()
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
      g.font = `900 50px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.lineWidth = 7; g.strokeStyle = INK; g.strokeText('PLINKO', cx, mqy + 40)
      g.fillStyle = '#fff'; g.fillText('PLINKO', cx, mqy + 40)
      g.font = `900 16px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.lineWidth = 4; g.strokeStyle = INK; g.strokeText('★  DROP  &  WIN  ★', cx, mqy + 72)
      g.fillStyle = TRIM; g.fillText('★  DROP  &  WIN  ★', cx, mqy + 72)
      drawBulbs(g, mqx, mqy, mqw, mqh, 38, t)
      // drop-zone chevrons funnelling into the field
      const ry = ty + 134, span = WALL_R - WALL_L - 92
      for (let a = WALL_L + 46; a <= WALL_R - 46 + 1; a += span / 4) {
        const X = wx(a)
        g.lineCap = 'round'; g.lineJoin = 'round'
        g.strokeStyle = INK; g.lineWidth = 9; g.beginPath(); g.moveTo(X - 12, ry - 7); g.lineTo(X, ry + 7); g.lineTo(X + 12, ry - 7); g.stroke()
        g.strokeStyle = TRIM; g.lineWidth = 5; g.beginPath(); g.moveTo(X - 12, ry - 7); g.lineTo(X, ry + 7); g.lineTo(X + 12, ry - 7); g.stroke()
      }
    },

    // ---- FRONT (over the marbles): plink flashes + drop hint ----
    drawAbove(g: Ctx, t) {
      // lane preview while holding a marble over the board
      if (hoverBin >= 0) {
        const b = hoverBin
        const lb = b === 0 ? WALL_L : DIV[b - 1]
        const rb = b === BIN_X.length - 1 ? WALL_R : DIV[b]
        const x0 = wx(lb) + 4, x1 = wx(rb) - 4, fy = ty + 150
        const pulse = 0.5 + 0.5 * Math.sin(t / 140)
        g.fillStyle = `rgba(247,201,72,${0.12 + pulse * 0.08})`
        g.fillRect(x0, fy, x1 - x0, wy(BIN_BOT) - fy)
        g.fillStyle = `rgba(247,201,72,${0.34 + pulse * 0.22})`
        roundRect(g, x0, wy(BIN_TOP), x1 - x0, BIN_BOT - BIN_TOP, 6); g.fill()
        g.lineWidth = 3.5; g.strokeStyle = '#f7c948'; g.lineJoin = 'round'; g.stroke()
        // dashed drop line showing the aim point
        g.strokeStyle = 'rgba(247,201,72,0.9)'; g.lineWidth = 3; g.setLineDash([9, 7])
        g.beginPath(); g.moveTo(hoverX, fy); g.lineTo(hoverX, wy(BIN_TOP)); g.stroke(); g.setLineDash([])
      }
      for (let k = 0; k < pegs.length; k++) {
        if (pegFlash[k] <= 0) continue
        const pg = pegs[k]
        g.globalAlpha = pegFlash[k] * 0.85; g.strokeStyle = '#fff'; g.lineWidth = 3
        g.beginPath(); g.arc(wx(pg.x), wy(pg.y), PEG_R + 5 + (1 - pegFlash[k]) * 7, 0, Math.PI * 2); g.stroke()
      }
      g.globalAlpha = 1
      for (let b = 0; b < binFlash.length; b++) {
        if (binFlash[b] <= 0) continue
        g.globalAlpha = binFlash[b] * 0.6; g.fillStyle = BIN_VAL[b] === '90' ? '#f7c948' : '#fff'
        roundRect(g, wx(BIN_X[b]) - 30, wy(BIN_TOP), 60, BIN_BOT - BIN_TOP, 6); g.fill()
      }
      g.globalAlpha = 1
      // celebratory score popups
      for (const po of pops) drawPopup(g, po)
      // idle "drop a marble" hint sliding along the top when nothing's falling
      if (flights.length === 0) {
        const hx = cx, hy = ty - 30 + Math.sin(t / 320) * 6
        g.globalAlpha = 0.5 + 0.25 * Math.sin(t / 240)
        g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round'
        g.beginPath(); g.moveTo(hx - 13, hy - 8); g.lineTo(hx, hy + 8); g.lineTo(hx + 13, hy - 8); g.stroke()
        g.font = `800 15px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'
        g.fillStyle = INK; g.fillText('drop a marble in', hx, hy - 14)
        g.globalAlpha = 1
      }
    },
  }
}

// a ring of twinkling marquee bulbs around a rectangle's perimeter
function drawBulbs(g: Ctx, x: number, y: number, w: number, h: number, gap: number, t: number): void {
  const pts: [number, number][] = []
  const nx = Math.max(2, Math.round(w / gap)), ny = Math.max(1, Math.round(h / gap))
  for (let i = 0; i <= nx; i++) { const px = x + (w * i) / nx; pts.push([px, y], [px, y + h]) }
  for (let j = 1; j < ny; j++) { const py = y + (h * j) / ny; pts.push([x, py], [x + w, py]) }
  const phase = Math.floor(t / 240)
  pts.forEach((p, i) => {
    const on = (i + phase) % 2 === 0
    g.fillStyle = on ? '#ffe27a' : '#9c7d2a'
    g.beginPath(); g.arc(p[0], p[1], 5, 0, Math.PI * 2); g.fill()
    g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke()
    if (on) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(p[0] - 1.5, p[1] - 1.6, 1.8, 0, Math.PI * 2); g.fill() }
  })
}

// a 5-point star path centred at (x, y); caller fills/strokes
function drawStar(g: Ctx, x: number, y: number, r: number): void {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
}

// a big celebratory sticker that pops in, floats up, and fades out
function drawPopup(g: Ctx, po: { x: number; y: number; age: number; life: number; text: string; val: string; jackpot: boolean }): void {
  const t = po.age
  const inn = Math.min(1, t / 0.2)
  const s = 1.9                                   // easeOutBack overshoot
  const sc = 1 + (s + 1) * Math.pow(inn - 1, 3) + s * Math.pow(inn - 1, 2)
  const fade = t > po.life - 0.45 ? Math.max(0, (po.life - t) / 0.45) : 1
  g.save()
  g.translate(po.x, po.y - t * 46)
  g.globalAlpha = fade
  g.scale(sc, sc)
  // gold starburst
  g.fillStyle = po.jackpot ? '#f7c948' : 'rgba(247,201,72,0.92)'
  g.beginPath()
  const spikes = 14
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 ? 96 : 66
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2 + t * 0.5
    i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  g.closePath(); g.fill()
  g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
  // inner disc
  g.fillStyle = po.jackpot ? theme.colors.coral : theme.colors.sky
  g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.fill(); g.lineWidth = 3.5; g.stroke()
  // text
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  g.fillStyle = '#fff'; g.strokeStyle = INK
  g.font = `900 22px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.lineWidth = 4; g.strokeText(po.text, 0, -18); g.fillText(po.text, 0, -18)
  g.font = `900 44px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.lineWidth = 5.5; g.strokeText('+' + po.val, 0, 20); g.fillText('+' + po.val, 0, 20)
  g.restore()
}
