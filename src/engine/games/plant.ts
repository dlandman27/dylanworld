import { registerObstacleProvider, spark } from '../physics'
import type { TableGame } from './shared'
import { INK } from './shared'

// A potted plant for the corner — terracotta pot seen from above with big flat
// leaves fanned out around it. The leaves sway gently on their own and rustle
// when you press them.

interface Leaf { ang: number; len: number; wid: number; phase: number; jitter: number }

export function createPlant(cx: number, cy: number): TableGame {
  const R = 230   // leaf span
  const leaves: Leaf[] = []
  const n = 9
  for (let i = 0; i < n; i++) {
    leaves.push({
      ang: (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      len: R * (0.72 + Math.random() * 0.32),
      wid: 54 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      jitter: 0,
    })
  }

  registerObstacleProvider(() => [{ x: cx, y: cy, half: 120 }])

  return {
    id: 'plant',
    onDown(x, y) {
      if (Math.hypot(x - cx, y - cy) > R + 20) return false
      for (const l of leaves) l.jitter = 1
      spark(cx, cy, 0.1)
      return true
    },
    onMove() {},
    onUp() {},
    update(dt) {
      for (const l of leaves) l.jitter = Math.max(0, l.jitter - dt * 2.2)
    },
    draw(g, t) {
      // pot shadow + terracotta rim (orange warmed down with an ink wash)
      g.fillStyle = 'rgba(32,26,23,0.24)'
      g.beginPath(); g.arc(cx + 7, cy + 10, 128, 0, Math.PI * 2); g.fill()

      // leaves first — the pot rim overlaps their stems
      for (const l of leaves) {
        const sway = Math.sin(t / 1600 + l.phase) * 0.045 + Math.sin(t / 90 + l.phase) * l.jitter * 0.12
        const a = l.ang + sway
        const tipX = cx + Math.cos(a) * l.len
        const tipY = cy + Math.sin(a) * l.len
        const midX = cx + Math.cos(a) * l.len * 0.5
        const midY = cy + Math.sin(a) * l.len * 0.5
        const px = -Math.sin(a), py = Math.cos(a)
        // hard offset shadow under each leaf
        g.fillStyle = 'rgba(32,26,23,0.14)'
        g.beginPath()
        g.moveTo(cx + 5, cy + 8)
        g.quadraticCurveTo(midX + px * l.wid + 5, midY + py * l.wid + 8, tipX + 5, tipY + 8)
        g.quadraticCurveTo(midX - px * l.wid + 5, midY - py * l.wid + 8, cx + 5, cy + 8)
        g.fill()
        // the leaf
        g.fillStyle = '#79ad4a'
        g.beginPath()
        g.moveTo(cx, cy)
        g.quadraticCurveTo(midX + px * l.wid, midY + py * l.wid, tipX, tipY)
        g.quadraticCurveTo(midX - px * l.wid, midY - py * l.wid, cx, cy)
        g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
        // centre vein
        g.strokeStyle = 'rgba(32,26,23,0.35)'; g.lineWidth = 2.2
        g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(midX, midY, tipX, tipY); g.stroke()
      }

      // the pot rim on top: two flat rings + soil
      g.fillStyle = '#c96a3b'
      g.beginPath(); g.arc(cx, cy, 122, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#b25a2f'
      g.beginPath(); g.arc(cx, cy, 96, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.6; g.stroke()
      g.fillStyle = '#5c3a1e'   // soil
      g.beginPath(); g.arc(cx, cy, 74, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.4; g.stroke()
      // glint on the rim
      g.fillStyle = 'rgba(255,255,255,0.3)'
      g.beginPath(); g.ellipse(cx - 46, cy - 48, 26, 10, -0.7, 0, Math.PI * 2); g.fill()
    },
  }
}
