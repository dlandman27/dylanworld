import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// A low bookcase against the top wall, seen from above: a wooden case packed
// with standing books — you're looking at their top edges. Press a book and it
// slides out toward the room; press again to push it home. A couple of books
// lie flat on top of the row like someone gave up shelving them.

const CASE_W = 1250
const CASE_H = 330

interface Book { x: number; w: number; color: string; depth: number; out: number; target: number }

export function createBookshelf(cx: number, cy: number): TableGame {
  const x0 = cx - CASE_W / 2, y0 = cy - CASE_H / 2
  const COLORS = [
    theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple,
    theme.colors.orange, theme.colors.teal, '#f7c948', theme.colors.pink, '#5a6bb0',
  ]

  // pack the shelf with books of varied width/depth — seeded once, stays put
  const books: Book[] = []
  let bx = x0 + 36
  let ci = 0
  while (bx < x0 + CASE_W - 80) {
    const w = 30 + Math.random() * 26
    books.push({
      x: bx, w,
      color: COLORS[ci++ % COLORS.length],
      depth: CASE_H - 96 - Math.random() * 46,
      out: 0, target: 0,
    })
    bx += w + 5
  }

  registerObstacleProvider(() => [
    { x: cx - 420, y: cy, half: CASE_H / 2 },
    { x: cx, y: cy, half: CASE_H / 2 },
    { x: cx + 420, y: cy, half: CASE_H / 2 },
  ])

  return {
    id: 'bookshelf',
    onDown(x, y) {
      if (x < x0 - 8 || x > x0 + CASE_W + 8 || y < y0 - 8 || y > y0 + CASE_H + 60) return false
      for (const b of books) {
        if (x > b.x - 3 && x < b.x + b.w + 3 && y > y0 && y < y0 + CASE_H + b.out) {
          b.target = b.target > 0 ? 0 : 64      // slide out ↔ push home
          spark(b.x + b.w / 2, y0 + CASE_H, 0.08)
          return true
        }
      }
      return true   // capture presses on the case so the table doesn't pan
    },
    onMove() {},
    onUp() {},
    update(dt) {
      for (const b of books) b.out += (b.target - b.out) * Math.min(1, dt * 10)
    },
    draw(g) {
      // case: dark walnut frame with a lighter well the books sit in
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, x0 + 8, y0 + 11, CASE_W, CASE_H, 16); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, x0, y0, CASE_W, CASE_H, 16); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = '#5c3a1e'
      roundRect(g, x0 + 20, y0 + 20, CASE_W - 40, CASE_H - 40, 10); g.fill()
      g.lineWidth = 2.5; g.stroke()

      // the books: top edges, leaning on each other, sliding out when pulled
      for (const b of books) {
        const top = y0 + 34 + b.out
        g.fillStyle = 'rgba(32,26,23,0.2)'
        roundRect(g, b.x + 3, top + 4, b.w, b.depth, 4); g.fill()
        g.fillStyle = b.color
        roundRect(g, b.x, top, b.w, b.depth, 4); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        // pages: a cream strip along the room-side end
        g.fillStyle = '#fefaf0'
        roundRect(g, b.x + 4, top + b.depth - 16, b.w - 8, 12, 3); g.fill()
        g.lineWidth = 1.6; g.stroke()
        // spine band
        g.strokeStyle = 'rgba(32,26,23,0.3)'; g.lineWidth = 2
        g.beginPath(); g.moveTo(b.x + b.w * 0.5, top + 8); g.lineTo(b.x + b.w * 0.5, top + b.depth - 22); g.stroke()
      }

      // two books lying flat across the right end of the case
      let ang = -0.06
      for (const [w, h, col] of [[210, 140, '#f7c948'], [180, 120, theme.colors.teal]] as const) {
        g.save()
        g.translate(x0 + CASE_W - 150, cy + (ang < 0 ? -10 : 14))
        g.rotate(ang)
        g.fillStyle = 'rgba(32,26,23,0.2)'
        roundRect(g, -w / 2 + 4, -h / 2 + 6, w, h, 8); g.fill()
        g.fillStyle = col
        roundRect(g, -w / 2, -h / 2, w, h, 8); g.fill()
        g.lineWidth = 2.8; g.strokeStyle = INK; g.stroke()
        g.fillStyle = '#fefaf0'   // page block peeking out
        roundRect(g, w / 2 - 14, -h / 2 + 8, 10, h - 16, 3); g.fill()
        g.lineWidth = 1.6; g.stroke()
        g.strokeStyle = 'rgba(32,26,23,0.35)'; g.lineWidth = 2
        roundRect(g, -w / 2 + 14, -h / 2 + 14, w - 40, h - 28, 5); g.stroke()
        g.restore()
        ang = 0.09
      }
    },
  }
}
