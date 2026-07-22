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
