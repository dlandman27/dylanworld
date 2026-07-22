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
const RAIL = '#ccd2d8'           // chair-rail top face — shaded, so it reads as a receding shelf
const BASE_SH = '#cfd4d9'        // baseboard fascia (shaded)
const OUT = '#2c2519'            // beyond the wall top — dark room shadow
const D = 900                    // wall depth (out from the floor edge)
const WAIN_H = 300               // wainscot height up the wall

// top-wall window, in wall-space (t = along the wall, s = depth up it)
const GLASS = '#a6d8f4'          // brighter "outside" sky
const SASH = '#f6f7f8'           // white frame + muntins
const SUN = '#f7c948'
const WIN_T = 0.5                // centre along the wall
const WIN_TW = 0.07              // half-width in t
const WIN_S0 = 0.365             // bottom of the glass, up the wall (sits at the wainscot top)
const WIN_S1 = 0.71              // top of the glass
const SILL_TOP = '#fbfcfc'       // lit top face of the sill ledge
const SILL_FRONT = '#ccd1d7'     // shaded front face (the thickness)
const SILL_THK = 34              // how far the sill lip juts toward the room
const JAMB_SH = '#a6aeb6'        // recessed jamb face in shadow (top/left)
const JAMB_LIT = '#eef1f3'       // recessed jamb face in light (bottom/right)

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

/** A window on the wall — built-up casing, recessed panes, a molded sill, and a
 * sunny "outside", all mapped through the wall's P(t,s) so it foreshortens with
 * the fold. */
