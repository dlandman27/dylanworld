import { theme } from '../../config/theme'
import { eastWallP } from '../walls'
import { squeak } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A dry-erase whiteboard mounted flat on the EAST wall (a little wink for someone
// who works at Chalkboard — a *white*board). It lies on the wall parallelogram,
// foreshortened by the fold, with an aluminium frame, a marker tray that juts out
// toward the room, and markers + an eraser resting on it. TAP the board to wipe
// it — an eraser sweeps across with a squeak and the next hand-drawn slide
// appears (to-do list → doodles → flowchart).

interface Vec { x: number; y: number }
const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l } }

const TC = 0.2, SC = 0.5         // wall position (upper east wall, above the picture)
const HW = 250, HH = 168         // board half-size (world units)
const FR = 18                    // frame thickness
const IW = HW - FR - 10, IH = HH - FR - 10   // inner (writable) half-size
const N_SLIDES = 3
const MARKER = { blue: '#2f6fb0', red: '#e0503e', green: '#3a9d5a', ink: '#37332c' }

export function createWhiteboard(): TableGame {
  // Ride the EAST-wall plane so it foreshortens WITH the fold (wall-3d-depth): ax
  // runs along the wall, ux up it. Content maps x→ax, y→-ux — the same frame the
  // career gallery hangs its art on, so it reads mounted and faces into the room.
  const c = eastWallP(TC, SC)
  const ax = norm({ x: eastWallP(TC + 0.004, SC).x - eastWallP(TC - 0.004, SC).x, y: eastWallP(TC + 0.004, SC).y - eastWallP(TC - 0.004, SC).y })
  const ux = norm({ x: eastWallP(TC, SC + 0.006).x - eastWallP(TC, SC - 0.006).x, y: eastWallP(TC, SC + 0.006).y - eastWallP(TC, SC - 0.006).y })
  const Wc = (lx: number, ly: number): Vec => ({ x: c.x + ax.x * lx - ux.x * ly, y: c.y + ax.y * lx - ux.y * ly })

  let slide = 0, prev = 0, wipe = 0, switched = true

  const inQuad = (px: number, py: number, q: Vec[]): boolean => {
    let sign = 0
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4]
      const cr = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
      if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false }
    }
    return true
  }

  return {
    id: 'whiteboard',
    onDown(x, y) {
      const q = [Wc(-HW, -HH), Wc(HW, -HH), Wc(HW, HH), Wc(-HW, HH)]
      if (!inQuad(x, y, q)) return false
      if (wipe <= 0) { prev = slide; slide = (slide + 1) % N_SLIDES; wipe = 1; switched = false; squeak() }
      return true
    },
    onMove() {}, onUp() {},
    update(dt) {
      if (wipe > 0) { wipe = Math.max(0, wipe - dt * 1.35); if (!switched && wipe < 0.5) switched = true }
    },
    draw(g: Ctx) {
      g.save()
      g.transform(ax.x, ax.y, -ux.x, -ux.y, c.x, c.y)   // onto the wall plane (foreshortened)
      g.lineJoin = 'round'; g.lineCap = 'round'

      // cast shadow on the wall (offset down-right in screen space)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      rr(g, -HW + 20, -HH - 20, HW * 2, HH * 2, 16); g.fill()
      // frame THICKNESS slab peeking behind the face → the board stands off the wall
      g.fillStyle = '#9298a0'; rr(g, -HW + 7, -HH + 8, HW * 2, HH * 2, 14); g.fill()
      // aluminium frame
      g.fillStyle = '#cdd2d7'; rr(g, -HW, -HH, HW * 2, HH * 2, 14); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; rr(g, -HW + 4, -HH + 4, HW * 2 - 8, HH * 2 - 8, 10); g.stroke()
      // white writing surface (slightly recessed)
      g.fillStyle = '#fbfcfd'; rr(g, -HW + FR, -HH + FR, (HW - FR) * 2, (HH - FR) * 2, 8); g.fill()
      g.lineWidth = 2; g.strokeStyle = 'rgba(32,26,23,0.28)'; g.stroke()
      // faint sheen streak
      g.fillStyle = 'rgba(90,160,219,0.07)'
      g.beginPath(); g.moveTo(-HW + FR + 20, -HH + FR); g.lineTo(-HW + FR + 90, -HH + FR); g.lineTo(-HW + FR + 30, HH - FR); g.lineTo(-HW + FR, HH - FR); g.closePath(); g.fill()

      // ---- the writing, clipped to the surface, mid-wipe reveals the next slide ----
      g.save(); rr(g, -IW, -IH, IW * 2, IH * 2, 6); g.clip()
      if (wipe > 0) {
        const p = 1 - wipe, ex = -IW + p * IW * 2
        g.save(); g.beginPath(); g.rect(-IW, -IH, ex + IW, IH * 2); g.clip(); drawSlide(g, slide); g.restore()   // rewritten (left)
        g.save(); g.beginPath(); g.rect(ex, -IH, IW - ex, IH * 2); g.clip(); drawSlide(g, prev); g.restore()      // still there (right)
        // eraser smear + the eraser block sweeping across
        g.fillStyle = 'rgba(210,225,240,0.6)'; g.fillRect(ex - 6, -IH, 30, IH * 2)
        drawEraser(g, ex + 6, 0, true)
      } else {
        drawSlide(g, slide)
      }
      g.restore()

      // ---- marker tray jutting out along the bottom, with pens + eraser ----
      const ty = HH - 2
      g.fillStyle = '#aeb4ba'; rr(g, -HW + 20, ty, HW * 2 - 40, 26, 6); g.fill()     // front fascia (shaded)
      g.fillStyle = '#e2e6ea'; rr(g, -HW + 20, ty - 8, HW * 2 - 40, 12, 5); g.fill() // lit top face (the ledge)
      g.lineWidth = 2.5; g.strokeStyle = INK; rr(g, -HW + 20, ty - 8, HW * 2 - 40, 34, 6); g.stroke()
      drawMarker(g, -120, ty - 2, MARKER.blue)
      drawMarker(g, -40, ty - 2, MARKER.red)
      drawMarker(g, 40, ty - 2, MARKER.green)
      if (wipe <= 0) drawEraser(g, 150, ty + 2, false)   // eraser rests here unless it's mid-wipe

      g.restore()
    },
  }
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function drawMarker(g: Ctx, x: number, y: number, col: string): void {
  g.save(); g.translate(x, y); g.rotate(-0.08)
  g.fillStyle = '#eceef0'; rr(g, -26, -7, 44, 14, 5); g.fill()      // barrel
  g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = col; rr(g, 14, -7, 14, 14, 4); g.fill(); g.stroke() // cap
  g.restore()
}

