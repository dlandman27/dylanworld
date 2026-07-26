import { theme } from '../../config/theme'
import { spark } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A kid's play teepee filling the upper-middle floor. A big soft canvas cone with
// candy stripes, crossed poles + a fluttering pennant. TAP it and the door flaps
// peel open to reveal a cozy dark inside — a warm glow and two blinking eyes
// peeking out. Tap again to close.

const H = 330            // apex height above the base
const BW = 205           // base half-width
const CANVAS = '#f3ead1', CANVAS_D = '#e3d6b0'

export function createTent(cx: number, cy: number): TableGame {
  let open = 0, openT = 0     // 0 closed → 1 open
  let blink = 0, blinkClock = 2.4

  const A = { x: 0, y: -H }                       // apex (local)
  const DA = { x: 0, y: -H * 0.5 }                // doorway apex

  return {
    id: 'tent',
    onDown(x, y) {
      // hit-test the tent triangle in local space
      const lx = x - cx, ly = y - cy
      const inside = ly < 4 && ly > -H && Math.abs(lx) < BW * (1 + ly / H) + 6
      if (!inside) return false
      openT = openT > 0.5 ? 0 : 1
      spark(cx, cy - H * 0.4, 0.14)
      return true
    },
    onMove() {}, onUp() {},
    update(dt) {
      open += (openT - open) * Math.min(1, dt * 6)
      blinkClock -= dt
      if (blinkClock <= 0) { blink = 1; blinkClock = 2 + Math.random() * 3 }
      blink = Math.max(0, blink - dt * 7)
    },
    draw(g: Ctx, t) {
      g.save(); g.translate(cx, cy)
      g.lineJoin = 'round'; g.lineCap = 'round'

      // cast shadow
      g.fillStyle = 'rgba(32,26,23,0.2)'
      g.beginPath(); g.ellipse(14, 6, BW * 1.05, 42, 0, 0, Math.PI * 2); g.fill()

      // ---- canvas cone body ----
      const tri = (): void => { g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(-BW, 0); g.lineTo(BW, 0); g.closePath() }
      tri(); g.fillStyle = CANVAS; g.fill()
      // candy stripes, clipped to the cone
      g.save(); tri(); g.clip()
      const bands = [[theme.colors.coral, -0.72], [theme.colors.teal, -0.4], ['#f7c948', -0.12]]
      for (const [col, fy] of bands as [string, number][]) {
        const yy = H * fy
        g.fillStyle = col; g.fillRect(-BW, yy - 22, BW * 2, 30)
      }
      // shade the right half for form
      g.fillStyle = 'rgba(32,26,23,0.12)'; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(BW, 0); g.lineTo(0, 0); g.closePath(); g.fill()
      g.restore()
      tri(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      // centre seam
      g.strokeStyle = 'rgba(32,26,23,0.25)'; g.lineWidth = 2.5
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(0, 0); g.stroke()

      // ---- doorway: dark inside + glow + eyes (revealed as flaps open) ----
      g.save()
      g.beginPath(); g.moveTo(DA.x, DA.y); g.lineTo(-BW * 0.4, 2); g.lineTo(BW * 0.4, 2); g.closePath(); g.clip()
      g.fillStyle = '#241f2e'; g.fillRect(-BW, -H, BW * 2, H + 10)
      if (open > 0.15) {
        const gl = g.createRadialGradient(0, -30, 4, 0, -30, 120)
        gl.addColorStop(0, `rgba(255,196,110,${0.5 * open})`); gl.addColorStop(1, 'rgba(255,196,110,0)')
        g.fillStyle = gl; g.fillRect(-BW, -H, BW * 2, H + 10)
        // two peeking eyes
        const ey = -46, eb = 1 - blink
        g.fillStyle = '#fdfdf7'
        for (const ex of [-26, 26]) { g.beginPath(); g.ellipse(ex, ey, 13, 15 * eb, 0, 0, Math.PI * 2); g.fill() }
        g.fillStyle = INK
        for (const ex of [-26, 26]) { g.beginPath(); g.ellipse(ex, ey + 2, 6, 7 * eb, 0, 0, Math.PI * 2); g.fill() }
      }
      g.restore()

      // ---- the two door flaps, peeling outward as it opens ----
      for (const side of [-1, 1]) {
        g.save(); g.translate(DA.x, DA.y); g.rotate(side * open * 0.7)
        g.beginPath(); g.moveTo(0, 0); g.lineTo(side * BW * 0.42, H * 0.5 + 2); g.lineTo(0, H * 0.5 + 2); g.closePath()
        g.fillStyle = side < 0 ? CANVAS : CANVAS_D; g.fill()
        g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
        g.restore()
      }

      // ---- crossed poles + pennant ----
      g.strokeStyle = '#9a7747'; g.lineWidth = 7
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(-30, -H - 44); g.moveTo(A.x, A.y); g.lineTo(30, -H - 44); g.stroke()
      g.lineWidth = 2.5; g.strokeStyle = INK
      g.beginPath(); g.moveTo(A.x, A.y - 2); g.lineTo(-30, -H - 44); g.moveTo(A.x, A.y - 2); g.lineTo(30, -H - 44); g.stroke()
      // pennant flag flutters on the left pole tip
      const fw = 1 + Math.sin(t / 180) * 0.18
      g.save(); g.translate(-30, -H - 42)
      g.fillStyle = theme.colors.coral
      g.beginPath(); g.moveTo(0, 0); g.lineTo(46 * fw, 10); g.lineTo(0, 22); g.closePath(); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.restore()

      g.restore()
    },
  }
}
