import { theme } from '../../config/theme'
import { world } from '../../config/world'
import { spark, registerObstacleProvider, allObstacles } from '../physics'
import { showVehicleHelp, hideVehicleHelp } from '../../ui/vehicleHelp'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// Toy race circuit + die-cast cars. CLICK a car to hop in — drive with WASD /
// arrow keys (up throttle, down brake/reverse, left/right steer), Esc or click
// again to hop out. The whole table is road: plow marbles, clip blocks, leave
// skid marks. The camera follows whichever car you're driving (driveTarget).

const TRACK_W = 118      // asphalt width — wide enough to actually race + drift
const N_PTS = 460        // sampled points around the circuit (smoothness)

const CAR_LEN = 54
const CAR_W = 30
const MAX_SPEED = 560
const BOOST_SPEED = 940  // hold Shift: nitro
const BOOST_ACCEL = 1700
const MAX_REVERSE = -180
const ACCEL = 750
const BRAKE = 1600
const COAST = 1.1        // drag while coasting
const TURN_RATE = 5.2    // rad/s at full grip — tight, toy-car handling

interface Car {
  color: string
  accent: string
  flames: boolean
  x: number
  y: number
  heading: number
  v: number
  squash: number
}

interface Skid { x: number; y: number; rot: number; age: number }

// ---- track geometry: a big GP circuit sprawling across the whole UPPER-LEFT of
// the room (world 6600×4600). Clockwise waypoints, routed clear of the dresser
// (x ≤ 440 around y1500) and the lower games/rug (y > ~2200); a closed
// Catmull-Rom spline is sampled through them for a smooth ribbon. ----
type Pt = { x: number; y: number }
// the raw layout below is shrunk by TRACK_SCALE and re-centred at (TRACK_CX,
// TRACK_CY) — so the whole track resizes/moves from just these two knobs.
const TRACK_SCALE = 0.66
const TRACK_CX = 2000, TRACK_CY = 900   // shifted right to clear the corner shelves
const RAW_WAYPOINTS: Pt[] = [
  { x: 720, y: 1980 },   // 0 — start/finish, long bottom straight
  { x: 1500, y: 2030 },
  { x: 2300, y: 1990 },
  { x: 2900, y: 1860 },  // sweep up the right side
  { x: 3080, y: 1480 },
  { x: 2960, y: 1120 },  // right-side esse
  { x: 3090, y: 760 },
  { x: 2760, y: 500 },   // top-right hairpin
  { x: 2280, y: 560 },
  { x: 1820, y: 460 },   // gentle wave across the top
  { x: 1380, y: 580 },
  { x: 940, y: 460 },
  { x: 640, y: 700 },    // top-left corner
  { x: 560, y: 1080 },   // down the left side (x≥560 clears the dresser)
  { x: 680, y: 1440 },
  { x: 560, y: 1780 },
  { x: 660, y: 1960 },   // left hairpin, closing back to start
]
const RAW_C = { x: 1825, y: 1245 }   // bbox centre of the raw layout above
const WAYPOINTS: Pt[] = RAW_WAYPOINTS.map((p) => ({
  x: TRACK_CX + (p.x - RAW_C.x) * TRACK_SCALE,
  y: TRACK_CY + (p.y - RAW_C.y) * TRACK_SCALE,
}))

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t, t3 = t2 * t
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

const trackPts: Pt[] = []
{
  const n = WAYPOINTS.length
  const per = Math.round(N_PTS / n)
  for (let i = 0; i < n; i++) {
    const p0 = WAYPOINTS[(i - 1 + n) % n], p1 = WAYPOINTS[i], p2 = WAYPOINTS[(i + 1) % n], p3 = WAYPOINTS[(i + 2) % n]
    for (let j = 0; j < per; j++) trackPts.push(catmull(p0, p1, p2, p3, j / per))
  }
}
const trackPoint = (i: number): Pt => trackPts[((i % trackPts.length) + trackPts.length) % trackPts.length]

// ---- keyboard state (armed only while driving) ----
const keys = { up: false, down: false, left: false, right: false, boost: false }
let controlling = -1 // index into cars, -1 = nobody driving

const KEYMAP: Record<string, keyof typeof keys> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
}

// module-level so main.ts can make the camera chase the driven car
let driveTargetPos: { x: number; y: number } | null = null
export function driveTarget(): { x: number; y: number } | null {
  return driveTargetPos
}

const TAU = Math.PI * 2

// deterministic hash → [0,1) so every scatter is frozen frame-to-frame (no shimmer)
function hsh(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

// ---- infield geometry ---------------------------------------------------------
// The grass is the region enclosed by the track centreline (trackPts). We paint it
// UNDER the track: draw grass first, then drawTrack's INK border + orange rails
// stroke on top and hide the grass out to the inner rail — so grass only shows
// inside the inner boundary. For the diorama we need an INNER polygon (centreline
// shrunk toward the centroid by ~half the track width plus a safety margin) so
// nothing we place ever pokes onto the asphalt.
const INFIELD_CX = (() => { let s = 0; for (const p of trackPts) s += p.x; return s / trackPts.length })()
const INFIELD_CY = (() => { let s = 0; for (const p of trackPts) s += p.y; return s / trackPts.length })()
// grass polygon = the raw centreline (track strokes cover the outer band)
const GRASS_POLY = trackPts
// inner safe polygon = centreline pulled toward the centroid by TRACK_W/2 + margin
const INNER_MARGIN = 26
function shrinkPoly(pts: Pt[], inset: number): Pt[] {
  return pts.map((p) => {
    const dx = p.x - INFIELD_CX, dy = p.y - INFIELD_CY
    const d = Math.hypot(dx, dy) || 1
    const nd = Math.max(0, d - inset)
    return { x: INFIELD_CX + (dx / d) * nd, y: INFIELD_CY + (dy / d) * nd }
  })
}
const SAFE_POLY = shrinkPoly(GRASS_POLY, TRACK_W / 2 + INNER_MARGIN)

function pointInPoly(px: number, py: number, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
// safe if the point (and a radius around it, sampled at 4 compass points) sits
// inside the inner polygon — keeps clustered props clear of the ribbon
function safeAt(x: number, y: number, r: number): boolean {
  if (!pointInPoly(x, y, SAFE_POLY)) return false
  return pointInPoly(x + r, y, SAFE_POLY) && pointInPoly(x - r, y, SAFE_POLY) &&
    pointInPoly(x, y + r, SAFE_POLY) && pointInPoly(x, y - r, SAFE_POLY)
}
// infield bounding box (of the safe polygon) for seeding scatter
const IF_BB = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of SAFE_POLY) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y) }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
})()

