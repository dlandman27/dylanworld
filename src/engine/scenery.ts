import type { CameraState } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { ponds } from '../config/scenery'
import { plaza } from '../config/town'
import { insideIsland, districtAt } from './island'
import { worldToScreen } from './world'

// The living-place layer: ponds and a deterministic, biome-aware scatter of
// hand-drawn foliage across the island. Drawn between the island layer and the
// props, with drifting cloud shadows on top.

type Kind = 'tree' | 'pine' | 'bush' | 'flower' | 'grass' | 'rock' | 'lily' | 'palm' | 'cactus'
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

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

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
  if (Math.abs(x - world.spawn.x) < 660 && y > world.spawn.y - 460 && y < world.spawn.y - 120) return true
  return x > plaza.cx - plaza.w / 2 - 90 && x < plaza.cx + plaza.w / 2 + 90 &&
         y > plaza.cy - plaza.h / 2 - 90 && y < plaza.cy + plaza.h / 2 + 130
}
const onPond = (x: number, y: number): boolean => ponds.some(p => insideEllipse(x, y, p.x, p.y, p.rx, p.ry))

// biome recipes: weighted kinds + foliage hue per district theme
type Pick = { kind: Kind; w: number; hue?: string }
const BIOMES: Record<string, Pick[]> = {
  grass:  [{ kind: 'tree', w: 3 }, { kind: 'bush', w: 3 }, { kind: 'flower', w: 4 }, { kind: 'grass', w: 4 }, { kind: 'pine', w: 1 }],
  farm:   [{ kind: 'flower', w: 4 }, { kind: 'grass', w: 4 }, { kind: 'tree', w: 2 }, { kind: 'bush', w: 1 }],
  forest: [{ kind: 'tree', w: 4 }, { kind: 'pine', w: 3 }, { kind: 'bush', w: 2 }, { kind: 'flower', w: 2 }],
  sand:   [{ kind: 'palm', w: 2 }, { kind: 'cactus', w: 3 }, { kind: 'rock', w: 2 }, { kind: 'grass', w: 1 }],
  beach:  [{ kind: 'palm', w: 4 }, { kind: 'rock', w: 2 }, { kind: 'grass', w: 1 }],
  tech:   [{ kind: 'rock', w: 3 }, { kind: 'grass', w: 2 }, { kind: 'bush', w: 1 }],
  space:  [{ kind: 'rock', w: 3 }, { kind: 'grass', w: 1 }],
}
const HUB: Pick[] = [{ kind: 'flower', w: 3 }, { kind: 'grass', w: 4 }, { kind: 'bush', w: 1 }]

function pickKind(rnd: () => number, picks: Pick[]): Pick {
  const total = picks.reduce((a, p) => a + p.w, 0)
  let roll = rnd() * total
  for (const p of picks) { roll -= p.w; if (roll <= 0) return p }
  return picks[0]
}

export function createScenery(): SceneItem[] {
  const rnd = mulberry32(20260719)
  const items: SceneItem[] = []
  const N = 430
  let tries = 0
  while (items.length < N && tries < N * 16) {
    tries++
    const x = rnd() * world.width
    const y = rnd() * world.height
    if (!insideIsland(x, y) || keepClear(x, y)) continue

    if (onPond(x, y)) {
      if (rnd() < 0.7) continue // sparse lilypads
      items.push({ kind: 'lily', x, y, s: 0.7 + rnd() * 0.6, hue: '', rot: rnd() * 6.28 })
      continue
    }
    const district = districtAt(x, y)
    const picks = district ? BIOMES[district.theme] ?? HUB : HUB
    const p = pickKind(rnd, picks)
    const hue = p.hue ?? (p.kind === 'flower' ? FLOWERS[(rnd() * FLOWERS.length) | 0] : '')
    items.push({ kind: p.kind, x, y, s: 0.72 + rnd() * 0.8, hue, rot: (rnd() - 0.5) * 0.3 })
  }
  items.sort((a, b) => a.y - b.y) // painter's order for a touch of depth
  return items
}

// ---------- drawing ----------
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
      const leaf = it.hue || LEAF
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.ellipse(2, 26, 20, 6, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = TRUNK
      ctx.fillRect(-4, 6, 8, 22); ctx.strokeRect(-4, 6, 8, 22)
      ctx.fillStyle = leaf
      for (const [dx, dy, r] of [[-11, -6, 15], [11, -6, 15], [0, -18, 18]] as number[][]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      }
      ctx.globalAlpha = 0.5
      ctx.fillStyle = it.hue ? '#ffffff' : LEAF_D
      ctx.beginPath(); ctx.arc(-6, -2, 6, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      break
    }
    case 'pine': {
      const leaf = it.hue || LEAF_D
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.ellipse(0, 28, 16, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = TRUNK; ctx.fillRect(-3, 20, 6, 10); ctx.strokeRect(-3, 20, 6, 10)
      ctx.fillStyle = leaf
      for (const [y, w] of [[22, 20], [10, 16], [-2, 11]] as number[][]) {
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(0, y - 20); ctx.lineTo(w, y); ctx.closePath(); ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'palm': {
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.ellipse(4, 26, 18, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = TRUNK; ctx.lineWidth = 6; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(-2, 26); ctx.quadraticCurveTo(2, 6, 8, -12); ctx.stroke()
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(-2, 26); ctx.quadraticCurveTo(2, 6, 8, -12); ctx.stroke()
      ctx.fillStyle = LEAF; ctx.lineWidth = 2
      for (const a of [-2.6, -1.9, -1.1, -0.4, 0.3]) {
        ctx.beginPath()
        ctx.ellipse(8 + Math.cos(a) * 12, -14 + Math.sin(a) * 8, 13, 4.5, a, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke()
      }
      break
    }
    case 'cactus': {
      ctx.fillStyle = 'rgba(32,26,23,0.12)'
      ctx.beginPath(); ctx.ellipse(0, 22, 12, 4, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#7fae5b'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'
      // trunk + two arms
      rr(ctx, -5, -18, 10, 40, 5); ctx.fill(); ctx.stroke()
      rr(ctx, -16, -8, 8, 16, 4); ctx.fill(); ctx.stroke()
      rr(ctx, -16, -8, 12, 7, 3.5); ctx.fill(); ctx.stroke()
      rr(ctx, 8, -14, 8, 14, 4); ctx.fill(); ctx.stroke()
      rr(ctx, 4, -14, 12, 7, 3.5); ctx.fill(); ctx.stroke()
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

/** Ground layer: ponds and the biome foliage scatter (island layer drew the land). */
export function drawScenery(ctx: CanvasRenderingContext2D, items: SceneItem[], cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
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
