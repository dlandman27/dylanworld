import type { CameraState, CharacterState, Direction, InputState } from '../types'
import { tuning } from '../config/tuning'
import { world } from '../config/world'
import { dylanSprites } from '../config/sprites/dylan'
import { drawFrame, getFrame } from './sprites'
import { worldToScreen } from './world'

const DIRS: Direction[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']

export function createCharacter(): CharacterState {
  return {
    body: { pos: { ...world.spawn }, vel: { x: 0, y: 0 }, radius: 20, mass: 3, sleeping: false },
    dir: 'S',
    action: 'idle',
    frameIndex: 0,
    frameTime: 0,
    lastDirX: 0,
  }
}

export function updateCharacter(ch: CharacterState, input: InputState, dt: number): void {
  const b = ch.body
  const dx = input.world.x - b.pos.x
  const dy = input.world.y - b.pos.y
  const dist = Math.hypot(dx, dy)

  // click-to-move: only chase the cursor while the pointer is held down
  const chasing = input.down && dist > tuning.stopRadius

  if (chasing) {
    b.vel.x += (dx / dist) * tuning.chaseAccel * dt
    b.vel.y += (dy / dist) * tuning.chaseAccel * dt
  }
  // friction
  const f = Math.exp(-tuning.bodyFriction * dt)
  b.vel.x *= f
  b.vel.y *= f
  // speed cap
  const speed = Math.hypot(b.vel.x, b.vel.y)
  if (speed > tuning.maxSpeed) {
    b.vel.x = (b.vel.x / speed) * tuning.maxSpeed
    b.vel.y = (b.vel.y / speed) * tuning.maxSpeed
  }
  b.pos.x = Math.min(Math.max(b.pos.x + b.vel.x * dt, b.radius), world.width - b.radius)
  b.pos.y = Math.min(Math.max(b.pos.y + b.vel.y * dt, b.radius), world.height - b.radius)

  // action + skid detection
  const moving = speed > 40
  const dirX = Math.abs(b.vel.x) > 20 ? Math.sign(b.vel.x) : 0
  if (moving && dirX !== 0 && ch.lastDirX !== 0 && dirX !== ch.lastDirX) {
    ch.action = 'skid'
    ch.frameTime = 0
  } else if (ch.action === 'skid' && ch.frameTime < 0.15) {
    // hold skid briefly
  } else {
    ch.action = moving ? 'walk' : 'idle'
  }
  if (dirX !== 0) ch.lastDirX = dirX

  // 8-way direction from velocity angle
  if (moving) {
    const angle = Math.atan2(b.vel.y, b.vel.x) // 0 = east, y down
    const idx = Math.round(angle / (Math.PI / 4))
    ch.dir = DIRS[((idx % 8) + 8) % 8]
  }

  // animation clock — walk speeds up with movement
  const fps = ch.action === 'walk' ? 6 + (speed / tuning.maxSpeed) * 8 : 3
  ch.frameTime += dt
  if (ch.frameTime > 1 / fps) {
    ch.frameTime = 0
    ch.frameIndex++
  }
}

export function drawCharacter(ctx: CanvasRenderingContext2D, ch: CharacterState, cam: CameraState, canvas: HTMLCanvasElement): void {
  const p = worldToScreen(cam, canvas, ch.body.pos)
  // paper shadow
  ctx.fillStyle = 'rgba(32, 26, 23, 0.18)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 4, 18, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  const { frame, flip } = getFrame(dylanSprites, ch.dir, ch.action, ch.frameIndex)
  drawFrame(ctx, dylanSprites, frame, p.x, p.y + 6, tuning.characterScale, flip)
}
