import { theme } from '../../config/theme'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// The drone station — a metal charging dock the fleet parks on. Pure scenery
// (the drones themselves are the interactive bits, drawn on top), so it just
// draws: a plated platform, hazard-striped edges, panel lines, and a sign.

export function createDroneDock(cx: number, cy: number, w: number, h: number): TableGame {
  const x0 = cx - w / 2, y0 = cy - h / 2
  return {
    id: 'dronedock',
    onDown() { return false },   // scenery — never captures the pointer
    onMove() {}, onUp() {}, update() {},
    draw(g: Ctx) {
      // shadow + plated base
      g.fillStyle = 'rgba(32,26,23,0.24)'; roundRect(g, x0 + 10, y0 + 14, w, h, 22); g.fill()
      g.fillStyle = '#cfd4d9'; roundRect(g, x0, y0, w, h, 22); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // inset deck
      g.fillStyle = '#b9c0c6'; roundRect(g, x0 + 16, y0 + 46, w - 32, h - 62, 14); g.fill()
      g.lineWidth = 2.5; g.stroke()
      // hazard stripe along the top header
      g.save(); roundRect(g, x0 + 16, y0 + 14, w - 32, 26, 8); g.clip()
      for (let sx = x0 - h; sx < x0 + w; sx += 34) {
        g.fillStyle = ((sx / 34) | 0) % 2 === 0 ? '#f7c948' : INK
        g.beginPath(); g.moveTo(sx, y0 + 14); g.lineTo(sx + 18, y0 + 14); g.lineTo(sx + 18 + 26, y0 + 40); g.lineTo(sx + 26, y0 + 40); g.closePath(); g.fill()
      }
      g.restore()
      g.lineWidth = 2.5; g.strokeStyle = INK; roundRect(g, x0 + 16, y0 + 14, w - 32, 26, 8); g.stroke()
      // panel rivets down the deck
      g.fillStyle = 'rgba(32,26,23,0.28)'
      for (const rx of [x0 + 30, x0 + w - 30]) for (let ry = y0 + 62; ry < y0 + h - 14; ry += 46) { g.beginPath(); g.arc(rx, ry, 3.5, 0, Math.PI * 2); g.fill() }
      // sign
      g.fillStyle = INK; g.font = `900 22px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('DRONE  DOCK', cx, y0 + 27)
    },
  }
}
