// The marble's rolling look, extracted so any sphere can reuse it: a texture
// that SCROLLS with the travel vector, bent through a fisheye lens (magnified
// centre, compressed rim), tiled seamlessly on a 2×2 super-tile, with curvature
// shading and a fixed glint. The pattern itself is pluggable — supply a `paint`
// that draws one cell using the provided warp() + seeded rnd().
//
// Draw with the context translated so the ball centre is the origin.

type Ctx = CanvasRenderingContext2D

export interface CellCtx {
  /** cell centre in pattern space (origin = ball centre) */
  cellX: number
  cellY: number
  /** cell size (pattern-space) */
  s: number
  /** ball radius */
  r: number
  /** fisheye warp for any pattern-space point */
  warp: (px: number, py: number) => { x: number; y: number; sc: number }
  /** seeded RNG, stable per super-tile cell (so the texture tiles) */
  rnd: () => number
}

export interface RollingBallOpts {
  r: number
  /** travel-accumulated offset (tex.x/tex.y grow with the movement vector) */
  tex: { x: number; y: number }
  body: string
  ink: string
  /** stable per-object seed (e.g. a prop id) */
  seed?: number
  /** style index mixed into the seed */
  style?: number
  /** cell size as a multiple of r (default 2.4) */
  cellSize?: number
  /** fisheye strength (default 0.18 — bigger = more bulge) */
  lens?: number
  paint: (g: Ctx, c: CellCtx) => void
}

export function drawRollingBall(g: Ctx, o: RollingBallOpts): void {
  const r = o.r
  const s = r * (o.cellSize ?? 2.4)
  const lens = o.lens ?? 0.18
  // shadow
  g.fillStyle = 'rgba(32,26,23,0.22)'
  g.beginPath(); g.ellipse(2, 4, r, r * 0.85, 0, 0, Math.PI * 2); g.fill()
  // body
  g.fillStyle = o.body
  g.strokeStyle = o.ink
  g.lineWidth = 2.4
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke()
  // clipped, scrolling, fisheye texture
  g.save()
  g.beginPath(); g.arc(0, 0, r - 1.5, 0, Math.PI * 2); g.clip()
  const ox = ((o.tex.x % s) + s) % s
  const oy = ((o.tex.y % s) + s) % s
  const nx = Math.floor(o.tex.x / s)
  const ny = Math.floor(o.tex.y / s)
  const warp = (px: number, py: number): { x: number; y: number; sc: number } => {
    const d = Math.hypot(px, py)
    const w = 1 / (1 + lens * (d / r) * (d / r))
    return { x: px * w, y: py * w, sc: w }
  }
  for (let gx = -2; gx <= 2; gx++) {
    for (let gy = -2; gy <= 2; gy++) {
      const cellX = gx * s + ox - s
      const cellY = gy * s + oy - s
      if (Math.hypot(cellX, cellY) > r * 2.6) continue
      const kx = (((gx - nx) % 2) + 2) % 2 // stable identity across wraps
      const ky = (((gy - ny) % 2) + 2) % 2
      let seed = ((o.seed ?? 1) * 7919 + kx * 131 + ky * 137 + (o.style ?? 0) * 17) | 0
      const rnd = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      o.paint(g, { cellX, cellY, s, r, warp, rnd })
    }
  }
  // curvature shading so it still reads as a sphere
  g.fillStyle = 'rgba(32,26,23,0.14)'
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2)
  g.arc(-r * 0.18, -r * 0.22, r * 0.92, 0, Math.PI * 2, true); g.fill()
  g.restore()
  // fixed glint on top
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath(); g.ellipse(-r * 0.35, -r * 0.42, r * 0.24, r * 0.13, -0.6, 0, Math.PI * 2); g.fill()
}
