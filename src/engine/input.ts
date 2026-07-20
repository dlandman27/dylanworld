import type { CameraState, InputState, Prop, Vec2 } from '../types'
import type { TableGame } from './games/shared'
import { screenToWorld, zoomAt, requestZoom } from './world'

/**
 * The cursor is the only agent in the world. At pointerdown we decide the
 * gesture once, in priority order: a GAME under the cursor captures the pointer
 * (chess drag, puck fling…); else a prop grabs; else drag the table to pan.
 * Wheel and two-finger pinch zoom, homing on the cursor / pinch midpoint.
 * `props`/`games` are live references so hit-tests always see current state.
 */
export function createInput(canvas: HTMLCanvasElement, cam: CameraState, props: Prop[], games: TableGame[]): InputState {
  const input: InputState = {
    screen: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    world: { x: 0, y: 0 },
    down: false,
    grabbed: null,
    panning: false,
    panAnchor: { x: 0, y: 0 },
  }

  // active pointers, keyed by id — one = game/grab/pan, two = pinch-zoom
  const pointers = new Map<number, Vec2>()
  let pinchDist = 0
  let pinchMid: Vec2 = { x: 0, y: 0 }
  // the game currently holding the pointer, plus cursor velocity for flicks
  let activeGame: TableGame | null = null
  let lastW: { x: number; y: number; t: number } | null = null
  let velW = { x: 0, y: 0 }

  const trackVel = (w: Vec2, ts: number): void => {
    if (lastW) {
      const dt = Math.max(1, ts - lastW.t) / 1000
      velW = { x: (w.x - lastW.x) / dt * 0.5 + velW.x * 0.5, y: (w.y - lastW.y) / dt * 0.5 + velW.y * 0.5 }
    }
    lastW = { x: w.x, y: w.y, t: ts }
  }

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
    if (hit) {
      input.grabbed = hit
      hit.grabbed = true
      // bring to the top of the pile so a lifted piece draws above the rest
      const idx = props.indexOf(hit)
      if (idx !== -1) { props.splice(idx, 1); props.push(hit) }
      return true
    }
    return false
  }
  const releaseGrab = (): void => {
    if (!input.grabbed) return
    input.grabbed.grabbed = false
    input.grabbed = null
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
      const w = screenToWorld(cam, canvas, { x: e.clientX, y: e.clientY })
      lastW = { x: w.x, y: w.y, t: e.timeStamp }
      velW = { x: 0, y: 0 }
      // games claim the pointer first (topmost drawn = last in array)
      activeGame = null
      for (let i = games.length - 1; i >= 0; i--) {
        if (games[i].onDown(w.x, w.y)) { activeGame = games[i]; break }
      }
      if (!activeGame && !grabAt(e.clientX, e.clientY)) startPan(e.clientX, e.clientY)
    } else if (pointers.size === 2) {
      // second finger down: drop any game/grab/pan and begin a pinch
      if (activeGame) { activeGame.onUp(lastW?.x ?? 0, lastW?.y ?? 0, 0, 0); activeGame = null }
      releaseGrab()
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
    if (activeGame) {
      const w = screenToWorld(cam, canvas, { x: e.clientX, y: e.clientY })
      trackVel(w, e.timeStamp)
      activeGame.onMove(w.x, w.y)
    }
  })

  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId)
    if (pointers.size === 1) {
      // dropped from a pinch to one finger — hand back to a fresh paper drag
      releaseGrab()
      const [only] = twoPointers()
      input.screen = { ...only }
      startPan(only.x, only.y)
    } else if (pointers.size === 0) {
      input.down = false
      if (activeGame) {
        const w = screenToWorld(cam, canvas, { x: e.clientX, y: e.clientY })
        activeGame.onUp(w.x, w.y, velW.x, velW.y)
        activeGame = null
      }
      releaseGrab()
      input.panning = false
      pinchDist = 0
      lastW = null
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
