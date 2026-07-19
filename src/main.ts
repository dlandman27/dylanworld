import { createCamera, updateCamera, drawWorldBackground } from './engine/world'
import { world } from './config/world'

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
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  updateCamera(camera, world.spawn, dt)
  drawWorldBackground(ctx, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
