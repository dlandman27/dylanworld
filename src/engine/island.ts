import type { CameraState } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { districts, islandLobes, islets } from '../config/districts'
import type { District } from '../config/districts'

// The island layer: blue water, one sandy landmass, and the landmass carved into
// irregular zone regions (a Voronoi partition of the zone seeds) that tile it
// edge-to-edge. Each region is inset a little, so the sandy island shows through
// between regions as the pathways. Regions/coastline are computed once.

type Ctx = CanvasRenderingContext2D
type Pt = { x: number; y: number }
const c = theme.colors
const INK = c.ink
const WATER = '#9ccde6'
const SHALLOW = '#bfdfef'
const SAND = '#efe0b8'
const LETTERS = [c.coral, c.sky, c.lime, c.purple, c.orange, c.pink, c.teal, '#f7c948']
const GAP = 20 // half the pathway width between regions

// ---------- geometry helpers ----------
function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
function centroid(poly: Pt[]): Pt {
  let x = 0, y = 0
  for (const p of poly) { x += p.x; y += p.y }
  return { x: x / poly.length, y: y / poly.length }
}
/** Clip a polygon by the half-plane { p : (p - m)·n >= 0 }. */
function clipHalfPlane(poly: Pt[], m: Pt, n: Pt): Pt[] {
  const out: Pt[] = []
  const side = (p: Pt): number => (p.x - m.x) * n.x + (p.y - m.y) * n.y
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length]
    const dA = side(A), dB = side(B)
    if (dA >= 0) out.push(A)
    if ((dA >= 0) !== (dB >= 0)) {
      const t = dA / (dA - dB)
      out.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t })
    }
  }
  return out
}
function lineIntersect(p1: Pt, d1: Pt, p2: Pt, d2: Pt): Pt | null {
  const den = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(den) < 1e-6) return null
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }
}
/** Mitred inward inset of a (mostly convex) polygon by d. */
function insetPoly(poly: Pt[], d: number): Pt[] {
  const n = poly.length
  if (n < 3) return poly
  const cen = centroid(poly)
  const lines = poly.map((A, i) => {
    const B = poly[(i + 1) % n]
    const ex = B.x - A.x, ey = B.y - A.y
    const len = Math.hypot(ex, ey) || 1
    let nx = -ey / len, ny = ex / len
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2
    if ((cen.x - mx) * nx + (cen.y - my) * ny < 0) { nx = -nx; ny = -ny }
    return { p: { x: A.x + nx * d, y: A.y + ny * d }, dir: { x: ex, y: ey } }
  })
  const res: Pt[] = []
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i - 1 + n) % n], L2 = lines[i]
    const hit = lineIntersect(L1.p, L1.dir, L2.p, L2.dir)
    res.push(hit ?? poly[i])
  }
  return res
}
function scalePoly(poly: Pt[], s: number, cx: number, cy: number): Pt[] {
  return poly.map(p => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s }))
}
function path(g: Ctx, poly: Pt[]): void {
  g.beginPath()
  poly.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
  g.closePath()
}
/** Closed smooth curve that rounds every corner (midpoint-quadratic spline). */
function smoothPath(g: Ctx, poly: Pt[]): void {
  const n = poly.length
  if (n < 3) { path(g, poly); return }
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const start = mid(poly[n - 1], poly[0])
  g.beginPath()
  g.moveTo(start.x, start.y)
  for (let i = 0; i < n; i++) {
    const cur = poly[i], m = mid(cur, poly[(i + 1) % n])
    g.quadraticCurveTo(cur.x, cur.y, m.x, m.y)
  }
  g.closePath()
}

// ---------- build the island outline (union of lobes, star-sampled) ----------
const ISLAND_C: Pt = { x: 1920, y: 1620 }
function rayMaxT(o: Pt, u: Pt, l: { cx: number; cy: number; rx: number; ry: number }): number {
  const dx = o.x - l.cx, dy = o.y - l.cy
  const A = (u.x * u.x) / (l.rx * l.rx) + (u.y * u.y) / (l.ry * l.ry)
  const B = 2 * ((dx * u.x) / (l.rx * l.rx) + (dy * u.y) / (l.ry * l.ry))
  const C = (dx * dx) / (l.rx * l.rx) + (dy * dy) / (l.ry * l.ry) - 1
  const disc = B * B - 4 * A * C
  if (disc < 0) return -1
  return (-B + Math.sqrt(disc)) / (2 * A)
}
const islandPoly: Pt[] = (() => {
  const pts: Pt[] = []
  const N = 84
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const u = { x: Math.cos(a), y: Math.sin(a) }
    let r = 0
    for (const l of islandLobes) r = Math.max(r, rayMaxT(ISLAND_C, u, l))
    pts.push({ x: ISLAND_C.x + u.x * r, y: ISLAND_C.y + u.y * r })
  }
  return pts
})()