function drawWindow(ctx: Ctx, P: (t: number, s: number) => V, upAngle: number): void {
  const t0 = WIN_T - WIN_TW, t1 = WIN_T + WIN_TW, s0 = WIN_S0, s1 = WIN_S1
  const ft = (t1 - t0) * 0.095, fs = (s1 - s0) * 0.085  // built-up molding on the wall surface
  const fillQ = (ta: number, tb: number, sa: number, sb: number, col: string): void => {
    quad(ctx, P(ta, sa), P(tb, sa), P(tb, sb), P(ta, sb)); ctx.fillStyle = col; ctx.fill()
  }
  const line = (a: V, b: V, col: string, lw: number): void => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  // a raised molding step: top+left catch light, bottom+right fall to shadow
  const bevel = (ta: number, tb: number, sa: number, sb: number): void => {
    const A = P(ta, sa), B = P(tb, sa), C = P(tb, sb), Dd = P(ta, sb)
    line(Dd, C, 'rgba(255,255,255,0.85)', 2.5)   // top
    line(A, Dd, 'rgba(255,255,255,0.65)', 2.5)   // left
    line(A, B, 'rgba(120,130,142,0.5)', 2.5)     // bottom
    line(B, C, 'rgba(120,130,142,0.4)', 2.5)     // right
  }

  // ---- ONE-POINT PERSPECTIVE: front opening corners + a single vanishing point ----
  const FBL = P(t0, s0), FBR = P(t1, s0), FTL = P(t0, s1), FTR = P(t1, s1)
  const lp = (p: V, q: V, f: number): V => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f })
  // the VP sits HIGH INSIDE the opening: the recess converges up to it while the
  // glass stays framed by the opening (it can never poke out above the top edge).
  const VP = lp(lp(FBL, FBR, 0.5), lp(FTL, FTR, 0.5), 0.82)
  const away = (p: V, dist: number): V => {                // push a point away from the VP (toward the viewer)
    const dx = p.x - VP.x, dy = p.y - VP.y, L = Math.hypot(dx, dy) || 1
    return { x: p.x + dx / L * dist, y: p.y + dy / L * dist }
  }
  const poly = (pts: V[], col: string): void => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.fillStyle = col; ctx.fill()
  }
  const inkPoly = (pts: V[], col: string, lw: number): void => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
  }
  // glass = the opening scaled toward the VP → a recessed, converging back plane
  const GBL = lp(FBL, VP, 0.24), GBR = lp(FBR, VP, 0.24), GTL = lp(FTL, VP, 0.24), GTR = lp(FTR, VP, 0.24)
  const gpt = (u: number, v: number): V => lp(lp(GBL, GBR, u), lp(GTL, GTR, u), v)  // v: 0 bottom → 1 top

  // built-up casing molding on the wall: outer trim board + a stepped inner band
  fillQ(t0 - ft, t1 + ft, s0 - fs, s1 + fs, SASH)
  bevel(t0 - ft, t1 + ft, s0 - fs, s1 + fs)
  fillQ(t0 - ft * 0.5, t1 + ft * 0.5, s0 - fs * 0.5, s1 + fs * 0.5, '#e6e9ec')
  bevel(t0 - ft * 0.5, t1 + ft * 0.5, s0 - fs * 0.5, s1 + fs * 0.5)

  // ---- REVEAL: four interior faces, every depth-edge converging to the VP ----
  poly([FBL, FBR, GBR, GBL], '#fbfcfd')   // bottom: deep sill well (lit)
  poly([FTL, FTR, GTR, GTL], JAMB_SH)     // top: head, raking back (shadow)
  poly([FBL, FTL, GTL, GBL], JAMB_LIT)    // left reveal (lit)
  poly([FBR, FTR, GTR, GBR], '#c9cfd5')   // right reveal (shaded)

  // ---- recessed glass: the outside, far away, with blinds ----
  poly([GBL, GBR, GTR, GTL], GLASS)
  ctx.save(); ctx.beginPath()
  ctx.moveTo(GBL.x, GBL.y); ctx.lineTo(GBR.x, GBR.y); ctx.lineTo(GTR.x, GTR.y); ctx.lineTo(GTL.x, GTL.y); ctx.closePath(); ctx.clip()
  const gw = Math.hypot(GBR.x - GBL.x, GBR.y - GBL.y)
  const sunP = gpt(0.72, 0.52)
  ctx.fillStyle = 'rgba(247,201,72,0.3)'; ctx.beginPath(); ctx.arc(sunP.x, sunP.y, gw * 0.15, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = SUN; ctx.beginPath(); ctx.arc(sunP.x, sunP.y, gw * 0.085, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = CLOUD
  for (const [u, v, sc] of [[0.24, 0.34, 0.4], [0.52, 0.66, 0.44], [0.8, 0.7, 0.3]] as const) {
    const cp = gpt(u, v)
    ctx.save(); ctx.translate(cp.x, cp.y); ctx.rotate(upAngle); cloud(ctx, sc * (1.2 - v * 0.5)); ctx.restore()
  }
  poly([GBL, GBR, GTR, GTL], 'rgba(255,255,255,0.08)')   // atmospheric haze
  const slats = 7
  for (let k = 1; k <= slats; k++) {
    const v = k / (slats + 1), h = 0.028
    poly([gpt(0, v - h - 0.014), gpt(1, v - h - 0.014), gpt(1, v - h), gpt(0, v - h)], 'rgba(40,60,80,0.16)')  // slat shadow
    poly([gpt(0, v - h), gpt(1, v - h), gpt(1, v + h), gpt(0, v + h)], '#eef2f5')                              // slat
  }
  ctx.strokeStyle = 'rgba(205,212,218,0.85)'; ctx.lineWidth = 2
  for (const u of [0.34, 0.66]) { const a = gpt(u, 0), b = gpt(u, 1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
  ctx.restore()

  // ambient occlusion in the inner corners + crisp edges
  inkPoly([GBL, GBR, GTR, GTL], 'rgba(20,26,32,0.3)', 6)
  inkPoly([GBL, GBR, GTR, GTL], INK, 2.5)
  inkPoly([FBL, FBR, FTR, FTL], INK, 3.5)
  quad(ctx, P(t0 - ft, s0 - fs), P(t1 + ft, s0 - fs), P(t1 + ft, s1 + fs), P(t0 - ft, s1 + fs)); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()

  // ---- crown molding (top): a thin cornice projecting toward the room, → VP ----
  const BcL = P(t0 - ft, s1 + fs), BcR = P(t1 + ft, s1 + fs)
  const FcL = lp(BcL, VP, 0.3), FcR = lp(BcR, VP, 0.3)     // front edge toward the viewer (converges to VP)
  const FcL2 = { x: FcL.x, y: FcL.y + 15 }, FcR2 = { x: FcR.x, y: FcR.y + 15 }
  poly([{ x: FcL.x + 5, y: FcL2.y + 6 }, { x: FcR.x + 5, y: FcR2.y + 6 }, { x: FcR.x + 5, y: FcR2.y + 16 }, { x: FcL.x + 5, y: FcL2.y + 16 }], 'rgba(32,26,23,0.12)')  // shadow on wall
  poly([FcL, FcR, FcR2, FcL2], '#d6dbe0')                  // front fascia (the thickness)
  inkPoly([FcL, FcR, FcR2, FcL2], INK, 3.5)
  poly([BcL, BcR, FcR, FcL], '#f3f5f7')                    // top face, converging to the VP
  inkPoly([BcL, BcR, FcR, FcL], INK, 3.5)
  line(FcL, FcR, 'rgba(255,255,255,0.85)', 2)

  // ---- sill molding (bottom): a thick ledge whose top face converges to the VP ----
  const so = (t1 - t0) * 0.14   // sill overhang past the casing — scales with window width
  const SbL = P(t0 - ft - so, s0 - fs), SbR = P(t1 + ft + so, s0 - fs)
  const SfL = away(SbL, 92), SfR = away(SbR, 92)
  poly([{ x: SbL.x + 8, y: SbL.y + 12 }, { x: SbR.x + 8, y: SbR.y + 12 }, { x: SfR.x + 8, y: SfR.y + 22 }, { x: SfL.x + 8, y: SfL.y + 22 }], 'rgba(32,26,23,0.16)')  // cast shadow
  const SfL2 = { x: SfL.x, y: SfL.y + SILL_THK }, SfR2 = { x: SfR.x, y: SfR.y + SILL_THK }
  poly([SfL, SfR, SfR2, SfL2], SILL_FRONT)                 // front thickness
  inkPoly([SfL, SfR, SfR2, SfL2], INK, 4)
  const inN = (SfR2.x - SfL2.x) * 0.08
  const apL = { x: SfL2.x + inN, y: SfL2.y }, apR = { x: SfR2.x - inN, y: SfR2.y }
  poly([apL, apR, { x: apR.x, y: apR.y + SILL_THK * 0.6 }, { x: apL.x, y: apL.y + SILL_THK * 0.6 }], '#c3c8ce')  // apron
  inkPoly([apL, apR, { x: apR.x, y: apR.y + SILL_THK * 0.6 }, { x: apL.x, y: apL.y + SILL_THK * 0.6 }], INK, 3.5)
  poly([SbL, SbR, SfR, SfL], SILL_TOP)                     // top cap (converging to VP), lit
  inkPoly([SbL, SbR, SfR, SfL], INK, 4)
  line(SfL, SfR, 'rgba(255,255,255,0.9)', 2)
}

// pennant bunting palette — the house accents, cycled along the string
const PENNANT = ['#f0563e', '#5aa0db', '#b7ce3c', '#f47b28', '#a98fd0', '#ff7fa5', '#2fb0a3', '#f7c948']

/** Two short pennant garlands flanking the window. Flags are built in WORLD units
 * (so they never stretch) and rotated to the string's local tangent, so they fan
 * around the swag instead of all hanging straight down. */
function drawBunting(ctx: Ctx, P: (t: number, s: number) => V): void {
  const sTop = 0.9, sag = 0.045    // how high the cord hangs + its centre droop
  const flagW = 48, flagH = 64     // world half-width + length of each pennant
  const cordS = (u: number): number => sTop - sag * Math.sin(Math.PI * u)

  const garland = (tA: number, tB: number, n: number, c0: number): void => {
    const at = (u: number): V => P(tA + (tB - tA) * u, cordS(u))
    const flags: { aL: V; aR: V; tip: V; col: string }[] = []
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n
      const c = at(u)
      const a = at(Math.max(0, u - 0.5 / n)), b = at(Math.min(1, u + 0.5 / n))
      let tx = b.x - a.x, ty = b.y - a.y; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L  // tangent
      const dref = P(tA + (tB - tA) * u, cordS(u) - 0.05)        // "down the wall" reference
      let px = -ty, py = tx                                       // perpendicular → point it down
      if (px * (dref.x - c.x) + py * (dref.y - c.y) < 0) { px = -px; py = -py }
      flags.push({
        aL: { x: c.x - tx * flagW, y: c.y - ty * flagW },
        aR: { x: c.x + tx * flagW, y: c.y + ty * flagW },
        tip: { x: c.x + px * flagH, y: c.y + py * flagH },
        col: PENNANT[(k + c0) % PENNANT.length],
      })
    }
    // drop-shadows
    ctx.fillStyle = 'rgba(32,26,23,0.13)'
    for (const f of flags) { ctx.beginPath(); ctx.moveTo(f.aL.x + 4, f.aL.y + 6); ctx.lineTo(f.aR.x + 4, f.aR.y + 6); ctx.lineTo(f.tip.x + 4, f.tip.y + 6); ctx.closePath(); ctx.fill() }
    // the string
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i <= 24; i++) { const p = at(i / 24); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y) }
    ctx.stroke()
    // the flags
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round'
    for (const f of flags) {
      ctx.beginPath(); ctx.moveTo(f.aL.x, f.aL.y); ctx.lineTo(f.aR.x, f.aR.y); ctx.lineTo(f.tip.x, f.tip.y); ctx.closePath()
      ctx.fillStyle = f.col; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke()
    }
  }

  garland(0.08, 0.42, 9, 0)   // left of the window
  garland(0.58, 0.92, 9, 3)   // right of the window
}

