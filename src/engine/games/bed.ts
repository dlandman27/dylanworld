import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// The bed — head against the EAST wall, seen straight from above: wooden frame,
// a NAVY space quilt (rockets, planets, sparkle stars — the Buzz bedspread), a
// pillow at the head and a teddy sitting on the covers. A nightstand with a lamp
// keeps it company. Press the bed and the quilt squashes while the teddy hops;
// press the lamp and it throws a warm pool.

const BED_W = 1400          // along x — the head is the +x end (a bed dwarfs an iPad)
const BED_H = 840
const FRAME = '#7a4e28'
const MATTRESS = '#f5ecd6'
const NS = 300              // nightstand size
const G = 4400
const NAVY = '#2a3a78'      // space-quilt field

type Ctx = CanvasRenderingContext2D

/** One space-quilt motif, appliqué-style: flat fills, bold ink, sitting flat on
 * the navy. cx/cy = centre, rot = radians, sc = scale (1 ≈ 90px tall). */
function drawMotif(g: Ctx, cx: number, cy: number, kind: 'rocket' | 'planet' | 'star', rot: number, sc: number): void {
  g.save()
  g.translate(cx, cy); g.rotate(rot); g.scale(sc, sc)
  g.lineJoin = 'round'; g.lineWidth = 3.2 / sc; g.strokeStyle = INK
  if (kind === 'rocket') {
    // exhaust flame
    g.fillStyle = theme.colors.orange
    g.beginPath(); g.moveTo(-9, 34); g.lineTo(0, 60); g.lineTo(9, 34); g.closePath(); g.fill()
    g.fillStyle = '#f7c948'
    g.beginPath(); g.moveTo(-5, 34); g.lineTo(0, 50); g.lineTo(5, 34); g.closePath(); g.fill()
    // body
    g.fillStyle = '#fefaf0'
    g.beginPath()
    g.moveTo(0, -42)
    g.bezierCurveTo(20, -20, 20, 14, 14, 34)
    g.lineTo(-14, 34)
    g.bezierCurveTo(-20, 14, -20, -20, 0, -42)
    g.closePath(); g.fill(); g.stroke()
    // fins
    g.fillStyle = theme.colors.coral
    g.beginPath(); g.moveTo(-14, 16); g.lineTo(-28, 36); g.lineTo(-14, 34); g.closePath(); g.fill(); g.stroke()
    g.beginPath(); g.moveTo(14, 16); g.lineTo(28, 36); g.lineTo(14, 34); g.closePath(); g.fill(); g.stroke()
    // porthole
    g.fillStyle = theme.colors.sky
    g.beginPath(); g.arc(0, -6, 10, 0, Math.PI * 2); g.fill(); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.beginPath(); g.arc(-3, -9, 3.5, 0, Math.PI * 2); g.fill()
  } else if (kind === 'planet') {
    g.fillStyle = theme.colors.teal
    g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill(); g.stroke()
    // crater dots
    g.fillStyle = 'rgba(16,24,54,0.28)'
    g.beginPath(); g.arc(-8, -6, 6, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(9, 8, 4, 0, Math.PI * 2); g.fill()
    // ring
    g.save(); g.rotate(-0.5); g.strokeStyle = '#f7c948'; g.lineWidth = 6 / sc
    g.beginPath(); g.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = INK; g.lineWidth = 2 / sc
    g.beginPath(); g.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2); g.stroke(); g.restore()
  } else {
    // sparkle star: 4-point with thin diagonal glints
    g.fillStyle = '#f7c948'
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 30 : 9
      const x = Math.cos(a) * r, y = Math.sin(a) * r
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.closePath(); g.fill(); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.6)'
    g.beginPath(); g.arc(-6, -8, 4, 0, Math.PI * 2); g.fill()
  }
  g.restore()
}

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

  // space-quilt motifs (the Buzz bedspread): fixed layout so nothing reshuffles.
  // x/y are fractions of the quilt; r = rotation, s = scale
  const MOTIFS: Array<{ k: 'rocket' | 'planet' | 'star'; x: number; y: number; r: number; s: number }> = [
    { k: 'rocket', x: 0.22, y: 0.2, r: -0.6, s: 1.15 },
    { k: 'rocket', x: 0.66, y: 0.56, r: 0.8, s: 0.95 },
    { k: 'rocket', x: 0.3, y: 0.78, r: 0.15, s: 1.0 },
    { k: 'planet', x: 0.78, y: 0.18, r: 0.4, s: 1.0 },
    { k: 'planet', x: 0.13, y: 0.5, r: -0.3, s: 0.75 },
    { k: 'star', x: 0.48, y: 0.34, r: 0.2, s: 1.0 },
    { k: 'star', x: 0.86, y: 0.8, r: -0.3, s: 1.2 },
    { k: 'star', x: 0.56, y: 0.1, r: 0.5, s: 0.7 },
    { k: 'star', x: 0.08, y: 0.88, r: 0, s: 0.8 },
  ]

  registerObstacleProvider(() => [
    { x: cx - 430, y: cy, half: BED_H / 2 - 70 },
    { x: cx, y: cy, half: BED_H / 2 - 70 },
    { x: cx + 430, y: cy, half: BED_H / 2 - 70 },
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

      // ---- Andy's-bed headboard, folded UP THE EAST WALL past the head end:
      // the swoopy crest with a crescent-moon cutout, a rail with spindles, and
      // ball-finial posts. Local frame: +x = up the wall, y = along the bed. ----
      const wallX = bx0 + BED_W            // the crest springs straight off the head rail
      const SKYW = '#64abde'               // wall blue showing through the moon cutout
      g.save()
      g.translate(wallX, cy)
      const crest = (dx: number, dy: number): void => {
        g.beginPath()
        g.moveTo(dx, -470 + dy)
        g.lineTo(dx + 130, -470 + dy)
        g.bezierCurveTo(dx + 150, -250 + dy, dx + 385, -160 + dy, dx + 395, dy)
        g.bezierCurveTo(dx + 385, 160 + dy, dx + 150, 250 + dy, dx + 130, 470 + dy)
        g.lineTo(dx, 470 + dy)
        g.closePath()
      }
      crest(9, 12); g.fillStyle = 'rgba(32,26,23,0.18)'; g.fill()   // cast shadow on the wall
      crest(0, 0); g.fillStyle = '#8d5b31'; g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // wood grain following the dome
      g.strokeStyle = 'rgba(74,48,22,0.35)'; g.lineWidth = 2
      for (const k of [0.72, 0.84]) {
        g.beginPath()
        g.moveTo(118 * k, -440 * k)
        g.bezierCurveTo(150 * k, -240 * k, 385 * k, -150 * k, 395 * k, 0)
        g.bezierCurveTo(385 * k, 150 * k, 150 * k, 240 * k, 118 * k, 440 * k)
        g.stroke()
      }
      // crescent-moon cutout near the peak (the wall shows through)
      g.fillStyle = SKYW
      g.beginPath(); g.arc(272, 0, 56, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#8d5b31'
      g.beginPath(); g.arc(254, -16, 52, 0, Math.PI * 2); g.fill()
      // rail + spindles between the crest base and the mattress
      g.fillStyle = FRAME
      roundRect(g, 86, -440, 34, 880, 12); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      for (const su of [-320, -160, 0, 160, 320]) {
        g.fillStyle = '#8d5b31'
        roundRect(g, 6, su - 15, 84, 30, 12); g.fill()
        g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()
        g.beginPath(); g.arc(48, su, 8, 0, Math.PI * 2)   // turned bead
        g.fillStyle = FRAME; g.fill(); g.stroke()
      }
      // ball-finial posts flanking the crest
      for (const s of [-1, 1]) {
        g.fillStyle = 'rgba(32,26,23,0.18)'
        g.beginPath(); g.arc(70 + 6, s * 505 + 8, 48, 0, Math.PI * 2); g.fill()
        g.fillStyle = FRAME
        g.beginPath(); g.arc(70, s * 505, 48, 0, Math.PI * 2); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        g.fillStyle = '#8d5b31'
        g.beginPath(); g.arc(70, s * 505, 28, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.2; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.4)'
        g.beginPath(); g.ellipse(58, s * 505 - 12, 10, 6, -0.6, 0, Math.PI * 2); g.fill()
      }
      g.restore()

      // ---- bed ----
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, bx0 + 8, by0 + 12, BED_W, BED_H, 26); g.fill()   // hard offset shadow
      g.fillStyle = FRAME
      roundRect(g, bx0, by0, BED_W, BED_H, 26); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      // head rail: the wooden band the mattress tucks against
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

      // space quilt over the foot 2/3 of the mattress: navy field, diamond
      // quilting, rockets + planets + sparkle stars (the Buzz bedspread)
      const qx0 = bx0 + 26, qw = (BED_W - 96) * 0.64, qy0 = by0 + 26, qh = BED_H - 52
      g.save()
      roundRect(g, qx0, qy0, qw, qh, 20); g.clip()
      g.fillStyle = NAVY
      g.fillRect(qx0, qy0, qw, qh)
      // diamond quilting: two diagonal stitch families, quilted look with a
      // raised highlight above each puckered seam
      const step = 84
      const diagLine = (dir: number, off: number, col: string, lw: number): void => {
        g.strokeStyle = col; g.lineWidth = lw
        g.beginPath(); g.moveTo(qx0 + off, qy0 - 20); g.lineTo(qx0 + off + dir * (qh + 40), qy0 + qh + 20); g.stroke()
      }
      for (let off = -qh; off < qw + qh; off += step) {
        diagLine(1, off - 3, 'rgba(255,255,255,0.10)', 3)
        diagLine(1, off, 'rgba(16,24,54,0.55)', 2)
        diagLine(-1, off - 3, 'rgba(255,255,255,0.10)', 3)
        diagLine(-1, off, 'rgba(16,24,54,0.55)', 2)
      }
      // motifs, placed by fraction of the quilt
      for (const m of MOTIFS) {
        const mx = qx0 + m.x * qw, my = qy0 + m.y * qh
        drawMotif(g, mx, my, m.k, m.r, m.s * (qw / 360))
      }
      g.restore()
      g.lineWidth = 3; g.strokeStyle = INK
      roundRect(g, qx0, qy0, qw, qh, 20); g.stroke()
      // folded-back hem where the quilt meets the sheets
      g.fillStyle = '#fefaf0'
      g.fillRect(qx0 + qw - 4, qy0 + 4, 30, qh - 8)
      g.lineWidth = 2.5
      g.strokeRect(qx0 + qw - 4, qy0 + 4, 30, qh - 8)

      // pillow at the head, slightly askew — big enough for a kid, not a doll
      g.save()
      g.translate(bx0 + BED_W - 200, cy)
      g.rotate(0.05)
      g.fillStyle = 'rgba(32,26,23,0.14)'
      roundRect(g, -82 + 5, -230 + 8, 164, 460, 54); g.fill()
      g.fillStyle = '#fefaf0'
      roundRect(g, -82, -230, 164, 460, 54); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.strokeStyle = 'rgba(32,26,23,0.18)'; g.lineWidth = 2
      g.beginPath(); g.moveTo(-38, -170); g.quadraticCurveTo(0, 0, -32, 172); g.stroke()  // crease
      g.beginPath(); g.moveTo(30, -150); g.quadraticCurveTo(52, 0, 34, 148); g.stroke()
      g.restore()

      g.restore()  // end mattress squash

      // ball-finial posts at the FOOT corners, seen from above
      for (const s of [-1, 1]) {
        const px2 = bx0 + 24, py2 = cy + s * (BED_H / 2 - 4)
        g.fillStyle = 'rgba(32,26,23,0.24)'
        g.beginPath(); g.arc(px2 + 5, py2 + 8, 44, 0, Math.PI * 2); g.fill()
        g.fillStyle = FRAME
        g.beginPath(); g.arc(px2, py2, 44, 0, Math.PI * 2); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        g.fillStyle = '#8d5b31'
        g.beginPath(); g.arc(px2, py2, 26, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.2; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.4)'
        g.beginPath(); g.ellipse(px2 - 10, py2 - 11, 9, 5.5, -0.6, 0, Math.PI * 2); g.fill()
      }

      // ---- teddy on the quilt (breathes; hops when you pat the bed) ----
      const breathe = 1 + Math.sin(t / 700) * 0.02
      const raise = teddy.z * 0.75
      const shScale = Math.max(0.6, 1 - teddy.z / 500)
      g.fillStyle = `rgba(32,26,23,${Math.max(0.1, 0.22 - teddy.z / 900)})`
      g.beginPath(); g.ellipse(teddy.x + 4, teddy.y + 8, 76 * shScale, 60 * shScale, 0, 0, Math.PI * 2); g.fill()
      g.save()
      g.translate(teddy.x, teddy.y - raise)
      g.rotate(teddy.rot)
      g.scale(breathe * 1.35, breathe * 1.35)
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
