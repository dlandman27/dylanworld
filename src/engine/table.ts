import type { CameraState } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { drawWalls } from './walls'

// The world is the floor of a kid's playroom. The main ground is a wooden plank
// floor — long thin oak boards, each a slightly different tone with grain and the
// odd knot, so no two patches read the same (the cure for "the floor is all one
// color"). Flip VERTICAL to run the boards the other way. Games are TableGames.

type Ctx = CanvasRenderingContext2D
const INK = theme.colors.ink
const SEAM = 'rgba(74, 48, 22, 0.42)'  // board joints

// oak tones — a TIGHT warm band so boards vary without reading as a patchwork
const WOODS = ['#d3a163', '#d09d5f', '#d6a568', '#cd9959', '#d2a164', '#d8a86c', '#cf9b5d']
const PW = 158                   // plank WIDTH (across the grain)
const SEGL = 2000                // board LENGTH between staggered butt joints
const VERTICAL = false           // false = boards run left→right; true = top→bottom

// Andy's-room oval rug, laid under the title blocks — navy field with grey "road"
// rings (a racetrack the cars can lap later). Anchors the centre of the floor.
const RUG_CX = world.spawn.x
const RUG_CY = world.spawn.y - 440
const RUG_W = 1460
const RUG_H = 900
const RUG_TILT = -0.02
const NAVY = '#3a5a92'
const NAVY_D = '#33507f'          // subtle coil seam on navy bands (low contrast)
const CREAM = '#e9dfc6'
const CREAM_D = '#ddd2b6'         // subtle coil seam on cream bands (low contrast)
const BANDW = 68                  // width of each braided coil ring (wide = calm)

