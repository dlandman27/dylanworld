import type { CameraState, Vec2 } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { regions, ponds, paths } from '../config/scenery'
import { plaza } from '../config/town'
import { worldToScreen } from './world'

// The living-place layer: soft ground regions, ponds, paths, and a deterministic
// scatter of hand-drawn foliage that fills the blank paper. Drawn between the
// paper background and the props, with drifting cloud shadows on top.

type Kind = 'tree' | 'pine' | 'bush' | 'flower' | 'grass' | 'rock' | 'lily'
export interface SceneItem { kind: Kind; x: number; y: number; s: number; hue: string; rot: number }

const c = theme.colors
const INK = c.ink
const LEAF = '#7fae3b'
const LEAF_D = '#5f8f2e'
const TRUNK = '#a06a3c'
const ROCK = '#b3ab98'
const PAD = '#6fae5a'
const POND_FILL = '#bfe0f2'
const FLOWERS = [c.coral, c.orange, c.pink, c.purple, c.sky]

// deterministic PRNG so the world looks the same every visit
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const insideEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1

// keep the title band and the whole town-square footprint clear of clutter
function keepClear(x: number, y: number): boolean {
  if (Math.abs(x - world.spawn.x) < 660 && y > world.spawn.y - 360 && y < world.spawn.y - 40) return true
  return x > plaza.cx - plaza.w / 2 - 90 && x < plaza.cx + plaza.w / 2 + 90 &&
         y > plaza.cy - plaza.h / 2 - 90 && y < plaza.cy + plaza.h / 2 + 130
}
const onPond = (x: number, y: number): boolean => ponds.some(p => insideEllipse(x, y, p.x, p.y, p.rx, p.ry))
const regionAt = (x: number, y: number) => regions.find(r => insideEllipse(x, y, r.x, r.y, r.rx, r.ry))

export function createScenery(): SceneItem[] {
  const rnd = mulberry32(20260719)
  const items: SceneItem[] = []
  const N = 300
  let tries = 0
  while (items.length < N && tries < N * 14) {
    tries++
    const x = rnd() * world.width
    const y = rnd() * world.height
    if (keepClear(x, y)) continue

    if (onPond(x, y)) {
      if (rnd() < 0.7) continue // sparse lilypads
      items.push({ kind: 'lily', x, y, s: 0.7 + rnd() * 0.6, hue: '', rot: rnd() * 6.28 })
      continue
    }
    const reg = regionAt(x, y)
    if (!reg && rnd() < 0.5) continue // thinner outside regions

    const roll = rnd()
    let kind: Kind
    if (reg && reg.color === 'lime') {
      kind = roll < 0.15 ? 'tree' : roll < 0.27 ? 'pine' : roll < 0.5 ? 'bush' : roll < 0.79 ? 'flower' : 'grass'
    } else {
      kind = roll < 0.52 ? 'grass' : roll < 0.8 ? 'flower' : roll < 0.9 ? 'bush' : 'rock'
    }
    items.push({ kind, x, y, s: 0.72 + rnd() * 0.8, hue: FLOWERS[(rnd() * FLOWERS.length) | 0], rot: (rnd() - 0.5) * 0.3 })
  }
  items.sort((a, b) => a.y - b.y) // painter's order for a touch of depth
  return items
}

// ---------- drawing ----------
function polyToScreen(cam: CameraState, canvas: HTMLCanvasElement, pts: number[][]): Vec2[] {
  return pts.map(([x, y]) => worldToScreen(cam, canvas, { x, y }))
}

