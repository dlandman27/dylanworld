import type { CameraState, InputState, Vec2 } from '../types'
import { world } from '../config/world'
import { theme } from '../config/theme'
import { tuning } from '../config/tuning'

export const MIN_ZOOM = 0.45
export const MAX_ZOOM = 2.6

export function createCamera(): CameraState {
  return {
    pos: { x: world.spawn.x, y: world.spawn.y },
    vel: { x: 0, y: 0 },
    zoom: 1, zoomTarget: 1, zoomFocus: { x: 0, y: 0 },
  }
}

/** Keep the view on the paper; if the paper is smaller than the viewport, center it. */
function clampCamera(cam: CameraState, canvas: HTMLCanvasElement): void {
  const viewW = canvas.width / cam.zoom
  const viewH = canvas.height / cam.zoom
  cam.pos.x = world.width <= viewW
    ? world.width / 2
    : Math.min(Math.max(cam.pos.x, viewW / 2), world.width - viewW / 2)
  cam.pos.y = world.height <= viewH
    ? world.height / 2
    : Math.min(Math.max(cam.pos.y, viewH / 2), world.height - viewH / 2)
}

const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/**
 * Set the camera zoom immediately, keeping the world point under (sx, sy) fixed
 * on screen. Used for pinch, which should track the fingers 1:1.
 */
export function zoomAt(cam: CameraState, canvas: HTMLCanvasElement, sx: number, sy: number, nextZoom: number): void {
  const z = clampZoom(nextZoom)
  const anchor = screenToWorld(cam, canvas, { x: sx, y: sy })
  cam.zoom = z
  cam.pos.x = anchor.x - (sx - canvas.width / 2) / z
  cam.pos.y = anchor.y - (sy - canvas.height / 2) / z
  cam.zoomTarget = z
  cam.zoomFocus = { x: sx, y: sy }
  clampCamera(cam, canvas)
}

/** Ask the camera to ease toward a new zoom, homing on (sx, sy). */
export function requestZoom(cam: CameraState, sx: number, sy: number, nextTarget: number): void {
  cam.zoomTarget = clampZoom(nextTarget)
  cam.zoomFocus = { x: sx, y: sy }
}

/** Ease the live zoom toward its target, keeping zoomFocus pinned. Call each frame. */
export function stepZoom(cam: CameraState, canvas: HTMLCanvasElement, dt: number): void {
  if (Math.abs(cam.zoomTarget - cam.zoom) < 0.0005) { cam.zoom = cam.zoomTarget; return }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const t = reduce ? 1 : 1 - Math.exp(-14 * dt)
  const z = cam.zoom + (cam.zoomTarget - cam.zoom) * t
  const anchor = screenToWorld(cam, canvas, cam.zoomFocus)
  cam.zoom = z
  cam.pos.x = anchor.x - (cam.zoomFocus.x - canvas.width / 2) / z
  cam.pos.y = anchor.y - (cam.zoomFocus.y - canvas.height / 2) / z
  clampCamera(cam, canvas)
}

/**
 * Cursor-driven camera. While panning, the paper point grabbed at pointerdown
 * stays pinned exactly under the cursor (tactile "drag the sheet"). On release,
 * the sheet keeps the drag velocity and glides to a stop.
 */
export function updateCameraPan(cam: CameraState, input: InputState, canvas: HTMLCanvasElement, dt: number): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const prevX = cam.pos.x, prevY = cam.pos.y
  if (input.panning) {
    cam.pos.x = input.panAnchor.x - (input.screen.x - canvas.width / 2) / cam.zoom
    cam.pos.y = input.panAnchor.y - (input.screen.y - canvas.height / 2) / cam.zoom
    clampCamera(cam, canvas)
    if (dt > 0) {
      const cap = 4000
      cam.vel.x = reduce ? 0 : Math.max(-cap, Math.min(cap, (cam.pos.x - prevX) / dt))
      cam.vel.y = reduce ? 0 : Math.max(-cap, Math.min(cap, (cam.pos.y - prevY) / dt))
    }
  } else {
    cam.pos.x += cam.vel.x * dt
    cam.pos.y += cam.vel.y * dt
    const fr = Math.exp(-tuning.paperFriction * dt)
    cam.vel.x *= fr
    cam.vel.y *= fr
    clampCamera(cam, canvas)
  }
}

export function worldToScreen(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: (p.x - cam.pos.x) * cam.zoom + canvas.width / 2, y: (p.y - cam.pos.y) * cam.zoom + canvas.height / 2 }
}

export function screenToWorld(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: (p.x - canvas.width / 2) / cam.zoom + cam.pos.x, y: (p.y - canvas.height / 2) / cam.zoom + cam.pos.y }
}

/** Paper background + subtle ink dot grid + world edge as a hand-drawn border. */
export function drawWorldBackground(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  ctx.fillStyle = theme.colors.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const origin = worldToScreen(cam, canvas, { x: 0, y: 0 })
  // dot grid every 120 world units (scaled to screen by zoom)
  ctx.fillStyle = 'rgba(32, 26, 23, 0.08)'
  const step = 120 * cam.zoom
  const dot = Math.max(1.5, 1.5 * cam.zoom)
  const startX = ((origin.x % step) + step) % step
  const startY = ((origin.y % step) + step) % step
  for (let x = startX; x < canvas.width; x += step) {
    for (let y = startY; y < canvas.height; y += step) {
      ctx.fillRect(x - dot, y - dot, dot * 2, dot * 2)
    }
  }
  // world border
  ctx.strokeStyle = theme.colors.ink
  ctx.lineWidth = 6 * cam.zoom
  ctx.strokeRect(origin.x, origin.y, world.width * cam.zoom, world.height * cam.zoom)
}