// deterministic per-cell noise in [0,1) — no Math.random, so the grain never
// shimmers between frames and stays put as the camera pans.
function rnd(a: number, b: number): number {
  let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

/** Plank floor, drawn only for the boards currently in view (cheap at any zoom). */
function drawPlanks(ctx: Ctx, cam: CameraState, canvas: HTMLCanvasElement): void {
  const vx0 = Math.max(0, cam.pos.x - canvas.width / 2 / cam.zoom)
  const vx1 = Math.min(world.width, cam.pos.x + canvas.width / 2 / cam.zoom)
  const vy0 = Math.max(0, cam.pos.y - canvas.height / 2 / cam.zoom)
  const vy1 = Math.min(world.height, cam.pos.y + canvas.height / 2 / cam.zoom)
  if (vx1 <= vx0 || vy1 <= vy0) return

  // board space: `along` = board length, `across` = board width. Map to the
  // world with P() so one code path draws either orientation.
  const alongMin = VERTICAL ? vy0 : vx0, alongMax = VERTICAL ? vy1 : vx1
  const acrossMin = VERTICAL ? vx0 : vy0, acrossMax = VERTICAL ? vx1 : vy1
  const P = (along: number, across: number): [number, number] =>
    VERTICAL ? [across, along] : [along, across]

  const c0 = Math.floor(acrossMin / PW), c1 = Math.ceil(acrossMax / PW)
  for (let c = c0; c < c1; c++) {
    const cPos = c * PW
    const base = (c * 13) % WOODS.length
    const jitter = rnd(c, 101) * SEGL            // this column's joints are offset — no brick grid
    const si0 = Math.floor((alongMin - jitter) / SEGL) - 1
    const si1 = Math.ceil((alongMax - jitter) / SEGL) + 1
    for (let si = si0; si < si1; si++) {
      const y0 = si * SEGL + jitter
      const y1 = y0 + SEGL
      if (y1 < alongMin || y0 > alongMax) continue
      // board body — base tone nudged one step, so it stays within the oak band
      ctx.fillStyle = WOODS[(base + (rnd(c, si) < 0.5 ? 0 : 1)) % WOODS.length]
      if (VERTICAL) ctx.fillRect(cPos, y0, PW, SEGL)
      else ctx.fillRect(y0, cPos, SEGL, PW)
      // grain: long faint streaks running the LENGTH of the board
      const streaks = 2 + (rnd(c, si + 5) * 3 | 0)
      ctx.lineWidth = 2
      for (let s = 0; s < streaks; s++) {
        const gv = cPos + PW * (0.14 + 0.72 * rnd(c * 5 + s, si))
        const bow = (rnd(c + s, si) - 0.5) * 9
        ctx.strokeStyle = `rgba(74,48,22,${0.05 + rnd(c, si + s) * 0.09})`
        ctx.beginPath()
        ctx.moveTo(...P(y0 + 10, gv))
        ctx.bezierCurveTo(...P(y0 + SEGL * 0.34, gv + bow), ...P(y0 + SEGL * 0.66, gv - bow), ...P(y1 - 10, gv))
        ctx.stroke()
      }
      // knot: occasional dark eye with a ring, stretched along the grain
      if (rnd(c + 3, si + 3) < 0.12) {
        const [kx, ky] = P(y0 + SEGL * (0.15 + 0.7 * rnd(c, si + 1)), cPos + PW * (0.3 + 0.4 * rnd(c + 1, si)))
        ctx.fillStyle = 'rgba(74,48,22,0.5)'
        ctx.beginPath(); ctx.ellipse(kx, ky, VERTICAL ? 6 : 8, VERTICAL ? 8 : 6, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(74,48,22,0.26)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.ellipse(kx, ky, VERTICAL ? 11 : 14, VERTICAL ? 14 : 11, 0, 0, Math.PI * 2); ctx.stroke()
      }
      // butt joint across this board's leading edge (staggered per column)
      if (y0 > alongMin && y0 < alongMax) {
        ctx.strokeStyle = SEAM; ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(...P(y0, cPos)); ctx.lineTo(...P(y0, cPos + PW)); ctx.stroke()
      }
    }
    // seam down the board's edge
    ctx.strokeStyle = SEAM; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(...P(alongMin, cPos)); ctx.lineTo(...P(alongMax, cPos)); ctx.stroke()
  }
}

function stadium(g: Ctx, cx: number, cy: number, w: number, h: number): void {
  roundRect(g, cx - w / 2, cy - h / 2, w, h, Math.min(w, h) / 2)
}

/**
 * Andy's-room braided oval rug under the title. Concentric coils of navy and
 * cream rope, each with a woven stitch texture (a darker dashed overlay whose
 * segments stagger ring-to-ring), plus a fringed edge — that coil-and-stitch is
 * what makes it read as carpet instead of a flat graphic.
 */
function drawRug(ctx: Ctx): void {
  ctx.save()
  ctx.translate(RUG_CX, RUG_CY); ctx.rotate(RUG_TILT); ctx.translate(-RUG_CX, -RUG_CY)
  ctx.lineCap = 'butt'

  // soft offset shadow — the rug lies flat on the boards
  stadium(ctx, RUG_CX + 10, RUG_CY + 16, RUG_W, RUG_H)
  ctx.fillStyle = 'rgba(32,26,23,0.15)'; ctx.fill()

  // navy base under everything
  stadium(ctx, RUG_CX, RUG_CY, RUG_W, RUG_H)
  ctx.fillStyle = NAVY; ctx.fill()

  // concentric coils, outer → in, alternating navy / cream — wide + smooth
  let d = BANDW / 2, i = 0
  while (RUG_H / 2 - d > 40) {
    const w = RUG_W - 2 * d, h = RUG_H - 2 * d
    const cream = i % 2 === 1
    // the coil band
    ctx.setLineDash([]); ctx.lineWidth = BANDW
    ctx.strokeStyle = cream ? CREAM : NAVY
    stadium(ctx, RUG_CX, RUG_CY, w, h); ctx.stroke()
    // one soft coil seam down the middle of the band — low-contrast, so it
    // hints at braided rope without the pattern vibrating
    ctx.lineWidth = Math.max(3, BANDW * 0.12)
    ctx.strokeStyle = cream ? CREAM_D : NAVY_D
    ctx.setLineDash([30, 22]); ctx.lineDashOffset = i * 15
    stadium(ctx, RUG_CX, RUG_CY, w, h); ctx.stroke()
    d += BANDW; i++
  }
  // centre cap
  ctx.setLineDash([]); ctx.lineDashOffset = 0
  const cw = RUG_W - 2 * d, ch = RUG_H - 2 * d
  if (ch > 0) {
    stadium(ctx, RUG_CX, RUG_CY, cw, ch)
    ctx.fillStyle = i % 2 === 1 ? CREAM : NAVY; ctx.fill()
  }

  // clean ink edge
  ctx.lineWidth = 6; ctx.strokeStyle = INK
  stadium(ctx, RUG_CX, RUG_CY, RUG_W, RUG_H); ctx.stroke()
  ctx.restore()
}

// The board-game corner (lower-left) is a RAISED felt table ringed by red-velvet
// barstools — the chess / Scrabble / backgammon / cards sit ON it. Same footprint
// (and felt palette) as the old zone rug it replaces, so the games keep their
// spots; the depth is faked the house way — a tall wood side-band, little front
// legs, and a hard offset shadow (see blocks.ts), never a side-view or a blur.
const GT_CX = 1280, GT_CY = 3120, GT_W = 2100, GT_H = 1560, GT_TILT = 0.03
const FELT = '#6f9a55', FELT_BORDER = '#efe4c4', FELT_STRIPE = '#c9532f'
const WOOD_TOP = '#d3a163', WOOD_SIDE = '#b5915a'
const VELVET = '#a8283c', VELVET_D = '#7d1c2b'   // plush red barstool cushion
const COIR = '#c99a5f', COIR_D = '#7a4f27'       // woven welcome-mat straw + frame
const TAU = Math.PI * 2

/** A plush red-velvet barstool seen from above: wooden legs poking out below a
 *  round tufted cushion with piping, a centre button and a soft velvet sheen. */
function drawBarstool(ctx: Ctx, cx: number, cy: number, r: number): void {
  const DEPTH = 18
  // ground shadow — hard offset, no blur
  ctx.beginPath(); ctx.ellipse(cx + 7, cy + DEPTH + 9, r, r * 0.94, 0, 0, TAU)
  ctx.fillStyle = 'rgba(32,26,23,0.20)'; ctx.fill()
  // three wooden legs splaying out below the seat (drawn before the cushion)
  ctx.lineCap = 'round'
  for (const a of [Math.PI * 0.62, Math.PI * 0.5, Math.PI * 0.38]) {
    const lx = cx + Math.cos(a) * r * 0.7, ly = cy + Math.sin(a) * r * 0.7
    const ex = cx + Math.cos(a) * r * 1.16, ey = cy + Math.sin(a) * r * 1.16 + DEPTH
    ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.stroke()
    ctx.strokeStyle = WOOD_SIDE; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(ex, ey); ctx.stroke()
  }
  // cushion thickness — the seat body offset down for the raised plush read
  ctx.beginPath(); ctx.ellipse(cx + DEPTH * 0.3, cy + DEPTH, r, r * 0.96, 0, 0, TAU)
  ctx.fillStyle = VELVET_D; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke()
  // cushion top
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.96, 0, 0, TAU)
  ctx.fillStyle = VELVET; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke()
  // piping ring just inside the rim
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.82, r * 0.78, 0, 0, TAU)
  ctx.lineWidth = 4; ctx.strokeStyle = VELVET_D; ctx.stroke()
  // tufting: radial creases pulled toward a centre button
  ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.96, r * 0.92, 0, 0, TAU); ctx.clip()
  ctx.strokeStyle = 'rgba(60,10,20,0.32)'; ctx.lineWidth = 3
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.86); ctx.stroke() }
  ctx.restore()
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.14, r * 0.13, 0, 0, TAU)
  ctx.fillStyle = VELVET_D; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,10,20,0.5)'; ctx.stroke()
  // velvet sheen — a flat translucent glint (no gradient)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath(); ctx.ellipse(cx - r * 0.34, cy - r * 0.4, r * 0.34, r * 0.16, -0.5, 0, TAU); ctx.fill()
}