function drawRegions(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  const colors = c as unknown as Record<string, string>
  for (const r of regions) {
    const s = worldToScreen(cam, canvas, { x: r.x, y: r.y })
    ctx.save()
    ctx.globalAlpha = r.alpha
    ctx.fillStyle = colors[r.color] ?? c.lime
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, r.rx * cam.zoom, r.ry * cam.zoom, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawPaths(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  for (const line of paths) {
    const pts = polyToScreen(cam, canvas, line)
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // warm dirt road
    ctx.strokeStyle = '#e2d0a2'
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 26 * cam.zoom
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
    // dashed ink centerline
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = INK
    ctx.lineWidth = 2 * cam.zoom
    ctx.setLineDash([10 * cam.zoom, 12 * cam.zoom])
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
    ctx.restore()
  }
}

function drawPonds(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  for (const p of ponds) {
    const s = worldToScreen(cam, canvas, { x: p.x, y: p.y })
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, p.rx * cam.zoom, p.ry * cam.zoom, 0, 0, Math.PI * 2)
    ctx.fillStyle = POND_FILL
    ctx.fill()
    ctx.lineWidth = 3 * cam.zoom
    ctx.strokeStyle = INK
    ctx.stroke()
    // a couple of drifting ripple arcs
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.6 * cam.zoom
    for (let i = 0; i < 2; i++) {
      const rr = (0.35 + i * 0.28) * p.rx * cam.zoom
      const wob = Math.sin(t / 900 + i) * 0.15
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, rr, rr * 0.62, 0, 0.6 + wob, 2.2 + wob)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawItem(ctx: CanvasRenderingContext2D, it: SceneItem): void {
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  switch (it.kind) {
    case 'tree': {
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.ellipse(2, 26, 20, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = TRUNK
      ctx.fillRect(-4, 6, 8, 22); ctx.strokeRect(-4, 6, 8, 22)
      ctx.fillStyle = LEAF
      for (const [dx, dy, r] of [[-11, -6, 15], [11, -6, 15], [0, -18, 18]] as number[][]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      ctx.fillStyle = LEAF_D
      ctx.beginPath(); ctx.arc(-6, -2, 6, 0, Math.PI * 2); ctx.fill()
      break
    }
    case 'pine': {
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.ellipse(0, 28, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = TRUNK; ctx.fillRect(-3, 20, 6, 10); ctx.strokeRect(-3, 20, 6, 10)
      ctx.fillStyle = LEAF_D
      for (const [y, w] of [[22, 20], [10, 16], [-2, 11]] as number[][]) {
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - 20); ctx.lineTo(w, y); ctx.closePath(); ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'bush': {
      ctx.fillStyle = 'rgba(32,26,23,0.12)'
      ctx.beginPath(); ctx.ellipse(0, 10, 16, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = LEAF
      for (const [dx, dy, r] of [[-9, 2, 10], [9, 2, 10], [0, -4, 12]] as number[][]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'flower': {
      ctx.strokeStyle = LEAF_D; ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -2); ctx.stroke()
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6
      ctx.fillStyle = it.hue
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * 5, -6 + Math.sin(a) * 5, 3.6, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      ctx.fillStyle = '#f7c948'
      ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      break
    }
    case 'grass': {
      ctx.strokeStyle = LEAF_D; ctx.lineWidth = 2.2; ctx.lineCap = 'round'
      for (const dx of [-6, -2, 2, 6]) {
        ctx.beginPath(); ctx.moveTo(dx, 8); ctx.quadraticCurveTo(dx * 1.6, 0, dx * 1.3, -8); ctx.stroke()
      }
      break
    }
    case 'rock': {
      ctx.fillStyle = 'rgba(32,26,23,0.12)'
      ctx.beginPath(); ctx.ellipse(0, 8, 14, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = ROCK
      ctx.beginPath()
      ctx.moveTo(-12, 8); ctx.lineTo(-8, -6); ctx.lineTo(4, -9); ctx.lineTo(13, 2); ctx.lineTo(9, 8); ctx.closePath()
      ctx.fill(); ctx.stroke()
      break
    }
    case 'lily': {
      ctx.fillStyle = PAD
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, it.rot, 0.5, Math.PI * 2 + 0.1); ctx.closePath(); ctx.fill(); ctx.stroke()
      break
    }
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  const cloudSeeds = [[400, 300], [1600, 500], [2600, 900], [900, 1500], [2200, 1700]]
  ctx.save()
  for (const [bx, by] of cloudSeeds) {
    const wx = ((bx + t * 0.006) % (world.width + 600)) - 300
    const s = worldToScreen(cam, canvas, { x: wx, y: by })
    const rx = 220 * cam.zoom, ry = 120 * cam.zoom
    if (s.x < -rx * 2 || s.x > canvas.width + rx * 2 || s.y < -ry * 2 || s.y > canvas.height + ry * 2) continue
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rx)
    g.addColorStop(0, 'rgba(32,26,23,0.07)')
    g.addColorStop(1, 'rgba(32,26,23,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.ellipse(s.x, s.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

/** Ground layer: regions, paths, ponds, and the foliage scatter. */
export function drawScenery(ctx: CanvasRenderingContext2D, items: SceneItem[], cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  drawRegions(ctx, cam, canvas)
  drawPaths(ctx, cam, canvas)
  drawPonds(ctx, cam, canvas, t)
  for (const it of items) {
    const s = worldToScreen(cam, canvas, { x: it.x, y: it.y })
    const m = 60 * cam.zoom
    if (s.x < -m || s.y < -m || s.x > canvas.width + m || s.y > canvas.height + m) continue
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.scale(cam.zoom * it.s, cam.zoom * it.s)
    ctx.rotate(it.rot)
    drawItem(ctx, it)
    ctx.restore()
  }
}

/** Drifting cloud shadows — drawn last, above everything else. */
export function drawSkyShadows(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  drawClouds(ctx, cam, canvas, t)
}
