import type { TableGame } from './shared'
import { INK, TILE, roundRect, pips } from './shared'

// Dominoes you can slide around and stand in a line — drag them; they keep a
// little momentum when released so you can shove them into each other.

interface Domino { x: number; y: number; vx: number; vy: number; rot: number; top: number; bot: number }

const DW = 46, DH = 92

export function createDominoes(cx: number, cy: number): TableGame {
  const set: [number, number][] = [[5, 3], [2, 4], [6, 2], [1, 5], [4, 4], [3, 6]]
  const doms: Domino[] = set.map(([top, bot], i) => ({
    x: cx + (i - 2.5) * 66,
    y: cy + ((i * 41) % 44) - 22,
    vx: 0, vy: 0,
    rot: ((i * 29) % 24 - 12) / 100,
    top, bot,
  }))
  let grab: { d: Domino; tx: number; ty: number } | null = null

  return {
    id: 'dominoes',
    onDown(x, y) {
      for (let i = doms.length - 1; i >= 0; i--) {
        const d = doms[i]
        if (Math.abs(x - d.x) < DW / 2 + 8 && Math.abs(y - d.y) < DH / 2 + 8) {
          doms.splice(i, 1); doms.push(d)
          grab = { d, tx: x, ty: y }
          return true
        }
      }
      return false
    },
    onMove(x, y) { if (grab) { grab.tx = x; grab.ty = y } },
    onUp() { grab = null },
    update(dt) {
      if (grab) {
        grab.d.vx = (grab.tx - grab.d.x) * 14
        grab.d.vy = (grab.ty - grab.d.y) * 14
      }
      const f = Math.exp(-4.5 * dt)
      for (const d of doms) {
        d.vx *= f; d.vy *= f
        d.x += d.vx * dt; d.y += d.vy * dt
      }
      // shove each other apart (loose rectangle approx via circles)
      const R = 34
      for (let i = 0; i < doms.length; i++) for (let j = i + 1; j < doms.length; j++) {
        const a = doms[i], b = doms[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dd = Math.hypot(dx, dy)
        if (dd === 0 || dd >= R * 2) continue
        const nx = dx / dd, ny = dy / dd, push = (R * 2 - dd) / 2
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
      }
    },
    draw(g) {
      for (const d of doms) {
        g.save()
        g.translate(d.x, d.y)
        g.rotate(d.rot)
        g.fillStyle = 'rgba(32,26,23,0.2)'
        roundRect(g, -DW / 2 + 3, -DH / 2 + 5, DW, DH, 7); g.fill()
        g.fillStyle = TILE
        roundRect(g, -DW / 2, -DH / 2, DW, DH, 7); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        g.beginPath(); g.moveTo(-DW / 2 + 4, 0); g.lineTo(DW / 2 - 4, 0); g.stroke()
        pips(g, 0, -DH / 4, 38, d.top)
        pips(g, 0, DH / 4, 38, d.bot)
        g.restore()
      }
    },
  }
}
