import { createCamera, updateCamera, drawWorldBackground } from './engine/world'
import { createInput, updateInputWorld } from './engine/input'
import { createCharacter, updateCharacter, drawCharacter } from './engine/character'
import { createProps, updatePhysics, drawProps } from './engine/physics'
import { createLandmarks, updateLandmarks, drawLandmarks } from './engine/landmarks'

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
const input = createInput(canvas)
const character = createCharacter()
const props = createProps()
const landmarks = createLandmarks()
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  updateInputWorld(input, camera, canvas)
  updateCharacter(character, input, dt)
  updatePhysics(props, character.body, input, camera, dt)
  updateLandmarks(landmarks, character.body, dt)
  updateCamera(camera, character.body.pos, dt)
  drawWorldBackground(ctx, camera, canvas)
  drawLandmarks(ctx, landmarks, camera, canvas, character.body.pos)
  drawProps(ctx, props, camera, canvas)
  drawCharacter(ctx, character, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