/** A chunky raised wooden bench: ground shadow, a bottom-right side band for the
 *  thickness, a plank-grained top, and a bold ink edge. Grain runs the long way. */
function drawBench(ctx: Ctx, x0: number, y0: number, w: number, h: number): void {
  const r = 16, DEPTH = 24
  roundRect(ctx, x0 + 7, y0 + DEPTH + 9, w, h, r); ctx.fillStyle = 'rgba(32,26,23,0.20)'; ctx.fill()
  roundRect(ctx, x0 + DEPTH * 0.4, y0 + DEPTH, w, h, r); ctx.fillStyle = WOOD_SIDE; ctx.fill()
  roundRect(ctx, x0, y0, w, h, r); ctx.fillStyle = WOOD_TOP; ctx.fill()
  ctx.save(); roundRect(ctx, x0, y0, w, h, r); ctx.clip()
  ctx.strokeStyle = 'rgba(74,48,22,0.20)'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  if (w >= h) {
    for (let i = 1; i <= 2; i++) { const gy = y0 + (h * i) / 3; ctx.beginPath(); ctx.moveTo(x0 + 16, gy); ctx.lineTo(x0 + w - 16, gy); ctx.stroke() }
  } else {
    for (let i = 1; i <= 2; i++) { const gx = x0 + (w * i) / 3; ctx.beginPath(); ctx.moveTo(gx, y0 + 16); ctx.lineTo(gx, y0 + h - 16); ctx.stroke() }
  }
  ctx.restore()
  roundRect(ctx, x0, y0, w, h, r); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke()
}