// a world point at offset (sx along-wall, sy up-wall) in world units from (tc,sc)
function wpt(P: (t: number, s: number) => V, tc: number, sc: number, sx: number, sy: number): V {
  const c = P(tc, sc)
  const a = P(tc + 0.006, sc), b = P(tc - 0.006, sc)
  let ax = a.x - b.x, ay = a.y - b.y; let l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l
  const u1 = P(tc, sc + 0.008), u2 = P(tc, sc - 0.008)
  let ux = u1.x - u2.x, uy = u1.y - u2.y; l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l
  return { x: c.x + ax * sx + ux * sy, y: c.y + ay * sx + uy * sy }
}

/** A light switch — a plate that stands proud of the wall with a drop shadow and
 * a recessed rocker. */
function drawSwitch(ctx: Ctx, P: (t: number, s: number) => V, tc: number, sc: number): void {
  const w = (sx: number, sy: number): V => wpt(P, tc, sc, sx, sy)
  const sh = (p: V): V => ({ x: p.x + 5, y: p.y + 7 })
  ctx.fillStyle = 'rgba(32,26,23,0.16)'
  quad(ctx, sh(w(-15, -25)), sh(w(15, -25)), sh(w(15, 25)), sh(w(-15, 25))); ctx.fill()   // drop shadow
  quad(ctx, w(-15, -25), w(15, -25), w(15, 25), w(-15, 25)); ctx.fillStyle = '#f4f5f6'; ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke()
  const L = (a: V, b: V, col: string): void => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
  L(w(-15, 25), w(15, 25), 'rgba(255,255,255,0.85)'); L(w(-15, -25), w(15, -25), 'rgba(120,130,142,0.45)')  // bevel
  quad(ctx, w(-5, -12), w(5, -12), w(5, 12), w(-5, 12)); ctx.fillStyle = '#c9ced3'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke()  // well
  quad(ctx, w(-4, -2), w(4, -2), w(4, 11), w(-4, 11)); ctx.fillStyle = '#eef1f3'; ctx.fill(); ctx.stroke()  // rocker (flipped up)
}