// ---------- carve zone regions (island-clipped Voronoi), inset for pathways ----
interface Cell { d: District; poly: Pt[] }
const cells: Cell[] = districts.map(d => {
  let poly = islandPoly
  const s: Pt = { x: d.cx, y: d.cy }
  for (const q of districts) {
    if (q === d) continue
    const m = { x: (s.x + q.cx) / 2, y: (s.y + q.cy) / 2 }
    const n = { x: s.x - q.cx, y: s.y - q.cy }
    poly = clipHalfPlane(poly, m, n)
    if (poly.length < 3) break
  }
  return { d, poly: poly.length >= 3 ? insetPoly(poly, GAP) : poly }
})

export function insideIsland(x: number, y: number): boolean {
  return pointInPoly({ x, y }, islandPoly)
}
export function districtAt(x: number, y: number): District | null {
  if (!insideIsland(x, y)) return null
  let best: District | null = null, bestD = Infinity
  for (const d of districts) {
    const dd = (x - d.cx) ** 2 + (y - d.cy) ** 2
    if (dd < bestD) { bestD = dd; best = d }
  }
  return best
}

// deterministic wave dashes in the open water
const waves: [number, number][] = []
{
  let s = 977
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  let guard = 0
  while (waves.length < 120 && guard++ < 2000) {
    const x = rnd() * (world.width + 800) - 400
    const y = rnd() * (world.height + 800) - 400
    if (!insideIsland(x, y)) waves.push([x, y])
  }
}

// ---------- labels ----------
function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
function rainbowCaps(g: Ctx, text: string, x: number, y: number, size: number, startColor: number): void {
  g.font = `900 ${size}px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  const widths = [...text].map(ch => g.measureText(ch).width)
  const gap = size * 0.07
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1)
  let cx = x - total / 2
  ;[...text].forEach((ch, i) => {
    const mid = cx + widths[i] / 2
    if (ch !== ' ') {
      g.fillStyle = INK; g.fillText(ch, mid + size * 0.05, y + size * 0.05)
      g.lineWidth = Math.max(3.5, size * 0.09); g.strokeStyle = INK; g.strokeText(ch, mid, y)
      g.fillStyle = LETTERS[(startColor + i) % LETTERS.length]; g.fillText(ch, mid, y)
    }
    cx += widths[i] + gap
  })
}
function drawZoneLabel(g: Ctx, d: District, colorStart: number): void {
  const x = d.cx, y = d.cy + (d.labelDy ?? 0)
  const nameSize = 30
  g.save()
  g.font = `900 ${nameSize}px ${theme.fonts.display}, Arial, sans-serif`
  const nameW = [...d.name].reduce((a, ch) => a + g.measureText(ch).width + nameSize * 0.07, 0)
  g.font = `700 14px ${theme.fonts.body}, sans-serif`
  const pw = Math.max(nameW, g.measureText(d.subtitle).width) + 30
  g.globalAlpha = 0.85; g.fillStyle = '#fbf3df'; g.strokeStyle = INK; g.lineWidth = 2.5
  roundRect(g, x - pw / 2, y - 28, pw, 56, 11); g.fill()
  g.globalAlpha = 1; g.stroke()
  rainbowCaps(g, d.name, x, y - 9, nameSize, colorStart)
  g.font = `700 14px ${theme.fonts.body}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = INK; g.fillText(d.subtitle, x, y + 15)
  g.restore()
}

export function drawIsland(ctx: Ctx, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  ctx.save()
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom,
    canvas.width / 2 - cam.pos.x * cam.zoom,
    canvas.height / 2 - cam.pos.y * cam.zoom)

  // open water
  ctx.fillStyle = WATER
  ctx.fillRect(-800, -800, world.width + 1600, world.height + 1600)

  // bobbing wave dashes
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  for (let i = 0; i < waves.length; i++) {
    const [x, y] = waves[i]; const bob = Math.sin(t / 1400 + i) * 3
    ctx.beginPath(); ctx.moveTo(x, y + bob); ctx.quadraticCurveTo(x + 12, y - 6 + bob, x + 24, y + bob); ctx.stroke()
  }

  // island: shallow halo, ink coast, sand fill
  smoothPath(ctx, scalePoly(islandPoly, 1.05, ISLAND_C.x, ISLAND_C.y)); ctx.fillStyle = SHALLOW; ctx.fill()
  smoothPath(ctx, scalePoly(islandPoly, 1.02, ISLAND_C.x, ISLAND_C.y)); ctx.fillStyle = INK; ctx.fill()
  smoothPath(ctx, islandPoly); ctx.fillStyle = SAND; ctx.fill()
  // decorative islets
  for (const isl of islets) {
    ctx.beginPath(); ctx.arc(isl.cx, isl.cy, isl.r + 5, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill()
    ctx.beginPath(); ctx.arc(isl.cx, isl.cy, isl.r, 0, Math.PI * 2); ctx.fillStyle = SAND; ctx.fill()
  }

  // zone regions (tinted, inset — sand gaps between them are the pathways)
  for (const cell of cells) {
    if (cell.poly.length < 3) continue
    smoothPath(ctx, cell.poly)
    ctx.fillStyle = cell.d.tint; ctx.fill()
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.stroke()
  }

  districts.forEach((d, i) => drawZoneLabel(ctx, d, i * 2))
  ctx.restore()
}
