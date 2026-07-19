import type { CameraState, InputState, PhysicsBody, Prop, PropKind, Vec2 } from '../types'
import { tuning } from '../config/tuning'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { worldToScreen } from './world'

const PROP_SPECS: Record<PropKind, { radius: number; mass: number; color: string }> = {
  letter: { radius: 34, mass: 2.0, color: theme.colors.ink },
  duck:   { radius: 14, mass: 0.8, color: theme.colors.orange },
  pebble: { radius: 7,  mass: 0.5, color: '#b8ab90' },
  ball:   { radius: 18, mass: 1.0, color: theme.colors.coral },
  cone:   { radius: 12, mass: 0.9, color: theme.colors.orange },
  leaf:   { radius: 8,  mass: 0.15, color: theme.colors.lime },
  cup:    { radius: 9,  mass: 0.4, color: theme.colors.sky },
}

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
  // name letters in an arc-free simple row centered on spawn, 2 rows if long
  const chars = world.name.split('')
  const letterGap = 76
  const rowY = world.spawn.y - 130
  const totalW = (chars.length - 1) * letterGap
  chars.forEach((c, i) => {
    if (c === ' ') return
    const pos = { x: world.spawn.x - totalW / 2 + i * letterGap, y: rowY }
    props.push(makeProp('letter', pos, { ...pos }, c))
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

export function updatePhysics(props: Prop[], character: PhysicsBody, input: InputState, cam: CameraState, dt: number): void {
  // grab / fling
  if (input.down && !input.grabbed) {
    for (const p of props) {
      if (Math.hypot(p.pos.x - input.world.x, p.pos.y - input.world.y) < p.radius + 14) {
        input.grabbed = p
        p.grabbed = true
        break
      }
    }
  }
  if (!input.down && input.grabbed) {
    input.grabbed.grabbed = false
    input.grabbed = null
  }
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

    // duck flee
    if (p.kind === 'duck') {
      const dx = p.pos.x - character.pos.x
      const dy = p.pos.y - character.pos.y
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

    // character plow
    if (!p.grabbed) {
      const beforeVx = p.vel.x
      collide(character, p)
      // scale scatter with character speed
      if (p.vel.x !== beforeVx) {
        p.vel.x *= tuning.plowForce
        p.vel.y *= tuning.plowForce
        p.angVel += (Math.random() - 0.5) * 8
      }
    }
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
    if (s.x < -80 || s.y < -80 || s.x > canvas.width + 80 || s.y > canvas.height + 80) continue
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(p.rotation)
    const spec = PROP_SPECS[p.kind]
    if (p.kind === 'letter' && p.char) {
      // rsotw ".pop" treatment: hard ink drop-shadow, orange fill, ink outline
      ctx.font = `700 64px ${theme.fonts.display}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = theme.colors.ink
      ctx.fillText(p.char, 3, 3) // hard offset shadow (matches text-shadow: 3px 3px 0 ink)
      ctx.fillStyle = theme.colors.orange
      ctx.fillText(p.char, 0, 0)
      ctx.lineWidth = 3 // ~1.5px CSS stroke, scaled for 64px glyphs
      ctx.lineJoin = 'round'
      ctx.strokeStyle = theme.colors.ink
      ctx.strokeText(p.char, 0, 0)
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