/** A two-socket outlet — a proud plate with recessed sockets and prong slots. */
function drawOutlet(ctx: Ctx, P: (t: number, s: number) => V, tc: number, sc: number): void {
  const w = (sx: number, sy: number): V => wpt(P, tc, sc, sx, sy)
  const sh = (p: V): V => ({ x: p.x + 5, y: p.y + 7 })
  ctx.fillStyle = 'rgba(32,26,23,0.16)'
  quad(ctx, sh(w(-16, -22)), sh(w(16, -22)), sh(w(16, 22)), sh(w(-16, 22))); ctx.fill()   // drop shadow
  quad(ctx, w(-16, -22), w(16, -22), w(16, 22), w(-16, 22)); ctx.fillStyle = '#f4f5f6'; ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke()
  const L = (a: V, b: V, col: string): void => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
  L(w(-16, 22), w(16, 22), 'rgba(255,255,255,0.85)'); L(w(-16, -22), w(16, -22), 'rgba(120,130,142,0.45)')  // bevel
  for (const oy of [9, -9]) {
    quad(ctx, w(-7, oy - 7), w(7, oy - 7), w(7, oy + 7), w(-7, oy + 7)); ctx.fillStyle = '#dfe3e6'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke()  // recessed socket
    ctx.fillStyle = '#3a4048'
    quad(ctx, w(-3, oy - 4), w(-1.5, oy - 4), w(-1.5, oy + 1), w(-3, oy + 1)); ctx.fill()
    quad(ctx, w(1.5, oy - 4), w(3, oy - 4), w(3, oy + 1), w(1.5, oy + 1)); ctx.fill()
  }
}

