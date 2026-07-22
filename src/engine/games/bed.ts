import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// The bed — head against the EAST wall, seen straight from above: wooden frame,
// patchwork quilt, a pillow at the head and a teddy sitting on the covers.
// A nightstand with a lamp keeps it company. Press the bed and the quilt
// squashes while the teddy hops; press the lamp and it throws a warm pool.

const BED_W = 1040          // along x — the head is the +x end
const BED_H = 640
const FRAME = '#7a4e28'
const MATTRESS = '#f5ecd6'
const NS = 250              // nightstand size
const G = 4400

export function createBed(cx: number, cy: number): TableGame {
  const bx0 = cx - BED_W / 2, by0 = cy - BED_H / 2
  // nightstand tucked between the bed and the top of the east wall
  const nx = cx + BED_W / 2 - NS / 2 - 10
  const ny = by0 - NS / 2 - 130

  let squash = 0                        // quilt press pulse
  let lampLit = true
  let lampPress = 0
  // teddy hops straight up when you pat the bed
  const teddy = { x: cx - BED_W * 0.22, y: cy + BED_H * 0.16, z: 0, vz: 0, rot: -0.18 }

  // patchwork colors picked once so the quilt doesn't reshuffle every frame
  const PATCH = [theme.colors.coral, '#f7c948', theme.colors.sky, theme.colors.pink]
  const quiltCols = 5, quiltRows = 4
  const patches: string[] = []
  for (let i = 0; i < quiltCols * quiltRows; i++) {
    // neighbours never match: offset stride by row
    patches.push(PATCH[(i + ((i / quiltCols) | 0)) % PATCH.length])
  }

  registerObstacleProvider(() => [
    { x: cx - 350, y: cy, half: BED_H / 2 - 40 },
    { x: cx, y: cy, half: BED_H / 2 - 40 },
    { x: cx + 350, y: cy, half: BED_H / 2 - 40 },
    { x: nx, y: ny, half: NS / 2 },
  ])

  const onBed = (x: number, y: number): boolean =>
    x > bx0 - 8 && x < bx0 + BED_W + 8 && y > by0 - 8 && y < by0 + BED_H + 8
  const onLamp = (x: number, y: number): boolean => Math.hypot(x - nx, y - ny) < 92

  return {
    id: 'bed',
    onDown(x, y) {
      if (onLamp(x, y)) {
        lampLit = !lampLit
        lampPress = 1
        spark(nx, ny, 0.1)
        return true
      }
      if (onBed(x, y)) {
        squash = 1
        if (teddy.z === 0) teddy.vz = 620 + Math.random() * 220
        spark(x, y, 0.08)
        return true
      }
      return false
    },
    onMove() {},
    onUp() {},
    update(dt) {
      squash = Math.max(0, squash - dt * 5)
      lampPress = Math.max(0, lampPress - dt * 6)
      if (teddy.z > 0 || teddy.vz > 0) {
        teddy.vz -= G * dt
        teddy.z += teddy.vz * dt
        if (teddy.z <= 0) {
          teddy.z = 0; teddy.vz = 0
          teddy.rot = -0.18 + (Math.random() - 0.5) * 0.2   // lands a little askew
        }
      }
    },
    draw(g, t) {
      // ---- lamp pool first, so the bed sits inside the glow ----
      if (lampLit) {
        const flicker = 0.05 + Math.sin(t / 900) * 0.012
        g.fillStyle = `rgba(255,214,120,${0.16 + flicker})`
        g.beginPath(); g.ellipse(nx, ny + 30, 330, 300, 0, 0, Math.PI * 2); g.fill()
      }

      // ---- bed ----
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, bx0 + 8, by0 + 12, BED_W, BED_H, 26); g.fill()   // hard offset shadow
      g.fillStyle = FRAME
      roundRect(g, bx0, by0, BED_W, BED_H, 26); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // headboard: a thicker wooden band across the head (+x) end
      g.fillStyle = '#8d5b31'
      roundRect(g, bx0 + BED_W - 64, by0 - 14, 64, BED_H + 28, 16); g.fill()
      g.lineWidth = 3; g.stroke()

      const sq = 1 + squash * 0.035
      g.save()
      g.translate(cx, cy)
      g.scale(sq, 2 - sq)   // press in: wider, shallower — a mattress, not a board
      g.translate(-cx, -cy)

      // mattress
      g.fillStyle = MATTRESS
      roundRect(g, bx0 + 26, by0 + 26, BED_W - 96, BED_H - 52, 20); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()

      // patchwork quilt over the foot 2/3 of the mattress
      const qx0 = bx0 + 26, qw = (BED_W - 96) * 0.64, qy0 = by0 + 26, qh = BED_H - 52
      const pw = qw / quiltCols, ph = qh / quiltRows
      g.save()
      roundRect(g, qx0, qy0, qw, qh, 20); g.clip()
      for (let c = 0; c < quiltCols; c++) for (let r = 0; r < quiltRows; r++) {
        g.fillStyle = patches[r * quiltCols + c]
        g.fillRect(qx0 + c * pw, qy0 + r * ph, pw + 1, ph + 1)
      }
      // stitch lines between patches
      g.strokeStyle = 'rgba(32,26,23,0.35)'; g.lineWidth = 2
      for (let c = 1; c < quiltCols; c++) { g.beginPath(); g.moveTo(qx0 + c * pw, qy0); g.lineTo(qx0 + c * pw, qy0 + qh); g.stroke() }
      for (let r = 1; r < quiltRows; r++) { g.beginPath(); g.moveTo(qx0, qy0 + r * ph); g.lineTo(qx0 + qw, qy0 + r * ph); g.stroke() }
      g.restore()
      g.lineWidth = 3; g.strokeStyle = INK
      roundRect(g, qx0, qy0, qw, qh, 20); g.stroke()
      // folded-back hem where the quilt meets the sheets
      g.fillStyle = '#fefaf0'
      g.fillRect(qx0 + qw - 4, qy0 + 4, 30, qh - 8)
      g.lineWidth = 2.5
      g.strokeRect(qx0 + qw - 4, qy0 + 4, 30, qh - 8)

      // pillow at the head, slightly askew
      g.save()
      g.translate(bx0 + BED_W - 170, cy)
      g.rotate(0.06)
      g.fillStyle = 'rgba(32,26,23,0.14)'
      roundRect(g, -66 + 4, -150 + 6, 132, 300, 40); g.fill()
      g.fillStyle = '#fefaf0'
      roundRect(g, -66, -150, 132, 300, 40); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.strokeStyle = 'rgba(32,26,23,0.18)'; g.lineWidth = 2
      g.beginPath(); g.moveTo(-30, -110); g.quadraticCurveTo(0, 0, -26, 112); g.stroke()  // crease
      g.restore()

      g.restore()  // end mattress squash

      // ---- teddy on the quilt (breathes; hops when you pat the bed) ----
      const breathe = 1 + Math.sin(t / 700) * 0.02
      const raise = teddy.z * 0.75
      const shScale = Math.max(0.6, 1 - teddy.z / 500)
      g.fillStyle = `rgba(32,26,23,${Math.max(0.1, 0.22 - teddy.z / 900)})`
      g.beginPath(); g.ellipse(teddy.x + 4, teddy.y + 8, 56 * shScale, 44 * shScale, 0, 0, Math.PI * 2); g.fill()
      g.save()
      g.translate(teddy.x, teddy.y - raise)
      g.rotate(teddy.rot)
      g.scale(breathe, breathe)
      const fur = '#b5915a', furD = '#9a7747'
      // body then head then ears, all flat with ink
      g.fillStyle = fur
      g.beginPath(); g.ellipse(0, 22, 44, 38, 0, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      for (const s of [-1, 1]) {   // paws
        g.beginPath(); g.ellipse(s * 40, 34, 14, 11, s * 0.5, 0, Math.PI * 2)
        g.fillStyle = fur; g.fill(); g.stroke()
      }
      for (const s of [-1, 1]) {   // ears behind the head
        g.beginPath(); g.arc(s * 26, -42, 14, 0, Math.PI * 2)
        g.fillStyle = furD; g.fill(); g.stroke()
      }
      g.beginPath(); g.arc(0, -22, 34, 0, Math.PI * 2)
      g.fillStyle = fur; g.fill(); g.stroke()
      g.beginPath(); g.ellipse(0, -12, 15, 11, 0, 0, Math.PI * 2)   // muzzle
      g.fillStyle = '#ecd9ae'; g.fill(); g.lineWidth = 2.5; g.stroke()
      g.fillStyle = INK
      g.beginPath(); g.arc(-11, -28, 3.4, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.arc(11, -28, 3.4, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.ellipse(0, -15, 4.5, 3.4, 0, 0, Math.PI * 2); g.fill()
      g.restore()

      // ---- nightstand + lamp ----
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, nx - NS / 2 + 6, ny - NS / 2 + 9, NS, NS, 18); g.fill()
      g.fillStyle = FRAME
      roundRect(g, nx - NS / 2, ny - NS / 2, NS, NS, 18); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#d3a163'
      roundRect(g, nx - NS / 2 + 14, ny - NS / 2 + 14, NS - 28, NS - 28, 12); g.fill()
      g.lineWidth = 2.5; g.stroke()
      // the lamp from above: shade disc over a hint of base, warm ring when lit
      const lp = 1 - lampPress * 0.12
      g.save()
      g.translate(nx, ny)
      g.scale(lp, lp)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      g.beginPath(); g.arc(5, 7, 74, 0, Math.PI * 2); g.fill()
      g.fillStyle = lampLit ? '#f7c948' : '#ecd9ae'
      g.beginPath(); g.arc(0, 0, 74, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      // shade ribs + the finial button in the middle
      g.lineWidth = 2; g.strokeStyle = 'rgba(32,26,23,0.28)'
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        g.beginPath(); g.moveTo(Math.cos(a) * 26, Math.sin(a) * 26); g.lineTo(Math.cos(a) * 70, Math.sin(a) * 70); g.stroke()
      }
      g.fillStyle = lampLit ? '#fefaf0' : '#c9ced3'
      g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.restore()
    },
  }
}
