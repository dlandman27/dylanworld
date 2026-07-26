import type { CameraState } from '../types'
import { worldToScreen } from './world'

// A global day↔night toggle. The light switch flips `target`; every frame the
// eased `night` value chases it. At night we lay a dark veil over the whole
// scene, then punch warm/cool light pools back in around the room's glowing
// things (lamps, the CRT, the arcade lounge, the Plinko marquee…), so it reads
// as "the lights are on in a dark room".

let target = 0
let night = 0

export function toggleNight(): void { target = target > 0.5 ? 0 : 1 }
export function getNight(): number { return night }
export function updateDayNight(dt: number): void {
  night += (target - night) * Math.min(1, dt * 3)
  if (Math.abs(night - target) < 0.001) night = target
}

// world-space light sources: [x, y, radius, r, g, b]
const LIGHTS: [number, number, number, number, number, number][] = [
  [2680, 4290, 560, 255, 214, 120],   // desk lamp (warm)
  [2900, 4300, 360, 190, 220, 255],   // laptop screen (cool)
  [6380, 2600, 520, 255, 210, 130],   // bed nightstand lamp (warm)
  [5620, 640, 640, 150, 210, 255],    // the CRT (cool blue)
  [5400, 1120, 560, 232, 120, 214],   // gaming lounge / console (magenta)
  [6250, 3060, 560, 120, 222, 236],   // Plinko marquee (cyan)
  [3400, 340, 380, 210, 216, 226],    // drone dock (soft white)
]

export function drawNight(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  if (night < 0.01) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // dark veil over everything
  ctx.fillStyle = `rgba(16,20,46,${0.66 * night})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // light pools punched back in (additive)
  ctx.globalCompositeOperation = 'lighter'
  LIGHTS.forEach((L, i) => {
    const [wx, wy, r, cr, cg, cb] = L
    const s = worldToScreen(cam, canvas, { x: wx, y: wy })
    const rad = r * cam.zoom
    if (s.x < -rad || s.y < -rad || s.x > canvas.width + rad || s.y > canvas.height + rad) return
    const flick = 0.82 + 0.18 * Math.sin(t / 340 + i * 1.7)
    const a = 0.5 * night * flick
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad)
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`)
    grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.4})`)
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2); ctx.fill()
  })
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}
