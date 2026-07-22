import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// The dresser against the west wall. From above you see its wooden top (with a
// doily and a little framed doodle) and its drawer fronts as a side band facing
// the room — brass knobs and all. Press it and the middle drawer slides out to
// reveal folded "skins"… and the cursor shop opens. Press again to close it.

const DR_W = 380      // across (x) — the wall side
const DR_H = 950      // along the wall (y)
const BAND = 56       // drawer-front band on the room (+x) side

export function createDresser(cx: number, cy: number): TableGame {
  const x0 = cx - DR_W / 2, y0 = cy - DR_H / 2
  let ext = 0          // how far the drawer is out
  let open = false

  registerObstacleProvider(() => [
    { x: cx, y: cy - 240, half: DR_W / 2 },
    { x: cx, y: cy + 240, half: DR_W / 2 },
  ])

  const inside = (x: number, y: number): boolean =>
    x > x0 - 8 && x < x0 + DR_W + BAND + ext + 30 && y > y0 - 8 && y < y0 + DR_H + 8

  return {
    id: 'dresser',
    onDown(x, y) {
      if (!inside(x, y)) return false
      open = !open
      spark(x0 + DR_W + BAND, cy, 0.12)
      if (open) {
        // the shop lives in the DOM — the dresser is its home in the room
        const btn = document.querySelector<HTMLButtonElement>('.dw-shop-btn')
        btn?.click()
      }
      return true
    },
    onMove() {},
    onUp() {},
    update(dt) {
      ext += ((open ? 190 : 0) - ext) * Math.min(1, dt * 8)
    },
    draw(g) {
      // ---- the open drawer slides out UNDER the cabinet top ----
      if (ext > 2) {
        const dw = 300, dx = x0 + DR_W - 20
        g.fillStyle = 'rgba(32,26,23,0.24)'
        roundRect(g, dx + 6, cy - dw / 2 + 9, BAND + ext + 14, dw, 10); g.fill()
        g.fillStyle = '#9a7747'                                   // drawer box sides
        roundRect(g, dx, cy - dw / 2, BAND + ext + 14, dw, 10); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
        g.fillStyle = '#5c3a1e'                                   // inside the drawer
        roundRect(g, dx + 12, cy - dw / 2 + 12, BAND + ext - 10, dw - 24, 6); g.fill()
        g.lineWidth = 2; g.stroke()
        // folded cursor "skins" stacked inside
        const folds = [theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple]
        folds.forEach((col, i) => {
          const fy = cy - dw / 2 + 34 + i * ((dw - 62) / folds.length)
          g.fillStyle = col
          roundRect(g, dx + 24, fy, Math.max(20, BAND + ext - 40), 44, 8); g.fill()
          g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()
          g.strokeStyle = 'rgba(32,26,23,0.3)'; g.lineWidth = 1.6
          g.beginPath(); g.moveTo(dx + 30, fy + 22); g.lineTo(dx + BAND + ext - 22, fy + 22); g.stroke()
        })
        // drawer front rides on the end
        g.fillStyle = '#d3a163'
        roundRect(g, dx + BAND + ext - 8, cy - dw / 2 - 6, 26, dw + 12, 8); g.fill()
        g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke()
      }

      // ---- carcass: wooden top + drawer band facing the room ----
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, x0 + 8, y0 + 11, DR_W + BAND, DR_H, 18); g.fill()
      // drawer-front band (the side you see) with three fronts + brass knobs
      g.fillStyle = '#9a7747'
      roundRect(g, x0 + DR_W - 24, y0, BAND + 24, DR_H, 12); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      for (let i = 0; i < 3; i++) {
        const fy = y0 + 14 + i * ((DR_H - 28) / 3)
        const fh = (DR_H - 28) / 3 - 10
        g.fillStyle = '#d3a163'
        roundRect(g, x0 + DR_W - 14, fy, BAND + 4, fh, 8); g.fill()
        g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()
        g.fillStyle = '#e9c96c'   // knob
        g.beginPath(); g.arc(x0 + DR_W + BAND / 2 - 4, fy + fh / 2, 11, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.2; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.6)'
        g.beginPath(); g.arc(x0 + DR_W + BAND / 2 - 8, fy + fh / 2 - 4, 3.5, 0, Math.PI * 2); g.fill()
      }
      // the top slab
      g.fillStyle = '#7a4e28'
      roundRect(g, x0, y0, DR_W, DR_H, 18); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#d3a163'
      roundRect(g, x0 + 16, y0 + 16, DR_W - 32, DR_H - 32, 12); g.fill()
      g.lineWidth = 2.6; g.stroke()
      g.strokeStyle = 'rgba(74,48,22,0.35)'; g.lineWidth = 2   // grain seams
      for (const fx of [0.4, 0.68]) {
        g.beginPath(); g.moveTo(x0 + DR_W * fx, y0 + 20); g.lineTo(x0 + DR_W * fx, y0 + DR_H - 20); g.stroke()
      }

      // ---- doily + framed doodle on top ----
      g.save()
      g.translate(cx - 10, cy - 240)
      g.fillStyle = '#fefaf0'
      g.beginPath()
      for (let i = 0; i < 12; i++) {   // scalloped edge
        const a = (i / 12) * Math.PI * 2
        g.arc(Math.cos(a) * 92, Math.sin(a) * 92 * 0.7, 22, 0, Math.PI * 2)
      }
      g.fill()
      g.beginPath(); g.ellipse(0, 0, 96, 68, 0, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.2; g.strokeStyle = 'rgba(32,26,23,0.45)'; g.stroke()
      g.restore()

      g.save()
      g.translate(cx - 6, cy + 180)
      g.rotate(0.1)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      roundRect(g, -70 + 4, -90 + 6, 140, 180, 8); g.fill()
      g.fillStyle = '#f7c948'
      roundRect(g, -70, -90, 140, 180, 8); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#fefaf0'
      roundRect(g, -52, -72, 104, 144, 4); g.fill()
      g.lineWidth = 2; g.stroke()
      // the doodle: a lopsided heart
      g.strokeStyle = theme.colors.coral; g.lineWidth = 5; g.lineJoin = 'round'
      g.beginPath()
      g.moveTo(0, 34)
      g.bezierCurveTo(-52, -8, -30, -52, 0, -22)
      g.bezierCurveTo(30, -52, 52, -8, 0, 34)
      g.stroke()
      g.restore()
    },
  }
}
