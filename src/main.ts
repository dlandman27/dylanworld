import { createCamera, updateCamera, drawWorldBackground, worldToScreen } from './engine/world'
import { world } from './config/world'
import { createInput, updateInputWorld } from './engine/input'

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
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  updateInputWorld(input, camera, canvas)
  updateCamera(camera, world.spawn, dt)
  drawWorldBackground(ctx, camera, canvas)

  const p = worldToScreen(camera, canvas, input.world)
  ctx.fillStyle = '#201a17'
  ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill()

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
