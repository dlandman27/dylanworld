import type { CameraState, InputState } from '../types'
import { screenToWorld } from './world'

export function createInput(canvas: HTMLCanvasElement): InputState {
  const input: InputState = {
    screen: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    world: { x: 0, y: 0 },
    down: false,
    grabbed: null,
  }

  canvas.addEventListener('pointermove', (e) => {
    input.screen.x = e.clientX
    input.screen.y = e.clientY
  })
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    input.screen.x = e.clientX
    input.screen.y = e.clientY
    input.down = true
  })
  canvas.addEventListener('pointerup', () => { input.down = false })
  canvas.addEventListener('pointercancel', () => { input.down = false })

  return input
}

export function updateInputWorld(input: InputState, cam: CameraState, canvas: HTMLCanvasElement): void {
  input.world = screenToWorld(cam, canvas, input.screen)
}
