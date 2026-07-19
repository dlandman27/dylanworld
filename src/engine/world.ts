import type { CameraState, Vec2 } from '../types'
import { world } from '../config/world'
import { theme } from '../config/theme'
import { tuning } from '../config/tuning'

export function createCamera(): CameraState {
  return { pos: { x: world.spawn.x, y: world.spawn.y } }
}

/** Exponential follow toward target; snaps if prefers-reduced-motion. */
export function updateCamera(cam: CameraState, target: Vec2, dt: number): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const t = reduce ? 1 : 1 - Math.exp(-tuning.cameraLag * dt)
  cam.pos.x += (target.x - cam.pos.x) * t
  cam.pos.y += (target.y - cam.pos.y) * t
  // clamp so the view never leaves the paper
  const halfW = window.innerWidth / 2
  const halfH = window.innerHeight / 2
  cam.pos.x = Math.min(Math.max(cam.pos.x, halfW), world.width - halfW)
  cam.pos.y = Math.min(Math.max(cam.pos.y, halfH), world.height - halfH)
}

export function worldToScreen(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: p.x - cam.pos.x + canvas.width / 2, y: p.y - cam.pos.y + canvas.height / 2 }
}

export function screenToWorld(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: p.x + cam.pos.x - canvas.width / 2, y: p.y + cam.pos.y - canvas.height / 2 }
}

/** Paper background + subtle ink dot grid + world edge as a hand-drawn border. */
export function drawWorldBackground(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  ctx.fillStyle = theme.colors.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const origin = worldToScreen(cam, canvas, { x: 0, y: 0 })
  // dot grid every 120 units
  ctx.fillStyle = 'rgba(32, 26, 23, 0.08)'
  const step = 120
  const startX = ((origin.x % step) + step) % step
  const startY = ((origin.y % step) + step) % step
  for (let x = startX; x < canvas.width; x += step) {
    for (let y = startY; y < canvas.height; y += step) {
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
    }
  }
  // world border
  ctx.strokeStyle = theme.colors.ink
  ctx.lineWidth = 6
  ctx.strokeRect(origin.x, origin.y, world.width, world.height)
}
