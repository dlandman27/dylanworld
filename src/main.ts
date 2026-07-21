import type { CameraState } from './types'
import { createCamera, updateCameraPan, stepZoom } from './engine/world'
import { createInput, updateInputWorld } from './engine/input'
import { createProps, updatePhysics, drawProps, drawImpacts } from './engine/physics'
import { drawTable } from './engine/table'
import { createGames } from './engine/games'
import { bindLens } from './engine/games/magnifier'
import { driveTarget } from './engine/games/hotwheels'
import { initCursors } from './engine/cursor'
import { initCursorShop } from './ui/cursorShop'
import { initAudio } from './engine/audio'
import { setPointer } from './engine/pointer'
import { initNet, sendCursor } from './engine/net'
import { drawPeerCursors } from './ui/peerCursors'
import { initTableHost } from './ui/tableHost'
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
initNet()          // joins ?room=XXXX if present
initTableHost()    // "host a table" chip
let last = performance.now()

/**
 * Draw the whole world with an arbitrary camera into any context — the frame
 * loop draws to the screen; the magnifier's lens draws into its offscreen.
 */
function renderWorld(cam: CameraState, now: number, rc: CanvasRenderingContext2D = ctx): void {
  rc.save()
  rc.setTransform(1, 0, 0, 1, 0, 0)
  drawTable(rc, cam, canvas, now)
  // games render in world coordinates under one camera transform
  rc.save()
  rc.setTransform(cam.zoom, 0, 0, cam.zoom,
    canvas.width / 2 - cam.pos.x * cam.zoom,
    canvas.height / 2 - cam.pos.y * cam.zoom)
  for (const g of games) g.draw(rc, now)
  rc.restore()
  drawProps(rc, props, cam, canvas)
  // tall pieces (e.g. the standing top) render above the props layer
  rc.save()
  rc.setTransform(cam.zoom, 0, 0, cam.zoom,
    canvas.width / 2 - cam.pos.x * cam.zoom,
    canvas.height / 2 - cam.pos.y * cam.zoom)
  for (const g of games) g.drawAbove?.(rc, now)
  rc.restore()
  rc.restore()
}
bindLens({ camera, canvas, render: renderWorld })

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  stepZoom(camera, canvas, dt)               // ease zoom toward its target
  updateCameraPan(camera, input, canvas, dt) // cursor drags/glides the table
  // while driving a car, the camera rides along
  const drive = driveTarget()
  if (drive && !input.panning) {
    const follow = 1 - Math.exp(-4 * dt)
    camera.pos.x += (drive.x - camera.pos.x) * follow
    camera.pos.y += (drive.y - camera.pos.y) * follow
    camera.vel.x = 0
    camera.vel.y = 0
  }
  updateInputWorld(input, camera, canvas)     // world point under the cursor, post-pan
  setPointer(input.world.x, input.world.y)    // publish cursor pos for ambient critters
  sendCursor(input.world.x, input.world.y)
  updatePhysics(props, input, camera, dt)
  for (const g of games) g.update(dt, now)

  renderWorld(camera, now)
  drawImpacts(ctx, camera, canvas)
  drawPeerCursors(ctx, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