/** A stubby wooden table leg descending from (lx, topY); the apron/top cover its
 *  upper part, so only the bit below the apron peeks out at the table's foot. */
function drawTableLeg(ctx: Ctx, lx: number, topY: number, legW: number, legLen: number): void {
  roundRect(ctx, lx + 5, topY + 6, legW, legLen, 10); ctx.fillStyle = 'rgba(32,26,23,0.20)'; ctx.fill()
  roundRect(ctx, lx, topY, legW, legLen, 10); ctx.fillStyle = WOOD_SIDE; ctx.fill()
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke()
  ctx.save(); roundRect(ctx, lx, topY, legW, legLen, 10); ctx.clip()
  ctx.fillStyle = 'rgba(32,26,23,0.14)'; ctx.fillRect(lx + legW * 0.6, topY, legW * 0.4, legLen); ctx.restore()
}

/** The raised felt games table, its little legs, and the ring of barstools. */
function drawGamesTable(ctx: Ctx): void {
  const w = GT_W, h = GT_H
  const x0 = GT_CX - w / 2, y0 = GT_CY - h / 2
  ctx.save()
  ctx.translate(GT_CX, GT_CY); ctx.rotate(GT_TILT); ctx.translate(-GT_CX, -GT_CY)

  // --- seating first, so the table draws over the inner edges (tucked in). Long
  //     sides get a wood bench; each short side gets two red-velvet barstools ---
  const bDepth = 150, bGap = 40, bInX = 200
  drawBench(ctx, x0 + bInX, y0 - bGap - bDepth, w - 2 * bInX, bDepth)   // top bench
  drawBench(ctx, x0 + bInX, y0 + h + bGap, w - 2 * bInX, bDepth)        // bottom bench
  const sr = 100, sg = sr + 14
  drawBarstool(ctx, x0 - sg, y0 + h * 0.30, sr)       // left, upper
  drawBarstool(ctx, x0 - sg, y0 + h * 0.70, sr)       // left, lower
  drawBarstool(ctx, x0 + w + sg, y0 + h * 0.30, sr)   // right, upper
  drawBarstool(ctx, x0 + w + sg, y0 + h * 0.70, sr)   // right, lower

  // --- the raised felt table (taller apron = reads higher off the floor) ---
  const DEPTH = 58, rr = 26
  // ground shadow, thrown further out by the extra height
  roundRect(ctx, x0 + 10, y0 + DEPTH + 16, w, h, rr); ctx.fillStyle = 'rgba(32,26,23,0.24)'; ctx.fill()
  // little front legs — covered by the apron above, peeking out at the foot
  const legW = 72, legLen = DEPTH + 46, legIn = 74
  drawTableLeg(ctx, x0 + legIn, y0 + h - 10, legW, legLen)              // bottom-left
  drawTableLeg(ctx, x0 + w - legIn - legW, y0 + h - 10, legW, legLen)   // bottom-right
  // wooden apron — the table's edge thickness, projecting down-right
  roundRect(ctx, x0 + DEPTH * 0.4, y0 + DEPTH, w, h, rr); ctx.fillStyle = WOOD_SIDE; ctx.fill()
  // a darker shade band down the very bottom of the apron for a rounded edge
  ctx.save(); roundRect(ctx, x0 + DEPTH * 0.4, y0 + DEPTH, w, h, rr); ctx.clip()
  ctx.fillStyle = 'rgba(32,26,23,0.16)'; ctx.fillRect(x0, y0 + DEPTH + h - 22, w + DEPTH, 22); ctx.restore()
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round'
  roundRect(ctx, x0 + DEPTH * 0.4, y0 + DEPTH, w, h, rr); ctx.stroke()
  // felt top
  roundRect(ctx, x0, y0, w, h, rr); ctx.fillStyle = FELT; ctx.fill()
  // inset cream border + coral pinstripe (same as the old rug)
  const m = 46
  ctx.lineCap = 'butt'
  ctx.strokeStyle = FELT_BORDER; ctx.lineWidth = 30
  roundRect(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, 18); ctx.stroke()
  ctx.strokeStyle = FELT_STRIPE; ctx.lineWidth = 8
  roundRect(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, 18); ctx.stroke()
  // clean ink edge around the top
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'
  roundRect(ctx, x0, y0, w, h, rr); ctx.stroke()
  ctx.restore()
}