// ---- diorama layout: cluster hero props at fractions of the safe bbox, snapped
//      inward until they sit safely inside the inner rail (deterministic) --------
type Anchor = { x: number; y: number }
function anchor(fx: number, fy: number, r: number): Anchor {
  let x = IF_BB.x0 + IF_BB.w * fx, y = IF_BB.y0 + IF_BB.h * fy
  // if it landed near/over the rail, walk it toward the centroid until safe
  for (let step = 0; step < 40 && !safeAt(x, y, r); step++) {
    x += (INFIELD_CX - x) * 0.08; y += (INFIELD_CY - y) * 0.08
  }
  return { x, y }
}

// ---- flat sticker primitives --------------------------------------------------
function hardShadow(g: Ctx, x: number, y: number, rx: number, ry: number): void {
  g.fillStyle = 'rgba(32,26,23,0.18)'; g.beginPath(); g.ellipse(x + 4, y + 5, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, TAU); g.fill()
}

function drawPine(g: Ctx, x: number, y: number, s: number): void {
  hardShadow(g, x, y, 15 * s, 5 * s)
  g.fillStyle = '#8a5a2b'; roundRect(g, x - 3 * s, y - 8 * s, 6 * s, 12 * s, 2); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = '#3f8f4f'; g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'
  for (let k = 0; k < 3; k++) { const ty = y - 4 * s - k * 13 * s, w = (20 - k * 5) * s; g.beginPath(); g.moveTo(x, ty - 20 * s); g.lineTo(x + w, ty); g.lineTo(x - w, ty); g.closePath(); g.fill(); g.stroke() }
}
// round leafy tree — a fatter deciduous cousin of the pine for variety
function drawTree(g: Ctx, x: number, y: number, s: number, col: string): void {
  hardShadow(g, x, y, 18 * s, 7 * s)
  g.fillStyle = '#8a5a2b'; roundRect(g, x - 3.5 * s, y - 4 * s, 7 * s, 13 * s, 2); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  g.beginPath(); g.ellipse(x, y - 12 * s, 17 * s, 15 * s, 0, 0, TAU); g.fill(); g.stroke()
  // a few flat lobes + a highlight, no gradient
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(x - 5 * s, y - 16 * s, 7 * s, 5 * s, -0.5, 0, TAU); g.fill()
}
function drawBush(g: Ctx, x: number, y: number, s: number): void {
  hardShadow(g, x, y, 13 * s, 5 * s)
  g.fillStyle = '#4f9a4a'; g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'
  g.beginPath()
  for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 8 * s; g.moveTo(bx + 8 * s, y); g.ellipse(bx, y - 2 * s, 8 * s, 7 * s, 0, 0, TAU) }
  g.fill(); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.ellipse(x - 3 * s, y - 5 * s, 5 * s, 3 * s, -0.4, 0, TAU); g.fill()
}
function drawRock(g: Ctx, x: number, y: number, s: number): void {
  hardShadow(g, x, y, 16 * s, 6 * s)
  g.fillStyle = '#9aa0a5'; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(x - 15 * s, y + 4 * s); g.lineTo(x - 10 * s, y - 8 * s); g.lineTo(x + 2 * s, y - 11 * s); g.lineTo(x + 14 * s, y - 4 * s); g.lineTo(x + 12 * s, y + 6 * s); g.closePath(); g.fill(); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(x - 9 * s, y - 6 * s); g.lineTo(x - 1 * s, y - 8 * s); g.lineTo(x - 4 * s, y - 1 * s); g.closePath(); g.fill()
}
function drawTuft(g: Ctx, x: number, y: number, s: number): void {
  g.strokeStyle = '#5cae61'; g.lineWidth = 3 * s; g.lineCap = 'round'
  for (const dx of [-8, -3, 2, 7]) { g.beginPath(); g.moveTo(x + dx * s, y + 4 * s); g.quadraticCurveTo(x + dx * s * 1.4, y - 8 * s, x + dx * s * 2 + 2, y - 14 * s); g.stroke() }
}
// a stack of racing tyres seen from above — concentric rings
function drawTireStack(g: Ctx, x: number, y: number, s: number): void {
  hardShadow(g, x, y, 15 * s, 13 * s)
  g.fillStyle = '#26211c'; g.strokeStyle = INK; g.lineWidth = 2.2
  g.beginPath(); g.ellipse(x, y, 14 * s, 12 * s, 0, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = '#3a332c'; g.beginPath(); g.ellipse(x, y, 9.5 * s, 8 * s, 0, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = '#6a5f52'; g.beginPath(); g.ellipse(x, y, 4.5 * s, 3.8 * s, 0, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - 4 * s, y - 4 * s, 4 * s, 2 * s, -0.6, 0, TAU); g.fill()
}
// a cylindrical hay bale seen from above with end-swirl
function drawHayBale(g: Ctx, x: number, y: number, s: number, rot: number): void {
  g.save(); g.translate(x, y); g.rotate(rot)
  hardShadow(g, 0, 0, 15 * s, 10 * s)
  g.fillStyle = '#e0b64a'; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  roundRect(g, -15 * s, -10 * s, 30 * s, 20 * s, 6); g.fill(); g.stroke()
  g.strokeStyle = 'rgba(150,110,30,0.55)'; g.lineWidth = 1.4
  for (const fx of [-8, 0, 8]) { g.beginPath(); g.moveTo(fx * s, -9 * s); g.lineTo(fx * s, 9 * s); g.stroke() }
  g.fillStyle = 'rgba(255,255,255,0.14)'; roundRect(g, -13 * s, -8 * s, 26 * s, 4 * s, 3); g.fill()
  g.restore()
}
// a red/white barrier block
function drawBarrier(g: Ctx, x: number, y: number, s: number, rot: number): void {
  g.save(); g.translate(x, y); g.rotate(rot)
  hardShadow(g, 0, 0, 18 * s, 8 * s)
  const w = 34 * s, h = 13 * s
  g.fillStyle = '#e8443a'; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  roundRect(g, -w / 2, -h / 2, w, h, 3); g.fill()
  // white stripes
  g.save(); roundRect(g, -w / 2, -h / 2, w, h, 3); g.clip()
  g.fillStyle = '#fbfaf4'
  for (let i = 0; i < 4; i++) { g.beginPath(); const bx = -w / 2 + i * (w / 2); g.moveTo(bx, -h / 2); g.lineTo(bx + w * 0.16, -h / 2); g.lineTo(bx + w * 0.16 - h, h / 2); g.lineTo(bx - h, h / 2); g.closePath(); g.fill() }
  g.restore()
  roundRect(g, -w / 2, -h / 2, w, h, 3); g.stroke()
  g.restore()
}

// ---- the barren-no-more diorama draw order -----------------------------------
function drawInfieldGrass(g: Ctx): void {
  g.save()
  // flat green base filling the whole centreline loop; track strokes cover the
  // outer band so grass reads only inside the inner rail
  g.fillStyle = '#79ad4a'
  g.beginPath(); GRASS_POLY.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill()
  // mowed stripes: alternating darker/lighter horizontal bands, clipped to grass
  g.clip()
  const stripeH = 46
  for (let sy = IF_BB.y0 - stripeH; sy < IF_BB.y1 + stripeH; sy += stripeH) {
    const band = Math.floor((sy - IF_BB.y0) / stripeH)
    g.fillStyle = band % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(32,26,23,0.05)'
    g.fillRect(IF_BB.x0 - 60, sy, IF_BB.w + 120, stripeH)
  }
  // faint deterministic clover speckle so the field isn't a flat slab
  for (let i = 0; i < 220; i++) {
    const x = IF_BB.x0 + hsh(i * 2 + 7) * IF_BB.w, y = IF_BB.y0 + hsh(i * 2 + 8) * IF_BB.h
    g.fillStyle = hsh(i) > 0.5 ? 'rgba(94,174,97,0.5)' : 'rgba(60,130,64,0.5)'
    g.beginPath(); g.ellipse(x, y, 2.2, 1.8, 0, 0, TAU); g.fill()
  }
  g.restore()
}

// grandstand: a ramped bank of seats + rows of spectator dots + roof shadow
function drawGrandstand(g: Ctx, a: Anchor, t: number): void {
  const w = 150, h = 76
  g.save(); g.translate(a.x, a.y)
  hardShadow(g, 0, 4, w * 0.56, h * 0.6)
  // concrete bank
  g.fillStyle = '#c9cdd0'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  roundRect(g, -w / 2, -h / 2, w, h, 10); g.fill(); g.stroke()
  // seating tiers (darker steps toward the track edge = front)
  const tierCols = ['#5aa0db', '#f0563e', '#f7c948', '#b7ce3c']
  for (let r = 0; r < 4; r++) {
    const ry = -h / 2 + 10 + r * 14
    g.fillStyle = tierCols[r]
    roundRect(g, -w / 2 + 8, ry, w - 16, 10, 3); g.fill()
    g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke()
    // spectator dots, deterministic, with a tiny idle bob (the crowd sways)
    for (let c = 0; c < 11; c++) {
      const seed = r * 40 + c
      if (hsh(seed) < 0.18) continue // some empty seats
      const px = -w / 2 + 16 + c * ((w - 32) / 10)
      const bob = Math.sin(t * 0.002 + seed) * 0.9
      g.fillStyle = ['#f0563e', '#5aa0db', '#f7c948', '#2fb0a3', '#a98fd0', '#ff7fa5'][seed % 6]
      g.beginPath(); g.ellipse(px, ry + 5 + bob, 3, 3, 0, 0, TAU); g.fill()
      g.lineWidth = 1; g.strokeStyle = INK; g.stroke()
    }
  }
  g.restore()
}

// start/finish control tower: a chunky flat-topped booth with a checker band + a
// slow-spinning beacon on top
function drawTower(g: Ctx, a: Anchor, t: number): void {
  const w = 46, h = 58
  g.save(); g.translate(a.x, a.y)
  hardShadow(g, 0, 4, w * 0.62, h * 0.55)
  g.fillStyle = '#f0e2be'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  roundRect(g, -w / 2, -h / 2, w, h, 8); g.fill(); g.stroke()
  // checker band
  g.save(); roundRect(g, -w / 2, -h / 2, w, h, 8); g.clip()
  const sq = 8
  for (let ry = 0; ry < 2; ry++) for (let cx = -3; cx < 4; cx++) { g.fillStyle = (ry + cx) % 2 === 0 ? INK : '#fbfaf4'; g.fillRect(cx * sq, -h / 2 + ry * sq, sq, sq) }
  g.restore()
  // dark window strip
  g.fillStyle = '#3d444b'; roundRect(g, -w / 2 + 6, 2, w - 12, 16, 3); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(g, -w / 2 + 9, 4, 12, 5, 2); g.fill()
  // rotating beacon: a small dot that orbits the roof
  const ba = t * 0.0016
  g.fillStyle = '#f7c948'; g.beginPath(); g.ellipse(Math.cos(ba) * 10, -h / 2 - 6 + Math.sin(ba) * 3, 4, 4, 0, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.restore()
}

// winner's podium: three flat steps 1-2-3
function drawPodium(g: Ctx, a: Anchor): void {
  g.save(); g.translate(a.x, a.y)
  hardShadow(g, 0, 3, 34, 12)
  const steps: [number, number, string][] = [[-24, 12, '#cfd3d6'], [0, 20, '#f7c948'], [24, 15, '#d9a441']]
  g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  for (const [sx, sh, col] of steps) { g.fillStyle = col; roundRect(g, sx - 11, -sh, 22, sh + 6, 3); g.fill(); g.stroke() }
  g.restore()
}

// a small pond: flat teal blob with an ink rim + a couple of flat glints
function drawPond(g: Ctx, a: Anchor, t: number): void {
  g.save(); g.translate(a.x, a.y)
  const rx = 44, ry = 30
  hardShadow(g, 0, 2, rx, ry)
  g.fillStyle = '#2f9bb0'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fill(); g.stroke()
  // muddy shallow rim
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(0, 0, rx - 6, ry - 6, 0, 0, TAU); g.fill()
  // flat glint blobs that drift slowly (idle life)
  g.fillStyle = 'rgba(255,255,255,0.4)'
  for (let i = 0; i < 3; i++) { const gx = Math.sin(t * 0.0006 + i * 2) * 14 - 8 + i * 8, gy = -6 + i * 6; g.beginPath(); g.ellipse(gx, gy, 7, 2.4, -0.5, 0, TAU); g.fill() }
  g.restore()
}

// a flag on a pole — pennant flutters with a slow sine
function drawFlagPole(g: Ctx, x: number, y: number, col: string, seed: number, t: number): void {
  hardShadow(g, x, y, 4, 3)
  g.strokeStyle = '#8a8f94'; g.lineWidth = 3; g.lineCap = 'round'
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 34); g.stroke()
  const flap = Math.sin(t * 0.003 + seed) * 3
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 20, y - 30 + flap); g.lineTo(x, y - 26); g.closePath(); g.fill(); g.stroke()
}

// a hero checkered flag on a pole, planted at the start/finish line. The cloth is
// a black/white checker grid that WAVES — each column gets a gentle vertical sine
// ripple (in seconds) so the whole flag ripples like real cloth in the breeze.
function drawCheckeredFlag(g: Ctx, x: number, y: number, t: number): void {
  const ts = t * 0.001
  const poleH = 96          // hero-sized: tall pole
  const topY = y - poleH
  // ground shadow of the pole base + cast shadow of the cloth (hard offset)
  hardShadow(g, x, y, 9, 5)
  // ---- flag cloth (drawn first so the pole ink sits on top of the hoist edge) --
  const cols = 8, rows = 5   // checker grid resolution
  const cw = 15, chh = 12    // cell size → cloth ~120×60, a readable hero flag
  const flagX = x + 3        // hoist edge just right of the pole
  const flagTopY = topY + 4
  // per-column horizontal wave offset (cloth billows away from the pole) and a
  // vertical ripple; amplitude grows with distance from the hoist so the free
  // edge flutters most
  const wave = (col: number): { dx: number; dy: number } => {
    const f = col / cols                       // 0 at hoist → 1 at free edge
    const amp = f * f                          // stiff at the pole, loose at the tip
    return {
      dx: Math.sin(ts * 2.2 - col * 0.7) * 5 * amp,
      dy: Math.sin(ts * 2.6 - col * 0.9) * 7 * amp,
    }
  }
  // hard offset shadow of the whole cloth
  g.fillStyle = 'rgba(32,26,23,0.18)'
  g.beginPath()
  for (let c = 0; c <= cols; c++) { const w = wave(c); const px = flagX + c * cw + w.dx + 5, py = flagTopY + w.dy + 6; c === 0 ? g.moveTo(px, py) : g.lineTo(px, py) }
  for (let c = cols; c >= 0; c--) { const w = wave(c); const px = flagX + c * cw + w.dx + 5, py = flagTopY + rows * chh + w.dy + 6; g.lineTo(px, py) }
  g.closePath(); g.fill()
  // checker cells — each quad is a warped column strip so the grid ripples
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wl = wave(c), wr = wave(c + 1)
      const x0 = flagX + c * cw + wl.dx, x1 = flagX + (c + 1) * cw + wr.dx
      const yTop0 = flagTopY + r * chh + wl.dy, yTop1 = flagTopY + r * chh + wr.dy
      const yBot0 = flagTopY + (r + 1) * chh + wl.dy, yBot1 = flagTopY + (r + 1) * chh + wr.dy
      g.fillStyle = (r + c) % 2 === 0 ? INK : '#fbfaf4'
      g.beginPath(); g.moveTo(x0, yTop0); g.lineTo(x1, yTop1); g.lineTo(x1, yBot1); g.lineTo(x0, yBot0); g.closePath(); g.fill()
    }
  }
  // ink outline around the whole cloth silhouette
  g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  g.beginPath()
  for (let c = 0; c <= cols; c++) { const w = wave(c); const px = flagX + c * cw + w.dx, py = flagTopY + w.dy; c === 0 ? g.moveTo(px, py) : g.lineTo(px, py) }
  for (let c = cols; c >= 0; c--) { const w = wave(c); const px = flagX + c * cw + w.dx, py = flagTopY + rows * chh + w.dy; g.lineTo(px, py) }
  g.closePath(); g.stroke()
  // ---- the pole: ink-outlined steel with a gold finial ----
  g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round'
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, topY); g.stroke()
  g.strokeStyle = '#b9bec2'; g.lineWidth = 3.4
  g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x, topY + 2); g.stroke()
  // gold ball finial on top
  g.fillStyle = '#f7c948'; g.strokeStyle = INK; g.lineWidth = 2.2
  g.beginPath(); g.ellipse(x, topY - 1, 6, 6, 0, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(x - 2, topY - 3, 2.2, 1.4, -0.6, 0, TAU); g.fill()
  // base plate
  g.fillStyle = '#9aa0a5'; g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'
  roundRect(g, x - 9, y - 4, 18, 8, 3); g.fill(); g.stroke()
}

