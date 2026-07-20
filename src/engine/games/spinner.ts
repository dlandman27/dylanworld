import { theme } from '../../config/theme'
import type { TableGame } from './shared'
import { INK } from './shared'

// A color spinner you actually flick: grab the arrow, whip it, let go, and it
// spins down with momentum until it lands on a color.

export function createSpinner(cx: number, cy: number): TableGame {
  const cols = [theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.orange, theme.colors.purple, theme.colors.pink]
  const R = 130
  let ang = -0.6
  let angVel = 0
  let grab: { lastA: number } | null = null

  const angleAt = (x: number, y: number): number => Math.atan2(y - cy, x - cx)
  const wrap = (a: number): number => {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }

  return {
    id: 'spinner',
    onDown(x, y) {
      if (Math.hypot(x - cx, y - cy) > R + 24) return false
      grab = { lastA: angleAt(x, y) }
      angVel = 0
      return true
    },
    onMove(x, y) {
      if (!grab) return
      const a = angleAt(x, y)
      const d = wrap(a - grab.lastA)
      ang += d
      angVel = angVel * 0.5 + d * 34 // blend for a lively flick estimate
      grab.lastA = a
    },
    onUp() { grab = null },
    update(dt) {
      if (grab) return
      ang += angVel * dt
      angVel *= Math.exp(-0.85 * dt)
      if (Math.abs(angVel) < 0.05) angVel = 0
    },
    draw(g) {
      g.save()
      g.translate(cx, cy)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      g.beginPath(); g.ellipse(6, 10, R, R * 0.92, 0, 0, Math.PI * 2); g.fill()
      for (let i = 0; i < cols.length; i++) {
        g.beginPath(); g.moveTo(0, 0)
        g.arc(0, 0, R, (i / cols.length) * Math.PI * 2, ((i + 1) / cols.length) * Math.PI * 2)
        g.closePath()
        g.fillStyle = cols[i]; g.fill()
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      }
      g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke()
      // the arrow
      g.rotate(ang)
      g.fillStyle = INK
      g.beginPath(); g.moveTo(0, -R + 14); g.lineTo(15, 12); g.lineTo(-15, 12); g.closePath(); g.fill()
      g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fillStyle = '#f7c948'; g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.restore()
    },
  }
}
