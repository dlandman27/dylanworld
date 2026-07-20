import { createCamera, updateCameraPan, stepZoom } from './engine/world'
import { createInput, updateInputWorld } from './engine/input'
import { createProps, updatePhysics, drawProps, drawImpacts } from './engine/physics'
import { drawTable } from './engine/table'
import { createGames } from './engine/games'
import { initCursors } from './engine/cursor'
import { initCursorShop } from './ui/cursorShop'
import { initAudio } from './engine/audio'
// Parked experiments (island map, scenery, town square):
// import { drawIsland } from './engine/island'
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
const games = createGames()
const input = createInput(canvas, camera, props, games)
initCursors()      // custom hand-drawn cursor + trail/click fx
initCursorShop()   // browse & equip cursors (prices 0 for now)
initAudio()        // clunks arm on the first pointer press
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  stepZoom(camera, canvas, dt)               // ease zoom toward its target
  updateCameraPan(camera, input, canvas, dt) // cursor drags/glides the table
  updateInputWorld(input, camera, canvas)     // world point under the cursor, post-pan
  updatePhysics(props, input, camera, dt)
  for (const g of games) g.update(dt, now)

  drawTable(ctx, camera, canvas, now)
  // games render in world coordinates under one camera transform
  ctx.save()
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom,
    canvas.width / 2 - camera.pos.x * camera.zoom,
    canvas.height / 2 - camera.pos.y * camera.zoom)
  for (const g of games) g.draw(ctx, now)
  ctx.restore()
  drawProps(ctx, props, camera, canvas)
  drawImpacts(ctx, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