/** The gaming-lounge rug (upper-right, under the CRT) — a wild 90s arcade carpet:
 * a dark field strewn with neon confetti (bolts, triangles, sparkles, rings). */
function drawArcadeRug(ctx: Ctx): void {
  const cx = 5340, cy = 1220, w = 1680, h = 1120, tilt = -0.03
  const x0 = cx - w / 2, y0 = cy - h / 2
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy)
  // soft offset shadow — the rug lies flat on the boards
  roundRect(ctx, x0 + 10, y0 + 16, w, h, 30); ctx.fillStyle = 'rgba(32,26,23,0.16)'; ctx.fill()
  // dark field
  roundRect(ctx, x0, y0, w, h, 30); ctx.fillStyle = '#232a4a'; ctx.fill()
  // neon confetti, clipped to the rug (seeded so it never strobes)
  ctx.save(); roundRect(ctx, x0, y0, w, h, 30); ctx.clip()
  const NEON = ['#ff5aa5', '#3fe0d0', '#b7ce3c', '#a98fd0', '#f7c948', '#f47b28', '#5aa0db']
  let s = 20099
  const rnd = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < 66; i++) {
    const px = x0 + 30 + rnd() * (w - 60), py = y0 + 30 + rnd() * (h - 60)
    const col = NEON[(rnd() * NEON.length) | 0], sz = 16 + rnd() * 30, kind = (rnd() * 4) | 0
    ctx.save(); ctx.translate(px, py); ctx.rotate(rnd() * Math.PI * 2)
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (kind === 0) { // triangle
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.86, sz * 0.5); ctx.lineTo(-sz * 0.86, sz * 0.5); ctx.closePath(); ctx.fill()
    } else if (kind === 1) { // ring
      ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, sz * 0.66, 0, Math.PI * 2); ctx.stroke()
    } else if (kind === 2) { // 4-point sparkle
      ctx.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? sz * 0.28 : sz; const a = (k * Math.PI) / 4; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) } ctx.closePath(); ctx.fill()
    } else { // zigzag bolt
      ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-sz * 0.6, -sz * 0.5); ctx.lineTo(0, -sz * 0.1); ctx.lineTo(-sz * 0.2, sz * 0.1); ctx.lineTo(sz * 0.5, sz * 0.6); ctx.stroke()
    }
    ctx.restore()
  }
  ctx.restore() // unclip
  // bright double border stripe
  const m = 44
  ctx.strokeStyle = '#ff5aa5'; ctx.lineWidth = 22; roundRect(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, 20); ctx.stroke()
  ctx.strokeStyle = '#3fe0d0'; ctx.lineWidth = 7; roundRect(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, 20); ctx.stroke()
  // clean ink edge
  ctx.lineWidth = 5; ctx.strokeStyle = INK; roundRect(ctx, x0, y0, w, h, 30); ctx.stroke()
  ctx.restore()
}

/** A coir welcome mat on the floor just inside the door (bottom wall, left of
 *  centre). Flat top-down: woven straw field, dark frame, bristle fringe, and a
 *  friendly greeting — the house style (bold ink outline + a hard offset shadow). */