// a hero trackside billboard: two posts + a bold board reading "ROYAL RACEWAY"
// with a checkered header band and racing stripes. House text recipe: white fill
// + INK strokeText underneath, Arial Black / display font.
// board geometry is exported so the layout can verify all four corners sit inside
// the safe polygon before committing the anchor.
const BILLBOARD_W = 300
const BILLBOARD_H = 132           // taller than before to fit two stacked text lines
function drawBillboard(g: Ctx, x: number, y: number, t: number): void {
  const ts = t * 0.001
  const bw = BILLBOARD_W, bh = BILLBOARD_H   // hero-sized board
  const boardTop = y - bh          // board sits above the anchor; posts drop below
  const postH = 40
  g.save(); g.translate(x, 0)
  // ---- posts (two chunky legs with a hard offset shadow) ----
  g.fillStyle = 'rgba(32,26,23,0.18)'
  for (const px of [-bw * 0.32, bw * 0.32]) { roundRect(g, px - 7 + 5, y - 4 + 6, 14, postH, 3); g.fill() }
  g.fillStyle = '#a9744a'; g.strokeStyle = INK; g.lineWidth = 2.6; g.lineJoin = 'round'
  for (const px of [-bw * 0.32, bw * 0.32]) {
    roundRect(g, px - 7, y - 4, 14, postH, 3); g.fill(); g.stroke()
    g.fillStyle = 'rgba(255,255,255,0.14)'; roundRect(g, px - 4, y - 2, 4, postH - 6, 2); g.fill(); g.fillStyle = '#a9744a'
  }
  // ---- board panel: hard offset shadow, ink border, cream face ----
  g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -bw / 2 + 6, boardTop + 8, bw, bh, 12); g.fill()
  g.fillStyle = '#f5ecd6'; g.strokeStyle = INK; g.lineWidth = 3.4; g.lineJoin = 'round'
  roundRect(g, -bw / 2, boardTop, bw, bh, 12); g.fill(); g.stroke()
  // clip to the board for the header band + stripes
  g.save(); roundRect(g, -bw / 2, boardTop, bw, bh, 12); g.clip()
  // checkered header band across the top
  const sq = 12
  const headerH = 2 * sq
  for (let r = 0; r < 2; r++) for (let c = -Math.ceil(bw / 2 / sq); c < Math.ceil(bw / 2 / sq); c++) {
    g.fillStyle = (r + c) % 2 === 0 ? INK : '#fbfaf4'
    g.fillRect(c * sq, boardTop + r * sq, sq, sq)
  }
  // racing stripes along the bottom edge (coral / gold)
  const stripeH = 12
  g.fillStyle = theme.colors.coral; g.fillRect(-bw / 2, boardTop + bh - 12, bw, 7)
  g.fillStyle = '#f7c948'; g.fillRect(-bw / 2, boardTop + bh - 5, bw, 5)
  g.restore()
  // ---- the text: TWO stacked lines, house recipe (ink stroke under, white fill over) ----
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const lines = ['ROYAL', 'RACEWAY']
  const pad = 24                                   // inner side padding
  const maxWidth = bw - pad                         // widest a line may be
  // text zone sits between the header band and the racing stripes
  const zoneTop = boardTop + headerH
  const zoneH = bh - headerH - stripeH
  // font cap driven by the per-line height (two lines share the zone)
  const fontCap = Math.floor((zoneH / 2) * 0.82)
  // shrink from the cap until the widest of the two lines fits inside maxWidth
  let fontSize = fontCap
  for (; fontSize > 8; fontSize--) {
    g.font = `900 ${fontSize}px "Arial Black", ${theme.fonts.display}`
    const widest = Math.max(...lines.map((l) => g.measureText(l).width))
    if (widest <= maxWidth) break
  }
  g.font = `900 ${fontSize}px "Arial Black", ${theme.fonts.display}`
  // a whisper of idle life: the sign breathes a hair (sub-pixel, in seconds)
  const bob = Math.sin(ts * 0.9) * 0.6
  g.lineJoin = 'round'
  const strokeW = Math.max(4, fontSize * 0.18)
  const lineGap = zoneH / 2
  lines.forEach((line, i) => {
    const cy = zoneTop + lineGap * (i + 0.5) + bob
    g.strokeStyle = INK; g.lineWidth = strokeW
    g.strokeText(line, 0, cy)
    g.fillStyle = '#fbfaf4'
    g.fillText(line, 0, cy)
  })
  g.restore()
}

