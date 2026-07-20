import { theme } from '../../config/theme'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// Shuffleboard: grab a puck and fling it up the board toward the scoring zones.
// Pucks glide with low friction, bounce softly off the rails, and knock each
// other around (yes, you can knock your opponent's puck out of the 10).

interface Puck { x: number; y: number; vx: number; vy: number; red: boolean }

const BW = 320   // board width
const BH = 1240  // board length
const PR = 24    // puck radius

export function createShuffleboard(cx: number, cy: number): TableGame {
  const left = cx - BW / 2, top = cy - BH / 2
  const pucks: Puck[] = []
  for (let i = 0; i < 8; i++) {
    pucks.push({
      x: cx - 90 + (i % 4) * 60,
      y: top + BH - 70 - Math.floor(i / 4) * 58,
      vx: 0, vy: 0, red: i % 2 === 0,
    })
  }
  let held: Puck | null = null
  let target = { x: 0, y: 0 }

  const zones: [number, string][] = [[0.14, '10'], [0.26, '8'], [0.38, '7']]

  return {
    id: 'shuffleboard',
    onDown(x, y) {
      if (x < left - 20 || x > left + BW + 20 || y < top - 20 || y > top + BH + 20) return false
      for (const p of pucks) {
        if (Math.hypot(p.x - x, p.y - y) < PR + 12) { held = p; target = { x, y }; return true }
      }
      return true // on the board: capture so the table doesn't pan mid-aim
    },
    onMove(x, y) { if (held) target = { x, y } },
    onUp() { held = null },
    update(dt) {
      if (held) {
        held.vx = (target.x - held.x) * 14
        held.vy = (target.y - held.y) * 14
      }
      const f = Math.exp(-0.55 * dt) // long glide — it's a waxed board
      for (const p of pucks) {
        p.vx *= f; p.vy *= f
        p.x += p.vx * dt; p.y += p.vy * dt
        // soft rails
        if (p.x < left + PR) { p.x = left + PR; p.vx *= -0.45 }
        if (p.x > left + BW - PR) { p.x = left + BW - PR; p.vx *= -0.45 }
        if (p.y < top + PR) { p.y = top + PR; p.vy *= -0.45 }
        if (p.y > top + BH - PR) { p.y = top + BH - PR; p.vy *= -0.45 }
      }
      // puck-puck collisions
      for (let i = 0; i < pucks.length; i++) for (let j = i + 1; j < pucks.length; j++) {
        const a = pucks[i], b = pucks[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d === 0 || d >= PR * 2) continue
        const nx = dx / d, ny = dy / d, push = (PR * 2 - d) / 2
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rel < 0) {
          a.vx += nx * rel * 0.8; a.vy += ny * rel * 0.8
          b.vx -= nx * rel * 0.8; b.vy -= ny * rel * 0.8
        }
      }
    },
    draw(g: Ctx) {
      // board
      g.fillStyle = 'rgba(32,26,23,0.18)'
      roundRect(g, left + 8, top + 12, BW, BH, 18); g.fill()
      g.fillStyle = '#e8cf9e'
      roundRect(g, left, top, BW, BH, 18); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      // lane sheen
      g.fillStyle = 'rgba(255,255,255,0.16)'
      g.fillRect(left + 20, top + 16, 36, BH - 32)
      // scoring zones
      g.textAlign = 'center'; g.textBaseline = 'middle'
      let prev = top
      for (const [frac, label] of zones) {
        const yy = top + BH * frac
        g.strokeStyle = INK; g.lineWidth = 2.5
        g.beginPath(); g.moveTo(left + 8, yy); g.lineTo(left + BW - 8, yy); g.stroke()
        g.fillStyle = 'rgba(32,26,23,0.55)'
        g.font = `800 34px ${theme.fonts.display}, sans-serif`
        g.fillText(label, cx, (prev + yy) / 2)
        prev = yy
      }
      // foul line near the bottom
      const foul = top + BH * 0.72
      g.setLineDash([10, 10])
      g.beginPath(); g.moveTo(left + 8, foul); g.lineTo(left + BW - 8, foul); g.stroke()
      g.setLineDash([])
      // pucks
      for (const p of pucks) {
        g.fillStyle = 'rgba(32,26,23,0.25)'
        g.beginPath(); g.ellipse(p.x + 3, p.y + 5, PR, PR * 0.85, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = p.red ? theme.colors.coral : theme.colors.sky
        g.beginPath(); g.arc(p.x, p.y, PR, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        g.beginPath(); g.arc(p.x, p.y, PR * 0.55, 0, Math.PI * 2); g.stroke()
      }
    },
  }
}