function drawDoorMat(ctx: Ctx): void {
  const cx = 1616, cy = 4400, w = 700, h = 300, tilt = 0.02
  const x0 = cx - w / 2, y0 = cy - h / 2
  ctx.save()
  ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy)

  // hard offset shadow — the mat lies flat on the boards
  roundRect(ctx, x0 + 8, y0 + 12, w, h, 18); ctx.fillStyle = 'rgba(32,26,23,0.20)'; ctx.fill()
  // combed bristle fringe along the two long ends
  ctx.strokeStyle = COIR_D; ctx.lineWidth = 5; ctx.lineCap = 'round'
  const n = Math.round(w / 22)
  for (let i = 0; i <= n; i++) {
    const fx = x0 + (w * i) / n
    ctx.beginPath(); ctx.moveTo(fx, y0); ctx.lineTo(fx, y0 - 16); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(fx, y0 + h); ctx.lineTo(fx, y0 + h + 16); ctx.stroke()
  }
  // straw field
  roundRect(ctx, x0, y0, w, h, 18); ctx.fillStyle = COIR; ctx.fill()
  // woven cross-hatch, clipped to the field
  ctx.save(); roundRect(ctx, x0, y0, w, h, 18); ctx.clip()
  ctx.strokeStyle = 'rgba(74,48,22,0.13)'; ctx.lineWidth = 3
  for (let gx = x0 + 12; gx < x0 + w; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + h); ctx.stroke() }
  for (let gy = y0 + 12; gy < y0 + h; gy += 24) { ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + w, gy); ctx.stroke() }
  ctx.restore()
  // dark inset frame
  const m = 34
  ctx.strokeStyle = COIR_D; ctx.lineWidth = 14; ctx.lineJoin = 'round'
  roundRect(ctx, x0 + m, y0 + m, w - 2 * m, h - 2 * m, 12); ctx.stroke()
  // clean ink edge
  ctx.lineWidth = 5; ctx.strokeStyle = INK
  roundRect(ctx, x0, y0, w, h, 18); ctx.stroke()

  // greeting, stamped into the coir
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `900 66px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
  ctx.fillText('COME BACK', cx, cy - 38)
  ctx.font = `900 52px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
  ctx.fillText('ANYTIME', cx - 44, cy + 42)
  // a little smiley after the word
  const sxc = cx + 148, syc = cy + 42, sr = 28
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(sxc, syc, sr, 0, TAU); ctx.stroke()
  ctx.fillStyle = INK
  ctx.beginPath(); ctx.arc(sxc - 10, syc - 7, 4, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.arc(sxc + 10, syc - 7, 4, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.arc(sxc, syc + 1, 14, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke()
  ctx.restore()
}

/** Warm sunlight spilling from the top-wall window down onto the floor. */
function drawSunbeam(ctx: Ctx): void {
  const cx = world.spawn.x  // the window is centred on the top wall (x = width/2)
  // soft outer shaft, skewed down-left (the sun sits on the right of the window)
  ctx.fillStyle = 'rgba(255,236,175,0.14)'
  ctx.beginPath()
  ctx.moveTo(cx - 440, 0); ctx.lineTo(cx + 440, 0)
  ctx.lineTo(cx + 560, 1780); ctx.lineTo(cx - 1000, 1780)
  ctx.closePath(); ctx.fill()
  // brighter inner core
  ctx.fillStyle = 'rgba(255,246,205,0.12)'
  ctx.beginPath()
  ctx.moveTo(cx - 250, 0); ctx.lineTo(cx + 250, 0)
  ctx.lineTo(cx + 300, 1620); ctx.lineTo(cx - 640, 1620)
  ctx.closePath(); ctx.fill()
}

export function drawTable(ctx: Ctx, cam: CameraState, canvas: HTMLCanvasElement, _t: number): void {
  ctx.save()
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom,
    canvas.width / 2 - cam.pos.x * cam.zoom,
    canvas.height / 2 - cam.pos.y * cam.zoom)

  // the room walls (wainscot + cloud sky), folded up around the floor
  drawWalls(ctx, cam, canvas)

  // wooden playroom floor — square, so it meets the baseboards
  ctx.fillStyle = WOODS[0]; ctx.fillRect(0, 0, world.width, world.height)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, world.width, world.height); ctx.clip()
  drawPlanks(ctx, cam, canvas)
  ctx.restore()

  // the oval rug under the title, the raised games table (lower-left), then the
  // custom arcade rug (upper-right)
  drawRug(ctx)
  drawGamesTable(ctx)
  drawArcadeRug(ctx)
  drawDoorMat(ctx)

  // the room reads calmer inside — a gentle ambient mute across the floor, then a
  // warm sunbeam from the window as the bright spot (clipped to the floor)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, world.width, world.height); ctx.clip()
  ctx.fillStyle = 'rgba(30,22,10,0.09)'
  ctx.fillRect(0, 0, world.width, world.height)
  drawSunbeam(ctx)
  ctx.restore()

  ctx.restore()
}
