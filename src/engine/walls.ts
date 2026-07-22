import type { CameraState } from '../types'
import { world } from '../config/world'
import { theme } from '../config/theme'

// The playroom walls. The floor is the room; past each edge a wall FOLDS UP as a
// mitered trapezoid that splays outward — the inside-of-an-open-box look, so it
// reads as a standing wall, not wallpaper lying flat. Each wall: white bead-panel
// WAINSCOT across the lower part, a chair-rail cap, then Toy Story sky-and-clouds
// above — clouds upright to their wall and shrinking toward the top so it recedes.

type Ctx = CanvasRenderingContext2D
const INK = theme.colors.ink
const SKY = '#64abde'            // Toy Story wall blue
const CLOUD = '#f1ead4'          // soft cream cloud (no outline — calm wallpaper)
const WAINSCOT = '#edeff1'       // white lower panel
const GROOVE = '#d5d9dd'         // bead-panel groove
const RAIL = '#f6f7f8'           // chair-rail cap (bright)
const RAIL_SH = '#c2c7cd'        // rail shadow
const BASE_SH = '#cfd4d9'        // baseboard shadow line
const OUT = '#2c2519'            // beyond the wall top — dark room shadow
const D = 900                    // wall depth (out from the floor edge)
const WAIN_H = 300               // wainscot height up the wall

// top-wall window, in wall-space (t = along the wall, s = depth up it)
const GLASS = '#a6d8f4'          // brighter "outside" sky
const SASH = '#f6f7f8'           // white frame + muntins
const SUN = '#f7c948'
const WIN_T = 0.5                // centre along the wall
const WIN_TW = 0.11              // half-width in t
const WIN_S0 = 0.37              // sill height up the wall
const WIN_S1 = 0.62              // top of the glass
const WIN_COLS = 3               // panes across
const WIN_ROWS = 2               // panes tall

interface V { x: number; y: number }
const lerp = (a: V, b: V, s: number): V => ({ x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s })

// deterministic per-cell noise in [0,1) — clouds stay put frame to frame
function rnd(a: number, b: number): number {
  let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

// one flat-bottomed cartoon cloud, drawn in local space bumping toward -y
function cloud(ctx: Ctx, scale: number): void {
  const n = 5
  const halfW = 150 * scale, rMax = 70 * scale
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5
    const r = rMax * (0.5 + 0.5 * Math.cos(t * Math.PI))
    const x = t * 2 * (halfW - rMax * 0.5)
    ctx.moveTo(x + r, -r); ctx.arc(x, -r, r, 0, Math.PI * 2)  // bottoms rest on y=0
  }
  ctx.fill()
}

function quad(ctx: Ctx, a: V, b: V, c: V, d: V): void {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath()
}

/** A window on the wall — frame, panes, sill, and a sunny "outside", all mapped
 * through the wall's P(t,s) so it foreshortens with the fold. */
function drawWindow(ctx: Ctx, P: (t: number, s: number) => V, upAngle: number): void {
  const t0 = WIN_T - WIN_TW, t1 = WIN_T + WIN_TW, s0 = WIN_S0, s1 = WIN_S1
  const ft = (t1 - t0) * 0.06, fs = (s1 - s0) * 0.1
  const fillQ = (ta: number, tb: number, sa: number, sb: number, col: string): void => {
    quad(ctx, P(ta, sa), P(tb, sa), P(tb, sb), P(ta, sb)); ctx.fillStyle = col; ctx.fill()
  }
  // offset shadow cast on the wall
  fillQ(t0 - ft + 0.006, t1 + ft + 0.006, s0 - fs - 0.016, s1 + fs - 0.016, 'rgba(32,26,23,0.15)')
  // white sash frame, then glass
  fillQ(t0 - ft, t1 + ft, s0 - fs, s1 + fs, SASH)
  fillQ(t0, t1, s0, s1, GLASS)
  // outside: sun + a drifting cloud, clipped to the glass
  const g0 = P(t0, s0), g1 = P(t1, s0)
  ctx.save(); quad(ctx, g0, g1, P(t1, s1), P(t0, s1)); ctx.clip()
  const sunR = Math.hypot(g1.x - g0.x, g1.y - g0.y) * 0.12
  const sun = P(t0 + (t1 - t0) * 0.24, s0 + (s1 - s0) * 0.66)
  ctx.fillStyle = SUN; ctx.beginPath(); ctx.arc(sun.x, sun.y, sunR, 0, Math.PI * 2); ctx.fill()
  const cl = P(t0 + (t1 - t0) * 0.66, s0 + (s1 - s0) * 0.36)
  ctx.save(); ctx.translate(cl.x, cl.y); ctx.rotate(upAngle); ctx.fillStyle = CLOUD; cloud(ctx, 0.7); ctx.restore()
  ctx.restore()
  // muntins (glazing bars)
  const bt = (t1 - t0) * 0.028, bs = (s1 - s0) * 0.04
  for (let i = 1; i < WIN_COLS; i++) { const tt = t0 + (t1 - t0) * i / WIN_COLS; fillQ(tt - bt, tt + bt, s0, s1, SASH) }
  for (let j = 1; j < WIN_ROWS; j++) { const ss = s0 + (s1 - s0) * j / WIN_ROWS; fillQ(t0, t1, ss - bs, ss + bs, SASH) }
  // ink outline around the frame
  quad(ctx, P(t0 - ft, s0 - fs), P(t1 + ft, s0 - fs), P(t1 + ft, s1 + fs), P(t0 - ft, s1 + fs))
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
  // sill: a ledge just below the frame, a touch wider
  fillQ(t0 - ft - 0.022, t1 + ft + 0.022, s0 - fs - 0.03, s0 - fs, SASH)
  quad(ctx, P(t0 - ft - 0.022, s0 - fs - 0.03), P(t1 + ft + 0.022, s0 - fs - 0.03), P(t1 + ft + 0.022, s0 - fs), P(t0 - ft - 0.022, s0 - fs))
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
}

