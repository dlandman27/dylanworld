import type { CameraState } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'

// The world is a giant wooden table. Just the surface lives here — every game on
// it is an interactive TableGame in src/engine/games/.

type Ctx = CanvasRenderingContext2D
const INK = theme.colors.ink
const FLOOR = '#4a3d30'
const WOOD = '#d3a163'
const SEAM = 'rgba(110, 74, 36, 0.30)'
const RIM = '#8a5a2f'

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

export function drawTable(ctx: Ctx, cam: CameraState, canvas: HTMLCanvasElement, _t: number): void {
  ctx.save()
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom,
    canvas.width / 2 - cam.pos.x * cam.zoom,
    canvas.height / 2 - cam.pos.y * cam.zoom)

  // floor beyond the table
  ctx.fillStyle = FLOOR
  ctx.fillRect(-1200, -1200, world.width + 2400, world.height + 2400)

  // wooden tabletop
  roundRect(ctx, 0, 0, world.width, world.height, 60); ctx.fillStyle = WOOD; ctx.fill()
  ctx.save(); roundRect(ctx, 0, 0, world.width, world.height, 60); ctx.clip()
  ctx.strokeStyle = SEAM; ctx.lineWidth = 3
  for (let x = 240; x < world.width; x += 240) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, world.height); ctx.stroke() }
  ctx.strokeStyle = 'rgba(220,174,114,0.5)'; ctx.lineWidth = 2
  for (let y = 60; y < world.height; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(world.width, y); ctx.stroke() }
  ctx.restore()
  // table rim
  roundRect(ctx, 0, 0, world.width, world.height, 60); ctx.lineWidth = 22; ctx.strokeStyle = RIM; ctx.stroke()
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke()

  ctx.restore()
}
