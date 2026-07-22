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

  // the oval rug, laid on the boards under the title
  drawRug(ctx)

  // the room reads calmer inside — a gentle ambient mute across the floor, then a
  // warm sunbeam from the window as the bright spot (clipped to the floor)
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, world.width, world.height); ctx.clip()
  ctx.fillStyle = 'rgba(30,22,10,0.09)'
  ctx.fillRect(0, 0, world.width, world.height)
  drawSunbeam(ctx)
  ctx.restore()

  ctx.restore()
}