function drawEraser(g: Ctx, x: number, y: number, lifted: boolean): void {
  g.save(); g.translate(x, y); g.rotate(lifted ? -0.15 : 0)
  g.fillStyle = 'rgba(32,26,23,0.18)'; rr(g, -20 + 2, -12 + 3, 40, 22, 4); g.fill()
  g.fillStyle = '#3a4756'; rr(g, -20, -12, 40, 22, 4); g.fill()     // felt body
  g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
  g.fillStyle = '#e9ecef'; rr(g, -20, -12, 40, 9, 4); g.fill(); g.stroke()  // grip top
  g.restore()
}

// each slide draws marker strokes in board-local coords (origin centre, x right,
// y down, writable area is [-IW, IW] × [-IH, IH]).
function drawSlide(g: Ctx, idx: number): void {
  g.lineJoin = 'round'; g.lineCap = 'round'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'
  const head = (txt: string, col: string): void => {
    g.fillStyle = col; g.font = `900 40px "Arial Black", ${theme.fonts.display}, sans-serif`
    g.fillText(txt, -IW + 22, -IH + 44)
    g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(-IW + 20, -IH + 58); g.lineTo(-IW + 20 + txt.length * 22, -IH + 58); g.stroke()
  }
  if (idx === 0) {
    head('TO-DO', MARKER.blue)
    const items: [string, boolean][] = [['ship the plinko', true], ['a whiteboard??', true], ['nap on beanbag', false]]
    g.font = `700 26px ${theme.fonts.display}, sans-serif`
    items.forEach(([txt, done], i) => {
      const yy = -IH + 100 + i * 46
      g.strokeStyle = MARKER.ink; g.lineWidth = 3; g.strokeRect(-IW + 26, yy - 20, 26, 26)
      if (done) { g.strokeStyle = MARKER.green; g.lineWidth = 4; g.beginPath(); g.moveTo(-IW + 30, yy - 8); g.lineTo(-IW + 38, yy); g.lineTo(-IW + 52, yy - 20); g.stroke() }
      g.fillStyle = MARKER.ink; g.fillText(txt, -IW + 66, yy)
      if (done) { g.strokeStyle = MARKER.ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-IW + 62, yy - 8); g.lineTo(-IW + 66 + txt.length * 13, yy - 8); g.stroke() }
    })
    star(g, IW - 46, -IH + 46, 22, MARKER.red)
  } else if (idx === 1) {
    head('IDEAS!', MARKER.red)
    // a doodled rocket
    g.save(); g.translate(-40, 30); g.rotate(-0.5)
    g.strokeStyle = MARKER.blue; g.lineWidth = 4; g.fillStyle = 'rgba(47,111,176,0.12)'
    g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(22, -20, 22, 16, 14, 36); g.lineTo(-14, 36); g.bezierCurveTo(-22, 16, -22, -20, 0, -46); g.closePath(); g.fill(); g.stroke()
    g.beginPath(); g.arc(0, -8, 8, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = MARKER.red; g.beginPath(); g.moveTo(-14, 30); g.lineTo(-26, 50); g.moveTo(14, 30); g.lineTo(26, 50); g.stroke()
    g.strokeStyle = '#f7a83c'; g.lineWidth = 5; g.beginPath(); g.moveTo(-8, 40); g.lineTo(0, 66); g.lineTo(8, 40); g.stroke()
    g.restore()
    // planet + orbit + sparkles
    g.strokeStyle = MARKER.green; g.lineWidth = 4; g.beginPath(); g.arc(70, 20, 30, 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.ellipse(70, 20, 46, 16, -0.5, 0, Math.PI * 2); g.stroke()
    for (const [sx, sy] of [[30, -30], [120, 60], [-110, 70]]) star(g, sx, sy, 12, MARKER.blue)
  } else {
    head('SHIP IT', MARKER.green)
    const box = (x: number, txt: string, col: string): void => {
      g.strokeStyle = col; g.lineWidth = 4; g.strokeRect(x - 44, 6, 88, 52)
      g.fillStyle = col; g.font = `800 22px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(txt, x, 32)
      g.textAlign = 'left'
    }
    box(-118, 'code', MARKER.blue); box(0, 'test', MARKER.red); box(118, 'SHIP', MARKER.green)
    g.strokeStyle = MARKER.ink; g.lineWidth = 3.5
    for (const ax0 of [-74, 44]) { g.beginPath(); g.moveTo(ax0, 32); g.lineTo(ax0 + 30, 32); g.lineTo(ax0 + 22, 26); g.moveTo(ax0 + 30, 32); g.lineTo(ax0 + 22, 38); g.stroke() }
    g.fillStyle = 'rgba(47,111,176,0.7)'; g.font = `700 16px ${theme.fonts.display}, sans-serif`
    g.fillText('chalkboard.io', -IW + 24, IH - 16)
  }
}

function star(g: Ctx, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col; g.beginPath()
  for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.44 : r; const a = -Math.PI / 2 + (i * Math.PI) / 5; i ? g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : g.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) }
  g.closePath(); g.fill()
}
