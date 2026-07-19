import type { CameraState, InputState, Prop, Vec2 } from '../types'
import { screenToWorld, zoomAt, requestZoom } from './world'

/**
 * The cursor is the only agent in the world. At pointerdown we decide the
 * gesture once: grab a prop under the cursor (to fling) or drag the paper.
 * Wheel and two-finger pinch zoom, homing on the cursor / pinch midpoint.
 * `props` is the live array so the hit-test always sees current positions.
 */
export function createInput(canvas: HTMLCanvasElement, cam: CameraState, props: Prop[]): InputState {
  const input: InputState = {
    screen: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    world: { x: 0, y: 0 },
    down: false,
    grabbed: null,
    panning: false,
    panAnchor: { x: 0, y: 0 },
  }

  // active pointers, keyed by id — one = grab/pan, two = pinch-zoom
  const pointers = new Map<number, Vec2>()
  let pinchDist = 0
  let pinchMid: Vec2 = { x: 0, y: 0 }

  const startPan = (sx: number, sy: number): void => {
    input.panning = true
    input.panAnchor = screenToWorld(cam, canvas, { x: sx, y: sy })
    cam.vel.x = 0; cam.vel.y = 0
  }
  const grabAt = (sx: number, sy: number): boolean => {
    const w = screenToWorld(cam, canvas, { x: sx, y: sy })
    let hit: Prop | null = null
    let best = Infinity
    for (const p of props) {
      const d = Math.hypot(p.pos.x - w.x, p.pos.y - w.y)
      if (d < p.radius + 14 && d < best) { best = d; hit = p }
    }
    if (hit) { input.grabbed = hit; hit.grabbed = true; return true }
    return false
  }
  const twoPointers = (): [Vec2, Vec2] => {
    const it = pointers.values()
    return [it.next().value as Vec2, it.next().value as Vec2]
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    input.screen.x = e.clientX
    input.screen.y = e.clientY
    input.down = true

    if (pointers.size === 1) {
      if (!grabAt(e.clientX, e.clientY)) startPan(e.clientX, e.clientY)
    } else if (pointers.size === 2) {
      // second finger down: drop any grab/pan and begin a pinch
      if (input.grabbed) { input.grabbed.grabbed = false; input.grabbed = null }
      input.panning = false
      const [a, b] = twoPointers()
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size >= 2) {
      const [a, b] = twoPointers()
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      // translate with the midpoint, then scale by the finger-spread ratio
      cam.pos.x -= (mid.x - pinchMid.x) / cam.zoom
      cam.pos.y -= (mid.y - pinchMid.y) / cam.zoom
      if (pinchDist > 0) zoomAt(cam, canvas, mid.x, mid.y, cam.zoom * (dist / pinchDist))
      pinchDist = dist
      pinchMid = mid
      input.screen = mid
      return
    }
    input.screen.x = e.clientX
    input.screen.y = e.clientY
  })

  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId)
    if (pointers.size === 1) {
      // dropped from a pinch to one finger — hand back to a fresh paper drag
      if (input.grabbed) { input.grabbed.grabbed = false; input.grabbed = null }
      const [only] = twoPointers()
      input.screen = { ...only }
      startPan(only.x, only.y)
    } else if (pointers.size === 0) {
      input.down = false
      if (input.grabbed) { input.grabbed.grabbed = false; input.grabbed = null }
      input.panning = false
      pinchDist = 0
    }
  }
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  // wheel: up = zoom in, down = zoom out, easing toward the cursor.
  // Base off zoomTarget so fast scroll ticks accumulate into one smooth glide.
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const factor = Math.exp((e.deltaY < 0 ? 1 : -1) * 0.22)
    requestZoom(cam, e.clientX, e.clientY, cam.zoomTarget * factor)
  }, { passive: false })

  return input
}

/** Recompute the world point under the cursor (call after the camera moves). */
export function updateInputWorld(input: InputState, cam: CameraState, canvas: HTMLCanvasElement): void {
  input.world = screenToWorld(cam, canvas, input.screen)
}
