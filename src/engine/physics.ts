import type { CameraState, InputState, PhysicsBody, Prop, PropKind, Vec2 } from '../types'
// character removed: the cursor grabs/flings props and scatters ducks directly.
import { tuning } from '../config/tuning'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { worldToScreen } from './world'

const PROP_SPECS: Record<PropKind, { radius: number; mass: number; color: string }> = {
  letter: { radius: 40, mass: 2.6, color: theme.colors.ink },
  duck:   { radius: 14, mass: 0.8, color: theme.colors.orange },
  pebble: { radius: 7,  mass: 0.5, color: '#b8ab90' },
  ball:   { radius: 18, mass: 1.0, color: theme.colors.coral },
  cone:   { radius: 12, mass: 0.9, color: theme.colors.orange },
  leaf:   { radius: 8,  mass: 0.15, color: theme.colors.lime },
  cup:    { radius: 9,  mass: 0.4, color: theme.colors.sky },
}

// nicecursor-style title palette: each name letter cycles through these (rainbow sticker letters)
const LETTER_PALETTE = [
  theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple,
  theme.colors.orange, theme.colors.pink, theme.colors.teal, '#f7c948',
]

let nextId = 1

function makeProp(kind: PropKind, pos: Vec2, home?: Vec2, char?: string): Prop {
  const spec = PROP_SPECS[kind]
  return {
    id: nextId++, kind, char, home,
    pos: { ...pos }, vel: { x: 0, y: 0 },
    radius: spec.radius, mass: spec.mass,
    rotation: 0, angVel: 0,
    grabbed: false, sleeping: false, restTime: 99,
  }
}

export function createProps(): Prop[] {
  const props: Prop[] = []
  // hero title: each word on its own centered row, stacked above spawn
  // ("DYLAN'S" over "WORLD"), letters set tight together
  const words = world.name.split(' ')
  const letterGap = 84
  const rowH = 104
  const firstRowY = world.spawn.y - 150
  words.forEach((word, wi) => {
    const chars = word.split('')
    const rowY = firstRowY + wi * rowH
    const totalW = (chars.length - 1) * letterGap
    chars.forEach((c, i) => {
      const pos = { x: world.spawn.x - totalW / 2 + i * letterGap, y: rowY }
      props.push(makeProp('letter', pos, { ...pos }, c))
    })
  })
  for (const spawn of world.props) {
    for (let i = 0; i < spawn.count; i++) {
      const pos = {
        x: spawn.x + (Math.random() * 2 - 1) * spawn.spread,
        y: spawn.y + (Math.random() * 2 - 1) * spawn.spread,
      }
      props.push(makeProp(spawn.kind, pos))
    }
  }
  return props
}

function collide(a: PhysicsBody, b: PhysicsBody): void {
  const dx = b.pos.x - a.pos.x
  const dy = b.pos.y - a.pos.y
  const d = Math.hypot(dx, dy)
  const minD = a.radius + b.radius
  if (d === 0 || d >= minD) return
  const nx = dx / d
  const ny = dy / d
  const overlap = minD - d
  const total = a.mass + b.mass
  a.pos.x -= nx * overlap * (b.mass / total)
  a.pos.y -= ny * overlap * (b.mass / total)
  b.pos.x += nx * overlap * (a.mass / total)
  b.pos.y += ny * overlap * (a.mass / total)
  const rvx = b.vel.x - a.vel.x
  const rvy = b.vel.y - a.vel.y
  const velAlong = rvx * nx + rvy * ny
  if (velAlong > 0) return
  const j = -(1 + tuning.restitution) * velAlong / (1 / a.mass + 1 / b.mass)
  a.vel.x -= (j * nx) / a.mass
  a.vel.y -= (j * ny) / a.mass
  b.vel.x += (j * nx) / b.mass
  b.vel.y += (j * ny) / b.mass
}

