import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A squishy beanbag chair flopped on the lounge rug, seen from above. Press it
// and it squashes with a soft "fwump", then eases back. Pure comfy scenery.

const RX = 172, RY = 150

export function createBeanbag(cx: number, cy: number, color: string, tilt = 0): TableGame {
  let squish = 0
  return {
    id: 'beanbag',
    onDown(x, y) {
      const dx = (x - cx) / RX, dy = (y - cy) / RY
      if (dx * dx + dy * dy <= 1) { squish = 1; clunk(0.28); return true }
      return false
    },
    onMove() {}, onUp() {},
    update(dt) { squish = Math.max(0, squish * Math.exp(-6 * dt) - dt * 0.05) },
    draw(g: Ctx) {
      g.save()
      g.translate(cx, cy); g.rotate(tilt)
      // press squash: spreads wider + flatter, sinking slightly
      const sx = 1 + squish * 0.1, sy = 1 - squish * 0.14
      // cast shadow (stays put on the floor)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      g.beginPath(); g.ellipse(10, 20, RX * sx, RY * sy, 0, 0, Math.PI * 2); g.fill()
      g.scale(sx, sy)
      // saggy two-lump body — a back cushion behind a fat seat
      g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 4; g.lineJoin = 'round'
      g.beginPath(); g.ellipse(0, -34, RX * 0.82, RY * 0.6, 0, 0, Math.PI * 2); g.fill(); g.stroke()
      g.beginPath(); g.ellipse(0, 26, RX, RY * 0.74, 0, 0, Math.PI * 2); g.fill(); g.stroke()
      // seat dip (where you'd sit) + panel seams
      g.fillStyle = 'rgba(32,26,23,0.14)'
      g.beginPath(); g.ellipse(0, 30, RX * 0.5, RY * 0.34, 0, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(32,26,23,0.28)'; g.lineWidth = 3
      for (const a of [-0.6, 0, 0.6]) {
        g.beginPath(); g.moveTo(Math.sin(a) * 20, -6); g.lineTo(Math.sin(a) * RX * 0.9, 34); g.stroke()
      }
      // fabric sheen
      g.fillStyle = 'rgba(255,255,255,0.22)'
      g.beginPath(); g.ellipse(-RX * 0.34, -46, RX * 0.28, RY * 0.16, -0.5, 0, Math.PI * 2); g.fill()
      // top stitch button
      g.fillStyle = color; g.strokeStyle = INK; g.lineWidth = 3
      g.beginPath(); g.arc(0, -34, 9, 0, Math.PI * 2); g.fill(); g.stroke()
      g.restore()
    },
  }
}