/** A paneled door — built exactly the way the window is: a doorway RECESSED
 * into the wall's thickness. Flat built-up casing on the wall, jamb reveals
 * converging to a single vanishing point high inside the opening, the slab set
 * back on the recessed plane, and a threshold well at the floor. */
function drawDoor(ctx: Ctx, P: (t: number, s: number) => V, dt0: number, dt1: number): void {
  const s0 = 0.0, s1 = 0.78
  const ft = (dt1 - dt0) * 0.17, fs = (s1 - s0) * 0.055   // casing scales with the door
  const lp2 = (p: V, q: V, f: number): V => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f })
  const poly = (pts: V[], col: string): void => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.fillStyle = col; ctx.fill()
  }
  const inkPoly = (pts: V[], col: string, lw: number): void => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke()
  }
  const line = (a: V, b: V, col: string, lw: number): void => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  const fillQ = (ta: number, tb: number, sa: number, sb: number, col: string): void => {
    quad(ctx, P(ta, sa), P(tb, sa), P(tb, sb), P(ta, sb)); ctx.fillStyle = col; ctx.fill()
  }
  const bevel = (ta: number, tb: number, sa: number, sb: number): void => {
    const A = P(ta, sa), B = P(tb, sa), C = P(tb, sb), Dd = P(ta, sb)
    line(Dd, C, 'rgba(255,255,255,0.85)', 2.5)
    line(A, Dd, 'rgba(255,255,255,0.65)', 2.5)
    line(A, B, 'rgba(120,130,142,0.5)', 2.5)
    line(B, C, 'rgba(120,130,142,0.4)', 2.5)
  }

  // front opening corners (B = floor seam, T = head) + the vanishing point
  const FBL = P(dt0, s0), FBR = P(dt1, s0), FTL = P(dt0, s1), FTR = P(dt1, s1)
  const VP = lp2(lp2(FBL, FBR, 0.5), lp2(FTL, FTR, 0.5), 0.85)
  const rec = 0.085                                       // a door sits shallow in its jamb
  const DBL = lp2(FBL, VP, rec), DBR = lp2(FBR, VP, rec), DTL = lp2(FTL, VP, rec), DTR = lp2(FTR, VP, rec)
  const dpt = (u: number, v: number): V => lp2(lp2(DBL, DBR, u), lp2(DTL, DTR, u), v)  // u 0→1 hinge→latch, v 0 floor →1 head

  // cast shadow on the wall (offset down-right) — lifts the casing off the wall
  const so = (ta: number, sa: number): V => { const p = P(ta, sa); return { x: p.x + 10, y: p.y + 11 } }
  quad(ctx, so(dt0 - ft, s0), so(dt1 + ft, s0), so(dt1 + ft, s1 + fs), so(dt0 - ft, s1 + fs))
  ctx.fillStyle = 'rgba(32,26,23,0.12)'; ctx.fill()

  // built-up casing FLAT on the wall (like the window): outer board + inner band
  fillQ(dt0 - ft, dt1 + ft, s0, s1 + fs, SASH)
  bevel(dt0 - ft, dt1 + ft, s0, s1 + fs)
  fillQ(dt0 - ft * 0.5, dt1 + ft * 0.5, s0, s1 + fs * 0.5, '#e6e9ec')
  bevel(dt0 - ft * 0.5, dt1 + ft * 0.5, s0, s1 + fs * 0.5)

  // ---- REVEAL: the four inside faces of the doorway, converging to the VP.
  // NOTE this door hangs on the BOTTOM wall, which folds down-screen — so shading
  // follows SCREEN light (upper-left), not wall space, or the recess reads flipped.
  poly([FTL, FTR, DTR, DTL], JAMB_LIT)     // head (screen-bottom face → catches light)
  poly([FBL, FTL, DTL, DBL], JAMB_LIT)     // hinge-side jamb
  poly([FBR, FTR, DTR, DBR], '#c9cfd5')    // latch-side jamb (shaded)
  poly([FBL, FBR, DBR, DBL], '#9a7747')    // threshold well: worn wood (screen-top face → in shade)
  line(lp2(FBL, DBL, 0.55), lp2(FBR, DBR, 0.55), 'rgba(74,48,22,0.4)', 2.5)  // threshold seam

  // ---- the slab, set back on the recessed plane ----
  poly([DBL, DBR, DTR, DTL], '#e9ebee')
  // six recessed panels, each with real reveal faces (light from the head side)
  const u0 = 0.15, u1 = 0.85, v0 = 0.075, v1 = 0.94
  const gU = 0.07, gV = 0.028
  for (let c = 0; c < 2; c++) for (let r = 0; r < 3; r++) {
    const a0 = u0 + (u1 - u0) * (c / 2) + gU / 2, a1 = u0 + (u1 - u0) * ((c + 1) / 2) - gU / 2
    const b0 = v0 + (v1 - v0) * (r / 3) + gV / 2, b1 = v0 + (v1 - v0) * ((r + 1) / 3) - gV / 2
    const ia = (a1 - a0) * 0.16, ib = (b1 - b0) * 0.12
    const i0 = a0 + ia, i1 = a1 - ia, j0 = b0 + ib, j1 = b1 - ib
    poly([dpt(a0, b1), dpt(a1, b1), dpt(i1, j1), dpt(i0, j1)], '#fbfcfd')   // head-side reveal (screen-bottom → light)
    poly([dpt(a0, b0), dpt(a0, b1), dpt(i0, j1), dpt(i0, j0)], '#d2d7dc')   // hinge-side reveal
    poly([dpt(a0, b0), dpt(a1, b0), dpt(i1, j0), dpt(i0, j0)], '#ccd1d6')   // floor-side reveal (screen-top → shadow)
    poly([dpt(a1, b0), dpt(a1, b1), dpt(i1, j1), dpt(i1, j0)], '#f3f5f7')   // latch-side reveal (light)
    poly([dpt(i0, j0), dpt(i1, j0), dpt(i1, j1), dpt(i0, j1)], '#e3e6e9')   // sunken face
    inkPoly([dpt(i0, j0), dpt(i1, j0), dpt(i1, j1), dpt(i0, j1)], INK, 1.5)
    inkPoly([dpt(a0, b0), dpt(a1, b0), dpt(a1, b1), dpt(a0, b1)], INK, 1.8)
  }

  // hinges on the hinge side: three steel knuckles peeking past the jamb
  const doorW = Math.hypot(DBR.x - DBL.x, DBR.y - DBL.y)
  for (const hv of [0.16, 0.5, 0.84]) {
    const h0 = dpt(0.015, hv - 0.035), h1 = dpt(0.015, hv + 0.035)
    const h2 = dpt(0.055, hv + 0.035), h3 = dpt(0.055, hv - 0.035)
    poly([h0, h1, h2, h3], '#c9ced3')
    inkPoly([h0, h1, h2, h3], INK, 1.8)
  }

  // brass knob on the latch side: slim rosette plate, a knob with a crescent
  // shade (the sanctioned metal treatment) and a keyhole. The whole assembly is
  // drawn in the DOOR'S local frame (rotated with the fold), like the panels —
  // a screen-upright lock on a leaning door reads pasted-on.
  const kc = dpt(0.92, 0.46)
  const kr = doorW * 0.042
  const va = dpt(0.92, 0.4), vb = dpt(0.92, 0.52)
  const doorAng = Math.atan2(vb.y - va.y, vb.x - va.x)   // direction of increasing v (floor → head)
  ctx.save()
  ctx.translate(kc.x, kc.y)
  ctx.rotate(doorAng - Math.PI / 2)
  // local frame: +y runs toward the door's head, -y toward its floor end
  // cast shadow on the slab
  ctx.fillStyle = 'rgba(32,26,23,0.18)'
  ctx.beginPath(); ctx.ellipse(kr * 0.5, kr * 0.6, kr * 1.35, kr * 1.05, 0, 0, Math.PI * 2); ctx.fill()
  // rosette backplate — extends toward the floor end, where the keyhole lives
  ctx.fillStyle = '#cbd0d5'
  ctx.beginPath(); ctx.ellipse(0, -kr * 0.55, kr * 1.3, kr * 2.1, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke()
  // keyhole: circle nearest the knob, wedge flaring toward the floor end
  const ky = -kr * 1.9
  ctx.fillStyle = INK
  ctx.beginPath(); ctx.arc(0, ky, kr * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-kr * 0.14, ky); ctx.lineTo(kr * 0.14, ky); ctx.lineTo(kr * 0.26, ky - kr * 0.55); ctx.lineTo(-kr * 0.26, ky - kr * 0.55); ctx.closePath(); ctx.fill()
  // the knob: flat brass disc + crescent shadow for the turned-metal read
  ctx.fillStyle = '#e9c96c'
  ctx.beginPath(); ctx.arc(0, 0, kr, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke()
  ctx.fillStyle = 'rgba(32,26,23,0.16)'
  ctx.beginPath()
  ctx.arc(0, 0, kr * 0.92, 0, Math.PI * 2)
  ctx.arc(-kr * 0.18, -kr * 0.2, kr * 0.86, 0, Math.PI * 2, true)
  ctx.fill()
  // collar ring + glint
  ctx.strokeStyle = 'rgba(120,90,20,0.5)'; ctx.lineWidth = 1.6
  ctx.beginPath(); ctx.arc(0, 0, kr * 0.55, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath(); ctx.ellipse(-kr * 0.32, -kr * 0.36, kr * 0.26, kr * 0.15, -0.6, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // ambient occlusion where the slab meets the jambs + crisp edges
  inkPoly([DBL, DBR, DTR, DTL], 'rgba(20,26,32,0.3)', 5)
  inkPoly([DBL, DBR, DTR, DTL], INK, 2.5)
  inkPoly([FBL, FBR, FTR, FTL], INK, 3.5)
  quad(ctx, P(dt0 - ft, s0), P(dt1 + ft, s0), P(dt1 + ft, s1 + fs), P(dt0 - ft, s1 + fs))
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
  // (no crown cap here — on the fold-down bottom wall it lands at the door's
  // screen-bottom and reads upside down; the plain casing stays symmetric)
}

/** One folded wall: floor edge p0→p1, splayed outer edge q0→q1 (trapezoid). */
function drawWall(ctx: Ctx, p0: V, p1: V, q0: V, q1: V, seed: number, withWindow = false, withBunting = false, withDoor = false): void {
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

  // ---- the wainscot is a SLAB that PROTRUDES from the wall; the blue wall above
  //      is set back. We see its front panel + its top face (= the chair rail). ----
  const inx = -dy / len, iny = dx / len            // inward: off the wall toward the room
  const WD = 40                                     // how far the whole wainscot slab juts out
  const Pw = (t: number, s: number): V => { const p = P(t, s); return { x: p.x + inx * WD, y: p.y + iny * WD } }
  const projF = (p: V, d: number): V => ({ x: p.x + inx * d, y: p.y + iny * d })
  const q4 = (a: V, b: V, c: V, dd: V, fill: string, ink = 0): void => {
    quad(ctx, a, b, c, dd); ctx.fillStyle = fill; ctx.fill()
    if (ink) { ctx.strokeStyle = INK; ctx.lineWidth = ink; ctx.stroke() }
  }

  // chair rail = the TOP FACE of the slab: it recedes from the protruding front
  // edge back up to the recessed blue wall (that step IS the "goes in" you wanted)
  q4(Pw(0, sW), Pw(1, sW), P(1, sW), P(0, sW), RAIL)
  ctx.strokeStyle = 'rgba(32,26,23,0.34)'; ctx.lineWidth = 3     // AO where blue wall meets the top face
  ctx.beginPath(); ctx.moveTo(P(0, sW).x, P(0, sW).y); ctx.lineTo(P(1, sW).x, P(1, sW).y); ctx.stroke()

  // wainscot FRONT panel (the whole protruding white face) + bead grooves
  q4(Pw(0, 0), Pw(1, 0), Pw(1, sW), Pw(0, sW), WAINSCOT)
  ctx.strokeStyle = GROOVE; ctx.lineWidth = 2
  const grooves = Math.max(2, Math.round(len / 150))
  for (let gi = 1; gi < grooves; gi++) {
    const a = Pw(gi / grooves, 0.02), b = Pw(gi / grooves, sW * 0.97)
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
  // faint wood grain — the wainscot is painted wood, so subtle vertical streaks
  ctx.lineWidth = 1.4
  const gn = Math.max(6, Math.round(len / 62))
  for (let gi = 0; gi < gn; gi++) {
    const gt = (gi + 0.5) / gn
    const bow = (rnd(gi + seed, 17) - 0.5) * 0.007
    const a = Pw(gt, 0.03), m = Pw(gt + bow, sW * 0.5), b = Pw(gt, sW * 0.96)
    ctx.strokeStyle = `rgba(120,122,132,${0.04 + rnd(gi, seed * 3) * 0.05})`
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke()
  }
  // crisp top edge of the slab front + a thin highlight
  ctx.strokeStyle = INK; ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(Pw(0, sW).x, Pw(0, sW).y); ctx.lineTo(Pw(1, sW).x, Pw(1, sW).y); ctx.stroke()

  // 3D baseboard: a molding step at the foot of the slab's front face
  const bbl = Pw(0, 0.075), bbr = Pw(1, 0.075)
  q4(projF(bbl, 12), projF(bbr, 12), projF(bbr, 24), projF(bbl, 24), 'rgba(32,26,23,0.12)')  // shadow
  q4(projF(bbl, 10), projF(bbr, 10), projF(bbr, 20), projF(bbl, 20), BASE_SH, 2.5)           // fascia
  q4(bbl, bbr, projF(bbr, 10), projF(bbl, 10), '#fbfcfd', 2.5)                               // top ledge

  // pennant bunting strung across the sky, then the window
  if (withBunting) drawBunting(ctx, P)
  // the door hangs on the BOTTOM wall near its left corner (t runs C→E, so
  // high t = screen-left). ~580 world units wide — a door, not a garage.
  if (withDoor) {
    const dw = 460 / len
    drawDoor(ctx, P, 0.79 - dw, 0.79)
    drawSwitch(ctx, P, 0.79 + 0.035, 0.46)   // knob side of the door
    drawOutlet(ctx, P, 0.45, 0.14)
  }
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

  drawWall(ctx, A, B, Ao, Bo, 1, true, true)  // top (window + bunting)
  drawWall(ctx, B, C, Bo, Co, 2)  // right
  drawWall(ctx, C, E, Co, Eo, 3, false, false, true)  // bottom (door + fixtures, near the left corner)
  drawWall(ctx, E, A, Eo, Ao, 4)  // left

  // fold creases at the corners, so the box read is unmistakable
  ctx.strokeStyle = 'rgba(32,26,23,0.22)'; ctx.lineWidth = 3
  for (const [a, b] of [[A, Ao], [B, Bo], [C, Co], [E, Eo]] as const) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
  }
}