export function updatePhysics(props: Prop[], input: InputState, cam: CameraState, dt: number): void {
  // fling: the grabbed prop chases the cursor (grab/release is owned by input.ts)
  if (input.grabbed) {
    const g = input.grabbed
    g.vel.x = (input.world.x - g.pos.x) * tuning.flingPower
    g.vel.y = (input.world.y - g.pos.y) * tuning.flingPower
    g.restTime = 0
    g.sleeping = false
  }

  const camDist = tuning.sleepDistance
  for (const p of props) {
    // sleep far-away, undisturbed props
    const far = Math.hypot(p.pos.x - cam.pos.x, p.pos.y - cam.pos.y) > camDist
    p.sleeping = far && p.restTime > 2
    if (p.sleeping) continue

    // duck flee — scatter away from the cursor (your hand on the paper)
    if (p.kind === 'duck' && !p.grabbed) {
      const dx = p.pos.x - input.world.x
      const dy = p.pos.y - input.world.y
      const d = Math.hypot(dx, dy)
      if (d < tuning.duckFleeRadius && d > 0) {
        p.vel.x += (dx / d) * tuning.duckFleeSpeed * dt * 4
        p.vel.y += (dy / d) * tuning.duckFleeSpeed * dt * 4
        p.restTime = 0
      }
    }
    // letter homing after rest
    if (p.home && p.restTime > tuning.letterReturnDelay && !p.grabbed) {
      p.vel.x += (p.home.x - p.pos.x) * tuning.letterReturnSpring * dt
      p.vel.y += (p.home.y - p.pos.y) * tuning.letterReturnSpring * dt
      p.rotation *= 1 - Math.min(1, dt * 2)
    }

    // integrate
    const f = Math.exp(-tuning.propFriction * dt)
    p.vel.x *= f
    p.vel.y *= f
    p.angVel *= f
    p.pos.x = Math.min(Math.max(p.pos.x + p.vel.x * dt, p.radius), world.width - p.radius)
    p.pos.y = Math.min(Math.max(p.pos.y + p.vel.y * dt, p.radius), world.height - p.radius)
    p.rotation += p.angVel * dt
    const speed = Math.hypot(p.vel.x, p.vel.y)
    p.restTime = speed < 8 ? p.restTime + dt : 0
  }

  // prop-prop collisions (skip sleeping pairs)
  for (let i = 0; i < props.length; i++) {
    const a = props[i]
    if (a.sleeping) continue
    for (let j = i + 1; j < props.length; j++) {
      const b = props[j]
      if (b.sleeping || a.grabbed || b.grabbed) continue
      collide(a, b)
    }
  }
}

export function drawProps(ctx: CanvasRenderingContext2D, props: Prop[], cam: CameraState, canvas: HTMLCanvasElement): void {
  for (const p of props) {
    const s = worldToScreen(cam, canvas, p.pos)
    const m = 80 + p.radius * cam.zoom
    if (s.x < -m || s.y < -m || s.x > canvas.width + m || s.y > canvas.height + m) continue
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.rotate(p.rotation)
    const spec = PROP_SPECS[p.kind]
    if (p.kind === 'letter' && p.char) {
      // nicecursor-style title letters: per-letter rainbow color, heavy weight,
      // thick ink outline + hard ink drop-shadow. Letters are created first in
      // createProps (ids 1..N in name order), so id maps to the color cycle.
      const fs = 92
      ctx.font = `900 ${fs}px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.fillStyle = theme.colors.ink
      ctx.fillText(p.char, 4, 4) // hard offset shadow
      ctx.lineWidth = Math.max(6, fs * 0.07) // thick ink outline
      ctx.strokeStyle = theme.colors.ink
      ctx.strokeText(p.char, 0, 0)
      ctx.fillStyle = LETTER_PALETTE[(p.id - 1) % LETTER_PALETTE.length] // colored fill on top
      ctx.fillText(p.char, 0, 0)
    } else if (p.kind === 'duck') {
      // body + head + beak, paper style
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.ellipse(0, 2, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(8, -7, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = theme.colors.coral
      ctx.beginPath(); ctx.moveTo(13, -7); ctx.lineTo(19, -5); ctx.lineTo(13, -3); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = theme.colors.ink
      ctx.beginPath(); ctx.arc(9.5, -8.5, 1.3, 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'cone') {
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.stroke()
    } else {
      // circle-ish props: pebble, ball, leaf, cup
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(0, 0, spec.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      if (p.kind === 'ball') {
        ctx.beginPath(); ctx.arc(0, 0, spec.radius * 0.55, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
  }
}
