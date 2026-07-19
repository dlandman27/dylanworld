import { createCamera, updateCamera, drawWorldBackground } from './engine/world'
import { createInput, updateInputWorld } from './engine/input'
import { createCharacter, updateCharacter, drawCharacter } from './engine/character'

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
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  updateInputWorld(input, camera, canvas)
  updateCharacter(character, input, dt)
  updateCamera(camera, character.body.pos, dt)
  drawWorldBackground(ctx, camera, canvas)
  drawCharacter(ctx, character, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