// a bunting/banner line strung between two posts, little triangular flags
function drawBunting(g: Ctx, x0: number, y0: number, x1: number, y1: number, t: number): void {
  const cols = ['#f0563e', '#5aa0db', '#f7c948', '#b7ce3c', '#a98fd0']
  const n = 9
  g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'
  // posts
  for (const [px, py] of [[x0, y0], [x1, y1]]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - 40); g.stroke() }
  const ty0 = y0 - 38, ty1 = y1 - 38
  // sagging string
  g.strokeStyle = '#6a5f52'; g.lineWidth = 1.6
  g.beginPath(); g.moveTo(x0, ty0); g.quadraticCurveTo((x0 + x1) / 2, (ty0 + ty1) / 2 + 10, x1, ty1); g.stroke()
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n
    const bx = x0 + (x1 - x0) * f, by = ty0 + (ty1 - ty0) * f + Math.sin(f * Math.PI) * 10
    const sway = Math.sin(t * 0.003 + i) * 1.2
    g.fillStyle = cols[i % cols.length]; g.strokeStyle = INK; g.lineWidth = 1.4; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(bx - 5, by); g.lineTo(bx + 5, by); g.lineTo(bx + sway, by + 12); g.closePath(); g.fill(); g.stroke()
  }
}

function drawInfield(g: Ctx, t: number): void {
  // --- hero props, clustered like a real infield paddock ---
  const grandstand = anchor(0.30, 0.16, 82)
  const tower = anchor(0.72, 0.20, 34)     // nudged toward the top-right corner
  const podium = anchor(0.78, 0.44, 26)    // nudged right to clear the centre billboard
  const pond = anchor(0.22, 0.74, 48)

  // --- centrepiece billboard: "ROYAL RACEWAY" anchored at the infield middle ---
  // its half-width (~150) is the safe radius so the whole board stays off the ribbon.
  const sign = anchor(0.5, 0.5, 156)
  // the board is drawn from (sign.x - bw/2, sign.y - bh) up to (sign.x + bw/2, sign.y):
  // verify all four corners actually sit inside the safe polygon (the compass-point
  // safeAt check misses the diagonal corners of a tall/wide board), re-anchoring
  // toward the centroid until they clear the ribbon.
  const boardCorners = (cx: number, cy: number): Pt[] => [
    { x: cx - BILLBOARD_W / 2, y: cy },
    { x: cx + BILLBOARD_W / 2, y: cy },
    { x: cx - BILLBOARD_W / 2, y: cy - BILLBOARD_H },
    { x: cx + BILLBOARD_W / 2, y: cy - BILLBOARD_H },
  ]
  for (let step = 0; step < 40 && !boardCorners(sign.x, sign.y).every((c) => pointInPoly(c.x, c.y, SAFE_POLY)); step++) {
    sign.x += (INFIELD_CX - sign.x) * 0.06
    sign.y += (INFIELD_CY - sign.y) * 0.06
  }

  drawGrandstand(g, grandstand, t)
  drawTower(g, tower, t)
  drawPodium(g, podium)
  drawPond(g, pond, t)
  drawBillboard(g, sign.x, sign.y, t)

  // --- checkered start/finish flag: planted on the infield grass beside the
  //     start/finish line (raw waypoint 0), offset toward the centroid until it
  //     clears the ribbon so it stands on grass, not asphalt ---
  const s0 = trackPoint(0)
  let flagX = s0.x, flagY = s0.y
  {
    const dx = INFIELD_CX - s0.x, dy = INFIELD_CY - s0.y
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d, uy = dy / d
    // step inward off the asphalt until a hero-sized flag footprint is safe
    for (let step = 0; step < 60 && !safeAt(flagX, flagY, 60); step++) { flagX += ux * 8; flagY += uy * 8 }
    if (safeAt(flagX, flagY, 60)) drawCheckeredFlag(g, flagX, flagY, t)
  }

  // paddock cluster near the tower: tyre stacks + hay bales + barriers
  const paddockX = tower.x - 4, paddockY = tower.y + 46
  const paddock: { fx: number; fy: number; k: 'tire' | 'hay' | 'barrier' }[] = [
    { fx: -30, fy: 0, k: 'tire' }, { fx: -8, fy: 8, k: 'tire' }, { fx: 30, fy: -2, k: 'hay' },
    { fx: 52, fy: 14, k: 'hay' }, { fx: 6, fy: 30, k: 'barrier' }, { fx: -34, fy: 26, k: 'tire' },
  ]
  for (let i = 0; i < paddock.length; i++) {
    const it = paddock[i]
    const x = paddockX + it.fx, y = paddockY + it.fy
    if (!safeAt(x, y, 20)) continue
    if (it.k === 'tire') drawTireStack(g, x, y, 0.85 + hsh(i + 60) * 0.4)
    else if (it.k === 'hay') drawHayBale(g, x, y, 0.7 + hsh(i + 61) * 0.3, (hsh(i + 62) - 0.5) * 0.8)
    else drawBarrier(g, x, y, 0.75 + hsh(i + 63) * 0.3, (hsh(i + 64) - 0.5) * 0.6)
  }

  // a row of flag poles along a safe edge (near the grandstand)
  const flagCols = ['#f0563e', '#5aa0db', '#f7c948', '#b7ce3c', '#a98fd0']
  for (let i = 0; i < 6; i++) {
    const fx = grandstand.x - 60 + i * 24, fy = grandstand.y + 52
    if (!safeAt(fx, fy, 8)) continue
    drawFlagPole(g, fx, fy, flagCols[i % flagCols.length], i, t)
  }

  // bunting strung across the mid-field between two safe posts
  const bA = anchor(0.44, 0.55, 6), bB = anchor(0.74, 0.6, 6)
  if (safeAt(bA.x, bA.y, 6) && safeAt(bB.x, bB.y, 6)) drawBunting(g, bA.x, bA.y, bB.x, bB.y, t)

  // --- deterministic scatter of greenery filling the remaining grass ---
  // walk a grid of candidate cells, drop a prop in any cell that's safe AND far
  // enough from the hero props, jittered by the hash so it doesn't look gridded
  // each hero reserves a clearance radius — the wide billboard and tall flag need
  // more room than a tyre stack so nothing overlaps them
  const heroes: { x: number; y: number; r: number }[] = [
    { ...grandstand, r: 96 }, { ...tower, r: 78 }, { ...podium, r: 78 }, { ...pond, r: 78 },
    { x: sign.x, y: sign.y, r: 172 }, { x: flagX, y: flagY, r: 82 },
    { x: paddockX, y: paddockY, r: 78 }, { x: bA.x, y: bA.y, r: 60 }, { x: bB.x, y: bB.y, r: 60 },
  ]
  const GRID = 15
  const cw = IF_BB.w / GRID, ch = IF_BB.h / GRID
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const seed = gy * GRID + gx
      const jx = (hsh(seed * 3 + 1) - 0.5) * cw * 0.8
      const jy = (hsh(seed * 3 + 2) - 0.5) * ch * 0.8
      const x = IF_BB.x0 + (gx + 0.5) * cw + jx
      const y = IF_BB.y0 + (gy + 0.5) * ch + jy
      if (!safeAt(x, y, 24)) continue
      // keep clear of hero props
      let nearHero = false
      for (const h of heroes) { if (Math.hypot(x - h.x, y - h.y) < h.r) { nearHero = true; break } }
      if (nearHero) continue
      const roll = hsh(seed * 3 + 3)
      // thin the scatter so it clusters rather than paving the field
      if (roll < 0.42) continue
      const s = 0.7 + hsh(seed + 200) * 0.55
      const kind = hsh(seed + 300)
      if (kind < 0.28) drawPine(g, x, y, s)
      else if (kind < 0.5) drawTree(g, x, y, s, hsh(seed + 301) > 0.5 ? '#4f9a4a' : '#5cae61')
      else if (kind < 0.68) drawBush(g, x, y, s)
      else if (kind < 0.82) drawRock(g, x, y, s * 0.9)
      else drawTuft(g, x, y, s)
    }
  }
}