/** One folded wall: floor edge p0→p1, splayed outer edge q0→q1 (trapezoid). */
function drawWall(ctx: Ctx, p0: V, p1: V, q0: V, q1: V, seed: number, withWindow = false): void {
  // P(t, s): point at fraction t along the wall, depth s outward (0=floor,1=top)
  const P = (t: number, s: number): V => lerp(lerp(p0, q0, s), lerp(p1, q1, s), t)

  quad(ctx, p0, p1, q1, q0); ctx.fillStyle = SKY; ctx.fill()
  ctx.save(); quad(ctx, p0, p1, q1, q0); ctx.clip()

  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  const upAngle = Math.atan2(dy, dx)   // rotate clouds so their tops face up the wall (outward)
  const sW = WAIN_H / D

  // clouds in the sky band above the wainscot — scattered in height and size,
  // not on a rigid grid, so it reads as hand-painted wallpaper
  const rows = 3
  const cols = Math.max(3, Math.round(len / 480))
  const band = (1 - sW) / rows
  ctx.fillStyle = CLOUD
  for (let si = 0; si < rows; si++) {
    for (let ti = 0; ti < cols; ti++) {
      const s = sW + band * (si + 0.15 + 0.7 * rnd(seed * 3 + ti, si * 7))  // jitter height up the wall
      const t = (ti + 0.1 + 0.8 * rnd(seed * 9 + ti, si)) / cols            // jitter along the wall
      const c = P(t, s)
      const scale = (1 - s * 0.5) * (0.5 + 0.95 * rnd(ti + seed, si * 5))   // foreshorten × size variety
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(upAngle)
      cloud(ctx, scale)
      ctx.restore()
    }
  }

  // wainscot panel across the lower wall
  quad(ctx, p0, p1, P(1, sW), P(0, sW)); ctx.fillStyle = WAINSCOT; ctx.fill()
  // vertical bead grooves running up the panel
  ctx.strokeStyle = GROOVE; ctx.lineWidth = 2
  const grooves = Math.max(2, Math.round(len / 150))
  for (let gi = 1; gi < grooves; gi++) {
    const a = P(gi / grooves, 0.02), b = P(gi / grooves, sW * 0.95)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  // baseboard shadow line near the floor
  ctx.strokeStyle = BASE_SH; ctx.lineWidth = 4
  const ba = P(0, 0.055), bb = P(1, 0.055)
  ctx.beginPath(); ctx.moveTo(ba.x, ba.y); ctx.lineTo(bb.x, bb.y); ctx.stroke()
  // chair-rail cap at the top of the wainscot
  quad(ctx, P(0, sW), P(1, sW), P(1, sW + 0.028), P(0, sW + 0.028)); ctx.fillStyle = RAIL; ctx.fill()
  ctx.strokeStyle = RAIL_SH; ctx.lineWidth = 3
  const ra = P(0, sW + 0.028), rb = P(1, sW + 0.028)
  ctx.beginPath(); ctx.moveTo(ra.x, ra.y); ctx.lineTo(rb.x, rb.y); ctx.stroke()

  // the window sits on this wall (drawn last so its sill rests on the chair rail)
  if (withWindow) drawWindow(ctx, P, upAngle)

  ctx.restore()

  // ink line at the floor seam (the crisp "wall meets floor" edge)
  ctx.strokeStyle = INK; ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
}

/** Draw the four folded walls around the floor. Call before the floor. */
export function drawWalls(ctx: Ctx, _cam: CameraState, _canvas: HTMLCanvasElement): void {
  const W = world.width, H = world.height
  // beyond the wall tops — dark, so you never see past the room
  ctx.fillStyle = OUT
  ctx.fillRect(-D - 900, -D - 900, W + 2 * (D + 900), H + 2 * (D + 900))

  const A = { x: 0, y: 0 }, B = { x: W, y: 0 }, C = { x: W, y: H }, E = { x: 0, y: H }
  const Ao = { x: -D, y: -D }, Bo = { x: W + D, y: -D }, Co = { x: W + D, y: H + D }, Eo = { x: -D, y: H + D }

  drawWall(ctx, A, B, Ao, Bo, 1, true)  // top (with the window)
  drawWall(ctx, B, C, Bo, Co, 2)  // right
  drawWall(ctx, C, E, Co, Eo, 3)  // bottom
  drawWall(ctx, E, A, Eo, Ao, 4)  // left

  // fold creases at the corners, so the box read is unmistakable
  ctx.strokeStyle = 'rgba(32,26,23,0.22)'; ctx.lineWidth = 3
  for (const [a, b] of [[A, Ao], [B, Bo], [C, Co], [E, Eo]] as const) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
}
