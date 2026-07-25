import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import { toggleCursorShop, isCursorShopOpen, notifyDresserToggle } from '../../ui/cursorShop'
import { CURSORS } from '../../config/cursors'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// the open drawer is stuffed with overlapping cursor stickers (dupes ok) — a
// deterministic scatter, so it fills the drawer and never shimmers frame-to-frame
const DRAWER_POOL = CURSORS.filter((k) => k.id !== 'dylan')
const dhash = (n: number): number => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const DRAWER_PILE = Array.from({ length: 90 }, (_, i) => ({
  u: dhash(i * 3 + 1),
  v: dhash(i * 3 + 2),
  rot: (dhash(i * 3 + 3) - 0.5) * 0.9,
  cur: DRAWER_POOL[(dhash(i * 7 + 5) * DRAWER_POOL.length) | 0],
}))

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
      // the cursor picker lives in the DOM — the dresser is its home in the room
      notifyDresserToggle()
      open = toggleCursorShop()
      spark(x0 + DR_W + BAND, cy, 0.12)
      return true
    },
    onMove() {},
    onUp() {},
    update(dt) {
      open = isCursorShopOpen()   // stay in sync if the picker is closed via "done"
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
        // the drawer stuffed full of overlapping cursors, clipped to the box
        if (ext > 60) {
          g.save()
          roundRect(g, dx + 12, cy - dw / 2 + 12, BAND + ext - 10, dw - 24, 6); g.clip()
          const ix0 = dx + 20, iy0 = cy - dw / 2 + 20
          const iw = BAND + ext - 22, ih = dw - 40, cell = 66
          for (const it of DRAWER_PILE) {
            g.save()
            g.translate(ix0 + it.u * iw, iy0 + it.v * ih)
            g.rotate(it.rot); g.scale(cell / 32, cell / 32); g.translate(-16, -16)
            it.cur.draw(g)
            g.restore()
          }
          g.restore()
        }
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

      // ---- "cursors" placard on the top — signals what the drawer holds ----
      g.save()
      g.translate(cx - 10, cy - 20)
      g.rotate(-0.04)
      g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -100, -24, 208, 58, 12); g.fill()   // shadow
      g.fillStyle = theme.colors.card; roundRect(g, -104, -29, 208, 58, 12); g.fill()       // card
      g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // a little arrow-cursor sticker on the left (shadow, then white arrow)
      const arrow = (ox: number, oy: number): void => {
        g.beginPath()
        g.moveTo(ox, oy); g.lineTo(ox, oy + 22); g.lineTo(ox + 5.5, oy + 17); g.lineTo(ox + 9.5, oy + 26)
        g.lineTo(ox + 12.5, oy + 24.5); g.lineTo(ox + 8.5, oy + 15.5); g.lineTo(ox + 16, oy + 15.5); g.closePath()
      }
      arrow(-84.6, -11.6); g.fillStyle = INK; g.fill()
      arrow(-86, -13); g.fillStyle = '#fefaf0'; g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      // label
      g.fillStyle = INK
      g.font = `900 27px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.textAlign = 'left'; g.textBaseline = 'middle'
      g.fillText('CURSORS', -48, 4)
      g.restore()
    },
  }
}