export function createHotwheels(): TableGame {
  const cars: Car[] = [
    { color: theme.colors.coral, accent: '#f7c948', flames: true, ...spawnAt(0.03), squash: 0 },
    { color: theme.colors.sky, accent: '#fbfaf4', flames: false, ...spawnAt(0.28), squash: 0 },
    { color: '#f7c948', accent: '#e04434', flames: true, ...spawnAt(0.53), squash: 0 },
    { color: theme.colors.lime, accent: '#fbfaf4', flames: false, ...spawnAt(0.78), squash: 0 },
  ]
  const skids: Skid[] = []
  const SELF = Symbol('hotwheels')

  function spawnAt(frac: number): { x: number; y: number; heading: number; v: number } {
    const i = Math.floor(frac * N_PTS)
    const p = trackPoint(i)
    const q = trackPoint(i + 2)
    return { x: p.x, y: p.y, heading: Math.atan2(q.y - p.y, q.x - p.x), v: 0 }
  }

  window.addEventListener('keydown', (e) => {
    if (controlling === -1) return
    if (e.code === 'Escape') { controlling = -1; hideVehicleHelp(); return }
    const k = KEYMAP[e.code]
    if (k) { keys[k] = true; e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code]
    if (k) keys[k] = false
  })
  // another vehicle (the drone) took control → hop out of the car
  window.addEventListener('dw-vehicle-claim', (e) => { if ((e as CustomEvent).detail !== 'car') { controlling = -1; hideVehicleHelp() } })

  // marbles/coins/ball carom off the cars, launched by the car's own velocity
  registerObstacleProvider(() =>
    cars.map((c, i) => ({
      x: c.x, y: c.y, half: CAR_LEN * 0.42, owner: SELF,
      vx: Math.cos(c.heading) * c.v,
      vy: Math.sin(c.heading) * c.v,
      onHit: (ix: number, iy: number) => {
        if (i !== controlling) { c.x += ix * 0.004; c.y += iy * 0.004 }
      },
    })),
  )

  const bumpObstacles = (c: Car): void => {
    for (const o of allObstacles()) {
      if (o.owner === SELF) continue
      const cx = Math.min(Math.max(c.x, o.x - o.half), o.x + o.half)
      const cy = Math.min(Math.max(c.y, o.y - o.half), o.y + o.half)
      let dx = c.x - cx, dy = c.y - cy
      let d = Math.hypot(dx, dy)
      const rr = CAR_LEN * 0.45
      if (d >= rr) continue
      if (d === 0) { dx = c.x - o.x; dy = c.y - o.y; d = Math.hypot(dx, dy) || 1 }
      const nx = dx / d, ny = dy / d
      c.x = cx + nx * rr
      c.y = cy + ny * rr
      const impact = Math.abs(c.v)
      if (impact > 120) {
        // the car is heavy die-cast — hits send things FLYING
        o.onHit?.(-nx * impact * 3.5, -ny * impact * 3.5)
        spark(cx, cy, Math.min(1, impact / 700))
        c.squash = 1
      }
      // barely slows the car down — it plows through
      c.v *= impact > 400 ? 0.82 : -0.2
    }
  }

  return {
    id: 'hotwheels',
    onDown(x, y) {
      for (let i = 0; i < cars.length; i++) {
        if (Math.hypot(x - cars[i].x, y - cars[i].y) < CAR_LEN) {
          controlling = controlling === i ? -1 : i // hop in / out / switch cars
          keys.up = keys.down = keys.left = keys.right = false
          if (controlling !== -1) { window.dispatchEvent(new CustomEvent('dw-vehicle-claim', { detail: 'car' })); showVehicleHelp('car') }
          else hideVehicleHelp()
          return true
        }
      }
      return false
    },
    onMove() { /* keyboard-driven */ },
    onUp() { /* nothing */ },
    update(dt) {
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i]
        const driven = i === controlling

        if (driven) {
          // throttle / brake / reverse — Shift is the nitro button
          const boosting = keys.boost && keys.up
          const cap = boosting ? BOOST_SPEED : MAX_SPEED
          const accel = boosting ? BOOST_ACCEL : ACCEL
          if (keys.up) {
            c.v = c.v > cap
              ? Math.max(cap, c.v * Math.exp(-1.5 * dt)) // ease down off-boost
              : Math.min(cap, c.v + accel * dt)
          } else if (keys.down) c.v = Math.max(MAX_REVERSE, c.v - BRAKE * dt)
          else c.v *= Math.exp(-COAST * dt)
          // steering scales with speed (no pivoting in place)
          const speedFactor = Math.min(1, Math.abs(c.v) / 260)
          const dir = c.v >= 0 ? 1 : -1
          if (keys.left) c.heading -= TURN_RATE * speedFactor * dir * dt
          if (keys.right) c.heading += TURN_RATE * speedFactor * dir * dt
          // skid marks when cornering hard at speed
          if ((keys.left || keys.right) && Math.abs(c.v) > 330) {
            const back = c.heading + Math.PI
            for (const side of [-1, 1]) {
              skids.push({
                x: c.x + Math.cos(back) * CAR_LEN * 0.32 + Math.cos(c.heading + Math.PI / 2) * side * CAR_W * 0.32,
                y: c.y + Math.sin(back) * CAR_LEN * 0.32 + Math.sin(c.heading + Math.PI / 2) * side * CAR_W * 0.32,
                rot: c.heading, age: 0,
              })
            }
            if (skids.length > 400) skids.splice(0, skids.length - 400)
          }
        } else {
          c.v *= Math.exp(-2.5 * dt) // parked cars roll to a stop
        }

        c.x += Math.cos(c.heading) * c.v * dt
        c.y += Math.sin(c.heading) * c.v * dt
        c.squash = Math.max(0, c.squash - dt * 6)

        // stay on the table — thud into the rim
        const M = CAR_LEN * 0.5
        if (c.x < M || c.x > world.width - M || c.y < M || c.y > world.height - M) {
          if (Math.abs(c.v) > 250) { spark(c.x, c.y, Math.min(1, Math.abs(c.v) / 1200)); c.squash = 1 }
          c.x = Math.min(Math.max(c.x, M), world.width - M)
          c.y = Math.min(Math.max(c.y, M), world.height - M)
          c.v *= -0.3
        }
        bumpObstacles(c)
      }
      // fade skid marks
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].age += dt
        if (skids[i].age > 6) skids.splice(i, 1)
      }
      const dc = controlling >= 0 ? cars[controlling] : null
      driveTargetPos = dc ? { x: dc.x, y: dc.y } : null
    },
    draw(g: Ctx, t) {
      drawInfieldGrass(g)   // grass UNDER the track — track strokes cover the outer band
      drawTrack(g)
      drawInfield(g, t)      // diorama sits on the grass, all inside the inner rail
      // skid marks under the cars
      for (const s of skids) {
        g.save()
        g.translate(s.x, s.y)
        g.rotate(s.rot)
        g.globalAlpha = Math.max(0, 0.35 - s.age * 0.058)
        g.fillStyle = '#2a241f'
        g.fillRect(-4, -2, 8, 4)
        g.restore()
      }
      g.globalAlpha = 1
      for (let i = 0; i < cars.length; i++) drawCar(g, cars[i], i === controlling, t)
    },
  }

  function drawTrack(g: Ctx): void {
    const path = (): void => {
      g.beginPath()
      trackPts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
      g.closePath()
    }
    g.save()
    g.lineJoin = 'round'
    g.lineCap = 'round'
    // ---- orange Hot Wheels track: cast shadow, ink border, bright raised side
    //      rails around a slightly-recessed centre channel (no infield — it's
    //      just track laid on the floor, like the real toy) ----
    g.strokeStyle = 'rgba(32,26,23,0.2)'; g.lineWidth = TRACK_W + 10
    g.save(); g.translate(5, 8); path(); g.stroke(); g.restore()
    g.strokeStyle = INK; g.lineWidth = TRACK_W + 6; path(); g.stroke()
    g.strokeStyle = '#ffb877'; g.lineWidth = TRACK_W; path(); g.stroke()          // bright outer rim
    g.strokeStyle = '#f2872f'; g.lineWidth = TRACK_W - 7; path(); g.stroke()      // rail tops
    g.strokeStyle = '#d9661a'; g.lineWidth = TRACK_W - 42; path(); g.stroke()     // recessed centre channel
    g.strokeStyle = 'rgba(120,50,10,0.3)'; g.lineWidth = 2; path(); g.stroke()    // centre groove hint

    // ---- blue connector clips straddling the track at intervals ----
    const everyClip = Math.round(trackPts.length / 6)
    for (let i = 0; i < trackPts.length; i += everyClip) {
      const p = trackPoint(i), q = trackPoint(i + 1)
      const ang = Math.atan2(q.y - p.y, q.x - p.x)
      g.save(); g.translate(p.x, p.y); g.rotate(ang)
      const cw = 30, ch = TRACK_W + 20
      g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -cw / 2 + 3, -ch / 2 + 4, cw, ch, 8); g.fill()
      g.fillStyle = '#4aa3e0'; roundRect(g, -cw / 2, -ch / 2, cw, ch, 8); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.4)'; roundRect(g, -cw / 2 + 5, -ch / 2 + 4, cw - 10, 6, 3); g.fill()   // sheen
      g.fillStyle = '#2f7cb8'
      for (const py of [-ch * 0.3, ch * 0.3]) { g.beginPath(); g.ellipse(0, py, 6, 6, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke() }
      g.restore()
    }
    // checkered start/finish line at t=0 (right side of the oval)
    const s0 = trackPoint(0)
    const s1 = trackPoint(2)
    const sAng = Math.atan2(s1.y - s0.y, s1.x - s0.x)
    g.save()
    g.translate(s0.x, s0.y)
    g.rotate(sAng)
    const sq = 6
    for (let r = 0; r < 2; r++) {
      for (let k = -Math.floor(TRACK_W / 2 / sq); k < Math.floor(TRACK_W / 2 / sq); k++) {
        g.fillStyle = (r + k) % 2 === 0 ? '#fbfaf4' : INK
        g.fillRect(r * sq - sq, k * sq, sq, sq)
      }
    }
    g.restore()
    g.restore()
  }

  function drawCar(g: Ctx, c: Car, driven: boolean, t: number): void {
    g.save()
    g.translate(c.x, c.y)
    // "click to drive" ring on the active car
    if (driven) {
      g.strokeStyle = 'rgba(247, 201, 72, 0.85)'
      g.lineWidth = 3.5
      g.setLineDash([8, 7])
      g.beginPath()
      g.arc(0, 0, CAR_LEN * 0.85, t / 400, t / 400 + Math.PI * 2)
      g.stroke()
      g.setLineDash([])
    }
    g.rotate(c.heading)
    g.scale(1 + c.squash * 0.1, 1 - c.squash * 0.14)
    // shadow
    g.fillStyle = 'rgba(32,26,23,0.24)'
    g.beginPath(); g.ellipse(2, 4, CAR_LEN * 0.52, CAR_W * 0.55, 0, 0, Math.PI * 2); g.fill()
    // nitro flame out the back while boosting
    if (driven && keys.boost && keys.up && Math.abs(c.v) > 60) {
      const flick = 1 + Math.sin(t / 28) * 0.35 + Math.sin(t / 9) * 0.15
      const fx = -CAR_LEN * 0.52
      g.lineJoin = 'round'
      g.fillStyle = '#f7a94f'
      g.beginPath()
      g.moveTo(fx, -CAR_W * 0.22)
      g.lineTo(fx - 26 * flick, 0)
      g.lineTo(fx, CAR_W * 0.22)
      g.closePath()
      g.fill()
      g.strokeStyle = INK
      g.lineWidth = 2
      g.stroke()
      g.fillStyle = '#ffe08a'
      g.beginPath()
      g.moveTo(fx, -CAR_W * 0.1)
      g.lineTo(fx - 13 * flick, 0)
      g.lineTo(fx, CAR_W * 0.1)
      g.closePath()
      g.fill()
    }
    // wheels
    g.fillStyle = '#26211c'
    for (const [wx, wy] of [[-CAR_LEN * 0.28, -CAR_W * 0.52], [-CAR_LEN * 0.28, CAR_W * 0.52], [CAR_LEN * 0.3, -CAR_W * 0.52], [CAR_LEN * 0.3, CAR_W * 0.52]]) {
      g.beginPath()
      if (typeof g.roundRect === 'function') g.roundRect(wx - 7, wy - 4, 14, 8, 3)
      else g.rect(wx - 7, wy - 4, 14, 8)
      g.fill()
    }
    // body: die-cast capsule with a nose taper
    const grad = g.createLinearGradient(0, -CAR_W / 2, 0, CAR_W / 2)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.18, c.color)
    grad.addColorStop(1, c.color)
    g.fillStyle = grad
    g.strokeStyle = INK
    g.lineWidth = 2.6
    g.beginPath()
    g.moveTo(CAR_LEN / 2, 0)
    g.quadraticCurveTo(CAR_LEN / 2, -CAR_W / 2, CAR_LEN * 0.16, -CAR_W / 2)
    g.lineTo(-CAR_LEN * 0.42, -CAR_W / 2)
    g.quadraticCurveTo(-CAR_LEN / 2, -CAR_W / 2, -CAR_LEN / 2, 0)
    g.quadraticCurveTo(-CAR_LEN / 2, CAR_W / 2, -CAR_LEN * 0.42, CAR_W / 2)
    g.lineTo(CAR_LEN * 0.16, CAR_W / 2)
    g.quadraticCurveTo(CAR_LEN / 2, CAR_W / 2, CAR_LEN / 2, 0)
    g.closePath()
    g.fill(); g.stroke()
    // flame decal on the hot one
    if (c.flames) {
      g.fillStyle = c.accent
      g.beginPath()
      g.moveTo(CAR_LEN * 0.42, 0)
      g.lineTo(CAR_LEN * 0.1, -CAR_W * 0.22)
      g.lineTo(CAR_LEN * 0.2, 0)
      g.lineTo(CAR_LEN * 0.1, CAR_W * 0.22)
      g.closePath()
      g.fill()
    }
    // cockpit glass
    g.fillStyle = '#3d444b'
    g.beginPath()
    if (typeof g.roundRect === 'function') g.roundRect(-CAR_LEN * 0.22, -CAR_W * 0.3, CAR_LEN * 0.32, CAR_W * 0.6, 5)
    else g.rect(-CAR_LEN * 0.22, -CAR_W * 0.3, CAR_LEN * 0.32, CAR_W * 0.6)
    g.fill()
    g.lineWidth = 1.8
    g.stroke()
    // spoiler
    g.fillStyle = c.color
    g.fillRect(-CAR_LEN * 0.52, -CAR_W * 0.42, 6, CAR_W * 0.84)
    g.strokeRect(-CAR_LEN * 0.52, -CAR_W * 0.42, 6, CAR_W * 0.84)
    // windshield glint
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath(); g.ellipse(-CAR_LEN * 0.1, -CAR_W * 0.12, 6, 2.5, -0.4, 0, Math.PI * 2); g.fill()
    g.restore()
  }
}
