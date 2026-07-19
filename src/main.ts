import { createCamera, updateCameraPan, stepZoom } from './engine/world'
import { createInput, updateInputWorld } from './engine/input'
import { createProps, updatePhysics, drawProps } from './engine/physics'
import { drawIsland } from './engine/island'
import { initCursors } from './engine/cursor'
import { initCursorShop } from './ui/cursorShop'
// Terrain-shape pass: town square + foliage are parked until the coastline is right.
// import { createScenery, drawScenery, drawSkyShadows } from './engine/scenery'
// import { drawTown } from './engine/town'
// Landmark "houses" are parked for now — we'll place the sites later.
// import { createLandmarks, updateLandmarks, drawLandmarks } from './engine/landmarks'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function resize(): void {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  ctx.imageSmoothingEnabled = false
}
window.addEventListener('resize', resize)
resize()

const camera = createCamera()
const props = createProps()
const input = createInput(canvas, camera, props)
initCursors()      // custom hand-drawn cursor + trail/click fx
initCursorShop()   // browse & equip cursors (prices 0 for now)
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  stepZoom(camera, canvas, dt)               // ease zoom toward its target
  updateCameraPan(camera, input, canvas, dt) // cursor drags/glides the paper
  updateInputWorld(input, camera, canvas)     // world point under the cursor, post-pan
  updatePhysics(props, input, camera, dt)

  drawIsland(ctx, camera, canvas, now)
  drawProps(ctx, props, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
