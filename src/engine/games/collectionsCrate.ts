import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// An open wooden toy crate spilling with a teddy bear and odds and ends — the
// "collections" box. Top-down house style (flat fills, ink outlines, hard offset
// shadow). Tap it and the toys give a little jiggle.

const TAU = Math.PI * 2
const CW = 300, CH = 210
const WOOD = '#b07a3e', WOOD_DK = '#8a5a2b', SLAT = 'rgba(74,48,22,0.35)'

export function createCollectionsCrate(cx: number, cy: number): TableGame {
  const x0 = cx - CW / 2, y0 = cy - CH / 2
  let jiggle = 0

  registerObstacleProvider(() => [{ x: cx, y: cy, half: CH / 2 }, { x: cx - 70, y: cy, half: CH / 2 }, { x: cx + 70, y: cy, half: CH / 2 }])

  return {
    id: 'collections',
    onDown(x, y) {
      if (x < x0 - 8 || x > x0 + CW + 8 || y < y0 - 8 || y > y0 + CH + 8) return false
      jiggle = 1; spark(x, y, 0.12)
      return true
    },
    onMove() {},
    onUp() {},
    update(dt) { jiggle = Math.max(0, jiggle - dt * 2.5) },
    draw(g: Ctx, t) {
      const ts = t * 0.001
      const jb = Math.sin(ts * 22) * jiggle * 3   // shared jiggle offset

      // ---- crate box ----
      g.fillStyle = 'rgba(32,26,23,0.24)'; roundRect(g, x0 + 8, y0 + 12, CW, CH, 14); g.fill()
      g.fillStyle = WOOD; roundRect(g, x0, y0, CW, CH, 14); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // inner well
      g.fillStyle = WOOD_DK; roundRect(g, x0 + 16, y0 + 16, CW - 32, CH - 32, 10); g.fill(); g.lineWidth = 2.5; g.stroke()
      // slats on the rim
      g.strokeStyle = SLAT; g.lineWidth = 2
      for (const fx of [0.25, 0.5, 0.75]) { g.beginPath(); g.moveTo(x0 + CW * fx, y0 + 4); g.lineTo(x0 + CW * fx, y0 + 12); g.stroke(); g.beginPath(); g.moveTo(x0 + CW * fx, y0 + CH - 12); g.lineTo(x0 + CW * fx, y0 + CH - 4); g.stroke() }

      // ---- toys piled inside (clipped to the well) ----
      g.save(); roundRect(g, x0 + 16, y0 + 16, CW - 32, CH - 32, 10); g.clip()
      // blocks
      const blk = (bx: number, by: number, col: string, ch: string): void => {
        g.fillStyle = col; roundRect(g, bx, by + jb, 40, 40, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        g.fillStyle = '#fefaf0'; g.font = `900 24px "Arial Black", ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.strokeText(ch, bx + 20, by + 20 + jb); g.fillText(ch, bx + 20, by + 20 + jb)
      }
      blk(x0 + 30, y0 + CH - 78, theme.colors.sky, 'A')
      blk(x0 + 30, y0 + CH - 120, theme.colors.lime, 'B')
      // a red ball
      g.fillStyle = theme.colors.coral; g.beginPath(); g.arc(x0 + CW - 62, y0 + CH - 54 + jb, 26, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(x0 + CW - 70, y0 + CH - 62 + jb, 7, 4, -0.5, 0, TAU); g.fill()
      // a star
      star(g, x0 + CW - 52, y0 + 52 - jb, 15, '#f7c948')

      // ---- teddy bear peeking out (top-centre) ----
      const bx = cx + 18, by = y0 + 60 - jb * 1.4
      g.fillStyle = '#a9763f'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
      roundRect(g, bx - 34, by + 24, 68, 66, 22); g.fill(); g.stroke()                        // body
      for (const s of [-1, 1]) { g.beginPath(); g.arc(bx + s * 26, by - 24, 15, 0, TAU); g.fill(); g.stroke() }   // ears
      g.beginPath(); g.arc(bx, by, 34, 0, TAU); g.fill(); g.stroke()                            // head
      g.fillStyle = '#e7c9a0'; g.beginPath(); g.arc(bx, by + 8, 16, 0, TAU); g.fill(); g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()   // muzzle
      for (const s of [-1, 1]) { g.fillStyle = INK; g.beginPath(); g.arc(bx + s * 12, by - 6, 3.6, 0, TAU); g.fill() }   // eyes
      g.fillStyle = INK; g.beginPath(); g.arc(bx, by + 3, 4.5, 0, TAU); g.fill()                // nose
      for (const s of [-1, 1]) { g.fillStyle = '#a9763f'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(bx + s * 40, by + 44, 13, 0, TAU); g.fill(); g.stroke() }   // paws
      g.restore()

      // ---- "COLLECTIONS" placard clipped to the front rim ----
      g.fillStyle = '#f0e2be'; roundRect(g, cx - 84, y0 + CH - 30, 168, 34, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = INK; g.font = `900 20px "Arial Black", ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('COLLECTIONS', cx, y0 + CH - 12)
    },
  }
}

function star(g: Ctx, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath()
  for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.42 : r, a = -Math.PI / 2 + (k * Math.PI) / 5; k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) }
  g.closePath(); g.fill(); g.stroke()
}
