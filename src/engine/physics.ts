import type { CameraState, InputState, PhysicsBody, Prop, PropKind, Vec2 } from '../types'
import { clunk } from './audio'
// character removed: the cursor grabs/flings props and scatters ducks directly.
import { tuning } from '../config/tuning'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { worldToScreen } from './world'

// fr = friction multiplier: marbles roll far (low), tiles are heavy wood (high)
const PROP_SPECS: Record<PropKind, { radius: number; mass: number; color: string; fr: number }> = {
  letter: { radius: 56, mass: 3.4, color: theme.colors.ink, fr: 5.5 },
  duck:   { radius: 14, mass: 0.8, color: theme.colors.orange, fr: 1 },
  pebble: { radius: 17, mass: 0.7, color: '#b8ab90', fr: 0.3 },
  ball:   { radius: 18, mass: 1.0, color: theme.colors.coral, fr: 0.55 },
  cone:   { radius: 12, mass: 0.9, color: theme.colors.orange, fr: 1 },
  leaf:   { radius: 8,  mass: 0.15, color: theme.colors.lime, fr: 1 },
  cup:    { radius: 9,  mass: 0.4, color: theme.colors.sky, fr: 1 },
}

// glass marble palette, cycled by prop id
const MARBLE_COLORS = [
  theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple,
  theme.colors.orange, theme.colors.teal, '#f7c948',
]

let nextId = 1

function makeProp(kind: PropKind, pos: Vec2, home?: Vec2, char?: string): Prop {
  const spec = PROP_SPECS[kind]
  return {
    id: nextId++, kind, char, home,
    pos: { ...pos }, vel: { x: 0, y: 0 },
    radius: spec.radius, mass: spec.mass,
    rotation: 0, angVel: 0, tex: { x: 0, y: 0 },
    grabbed: false, sleeping: false, restTime: 99,
  }
}

// keep scattered props out of the hero-title area (the ABC blocks live there)
function inTitleZone(x: number, y: number): boolean {
  const ty = world.spawn.y - 560
  return Math.abs(x - world.spawn.x) < 950 && y > ty - 220 && y < ty + 380
}

export function createProps(): Prop[] {
  const props: Prop[] = []
  // (the hero title blocks are their own game — see engine/games/blocks.ts)
  for (const spawn of world.props) {
    for (let i = 0; i < spawn.count; i++) {
      let pos = { x: spawn.x, y: spawn.y }
      for (let tries = 0; tries < 20; tries++) {
        pos = {
          x: spawn.x + (Math.random() * 2 - 1) * spawn.spread,
          y: spawn.y + (Math.random() * 2 - 1) * spawn.spread,
        }
        if (!inTitleZone(pos.x, pos.y)) break
      }
      props.push(makeProp(spawn.kind, pos))
    }
  }
  return props
}

// ---- impact feedback: comic sparks + a clunk on solid hits ----
interface Impact { x: number; y: number; age: number; max: number; size: number; seed: number }
const impacts: Impact[] = []

// ---- obstacles: solid shapes registered by game modules (e.g. the ABC blocks)
// that props bounce off. Games call registerObstacleProvider once; the provider
// runs each frame so positions stay live.
export interface Obstacle {
  x: number
  y: number
  /** half-size of the (axis-aligned) solid square */
  half: number
  /** called when a prop smacks it — lets the owner nudge/react */
  onHit?: (ix: number, iy: number) => void
}
const obstacleProviders: Array<() => Obstacle[]> = []
export function registerObstacleProvider(fn: () => Obstacle[]): void {
  obstacleProviders.push(fn)
}

/** Impact feedback (comic spark + clunk) — shared with game modules. */
export function spark(x: number, y: number, strength: number): void {
  impacts.push({ x, y, age: 0, max: 0.28, size: 8 + strength * 16, seed: Math.random() * Math.PI * 2 })
  if (impacts.length > 40) impacts.shift()
  clunk(strength)
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
  // solid knock → spark + clunk at the contact point
  if (-velAlong > 130) {
    spark(a.pos.x + nx * a.radius, a.pos.y + ny * a.radius, Math.min(1, -velAlong / 900))
  }
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
    // integrate (per-kind friction: marbles roll, tiles stop like wood on wood)
    const f = Math.exp(-tuning.propFriction * PROP_SPECS[p.kind].fr * dt)
    p.vel.x *= f
    p.vel.y *= f
    p.angVel *= f
    // marbles ROLL: the texture offset tracks the actual movement vector, so the
    // pattern streams whichever way it's rolled or pulled — no reorientation
    if (p.kind === 'pebble') {
      p.tex.x += p.vel.x * dt * 0.5
      p.tex.y += p.vel.y * dt * 0.5
    }
    // integrate + bounce off the table rim (with a clunk when it's a real knock)
    p.pos.x += p.vel.x * dt
    p.pos.y += p.vel.y * dt
    if (p.pos.x < p.radius || p.pos.x > world.width - p.radius) {
      if (Math.abs(p.vel.x) > 130) spark(p.pos.x < p.radius ? 0 : world.width, p.pos.y, Math.min(1, Math.abs(p.vel.x) / 900))
      p.pos.x = Math.min(Math.max(p.pos.x, p.radius), world.width - p.radius)
      p.vel.x *= -tuning.restitution
    }
    if (p.pos.y < p.radius || p.pos.y > world.height - p.radius) {
      if (Math.abs(p.vel.y) > 130) spark(p.pos.x, p.pos.y < p.radius ? 0 : world.height, Math.min(1, Math.abs(p.vel.y) / 900))
      p.pos.y = Math.min(Math.max(p.pos.y, p.radius), world.height - p.radius)
      p.vel.y *= -tuning.restitution
    }
    p.rotation += p.angVel * dt

    // bounce off registered obstacles (blocks etc.) — closest point on the
    // square to the prop centre, push out along the normal, reflect velocity
    for (const provider of obstacleProviders) {
      for (const o of provider()) {
        const cx = Math.min(Math.max(p.pos.x, o.x - o.half), o.x + o.half)
        const cy = Math.min(Math.max(p.pos.y, o.y - o.half), o.y + o.half)
        let dx = p.pos.x - cx
        let dy = p.pos.y - cy
        let d = Math.hypot(dx, dy)
        if (d >= p.radius) continue
        if (d === 0) { dx = p.pos.x - o.x; dy = p.pos.y - o.y; d = Math.hypot(dx, dy) || 1 }
        const nx = dx / d, ny = dy / d
        p.pos.x = cx + nx * p.radius
        p.pos.y = cy + ny * p.radius
        const along = p.vel.x * nx + p.vel.y * ny
        if (along < 0) {
          p.vel.x -= (1 + 0.65) * along * nx
          p.vel.y -= (1 + 0.65) * along * ny
          if (-along > 130) {
            spark(cx, cy, Math.min(1, -along / 900))
            o.onHit?.(-nx * -along, -ny * -along)
          }
        }
      }
    }

    const speed = Math.hypot(p.vel.x, p.vel.y)
    p.restTime = speed < 8 ? p.restTime + dt : 0
  }

  // prop-prop collisions (skip sleeping pairs)
  for (let i = 0; i < props.length; i++) {
    const a = props[i]
    if (a.sleeping) continue
    for (let j = i + 1; j < props.length; j++) {
      const b = props[j]
      if (b.sleeping) continue
      // held marbles still collide — swing one through the pile and it scatters
      collide(a, b)
    }
  }

  // age out impact sparks
  for (let i = impacts.length - 1; i >= 0; i--) {
    impacts[i].age += dt
    if (impacts[i].age >= impacts[i].max) impacts.splice(i, 1)
  }
}

/** Comic impact sparks — short ink ticks + a white flash, fading fast. */
export function drawImpacts(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  for (const im of impacts) {
    const s = worldToScreen(cam, canvas, { x: im.x, y: im.y })
    if (s.x < -60 || s.y < -60 || s.x > canvas.width + 60 || s.y > canvas.height + 60) continue
    const t = im.age / im.max          // 0 → 1
    const grow = 0.5 + t * 0.9
    const alpha = 1 - t
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.scale(cam.zoom, cam.zoom)
    ctx.globalAlpha = alpha
    // white flash core
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(0, 0, im.size * 0.28 * (1 - t), 0, Math.PI * 2); ctx.fill()
    // radiating ink ticks
    ctx.strokeStyle = theme.colors.ink
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    for (let k = 0; k < 5; k++) {
      const a = im.seed + (k / 5) * Math.PI * 2
      const r0 = im.size * 0.45 * grow
      const r1 = im.size * (0.75 + (k % 2) * 0.25) * grow
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.globalAlpha = 1
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
    if (p.kind === 'duck') {
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
    } else if (p.kind === 'pebble') {
      // glass marble: a tiled pattern inside the glass SCROLLS in the direction
      // it was rolled (p.tex accumulates travel), selling the rolling motion.
      const col = MARBLE_COLORS[(p.id - 1) % MARBLE_COLORS.length]
      const r = spec.radius
      // shadow
      ctx.fillStyle = 'rgba(32,26,23,0.22)'
      ctx.beginPath(); ctx.ellipse(2, 4, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill()
      // body
      ctx.fillStyle = col
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.4
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      // rolling texture: a 2D pattern that scrolls with the movement vector,
      // rendered through a FISHEYE lens — magnified at the centre, compressed
      // toward the rim — so the glass visibly bends it as it streams past.
      ctx.save()
      ctx.beginPath(); ctx.arc(0, 0, r - 1.5, 0, Math.PI * 2); ctx.clip()
      // Rich glass innards — swirl ribbons, cat's-eye blades, galaxy flecks,
      // candy stripes — built from dense per-cell clusters. The cluster layout
      // repeats on a 2×2 super-tile in pattern space, so the texture is
      // seamlessly TILEABLE: it scrolls forever with no seams or pops.
      const style = (p.id - 1) % 4
      const s = r * 2.4
      const ox = ((p.tex.x % s) + s) % s
      const oy = ((p.tex.y % s) + s) % s
      const nx = Math.floor(p.tex.x / s)
      const ny = Math.floor(p.tex.y / s)
      const W = 'rgba(255,255,255,0.65)'
      const D = 'rgba(32,26,23,0.24)'
      const accent = MARBLE_COLORS[(p.id + 2) % MARBLE_COLORS.length]
      // fisheye warp for any pattern-space point
      const warpPt = (px: number, py: number): { x: number; y: number; sc: number } => {
        const d = Math.hypot(px, py)
        const w = 1 / (1 + 0.18 * (d / r) * (d / r)) // subtle lens, not a peephole
        return { x: px * w, y: py * w, sc: w }
      }
      for (let gx = -2; gx <= 2; gx++) {
        for (let gy = -2; gy <= 2; gy++) {
          const cellX = gx * s + ox - s
          const cellY = gy * s + oy - s
          if (Math.hypot(cellX, cellY) > r * 2.6) continue
          // stable pattern-space identity → same cluster every wrap (tileable)
          const kx = (((gx - nx) % 2) + 2) % 2
          const ky = (((gy - ny) % 2) + 2) % 2
          let seed = (p.id * 7919 + kx * 131 + ky * 137 + style * 17) | 0
          const rnd = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff
            return seed / 0x7fffffff
          }
          if (style === 0) {
            // swirl ribbons: curvy strokes + trailing droplets
            for (let k = 0; k < 3; k++) {
              const a0 = rnd() * Math.PI * 2
              const p0 = warpPt(cellX + (rnd() - 0.5) * s * 0.8, cellY + (rnd() - 0.5) * s * 0.8)
              const p1 = warpPt(cellX + Math.cos(a0) * s * 0.5, cellY + Math.sin(a0) * s * 0.5)
              const pc = warpPt(cellX + Math.cos(a0 + 1.4) * s * 0.55, cellY + Math.sin(a0 + 1.4) * s * 0.55)
              ctx.strokeStyle = k === 0 ? accent : k === 1 ? W : D
              ctx.lineWidth = r * (0.14 + rnd() * 0.08) * p0.sc
              ctx.lineCap = 'round'
              ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(pc.x, pc.y, p1.x, p1.y); ctx.stroke()
            }
            for (let k = 0; k < 3; k++) {
              const q = warpPt(cellX + (rnd() - 0.5) * s, cellY + (rnd() - 0.5) * s)
              ctx.fillStyle = k % 2 ? W : accent
              ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.07 * q.sc, 0, Math.PI * 2); ctx.fill()
            }
          } else if (style === 1) {
            // cat's eye: twisted blades radiating from the cell heart
            const heart = { x: cellX + (rnd() - 0.5) * s * 0.3, y: cellY + (rnd() - 0.5) * s * 0.3 }
            const base = rnd() * Math.PI
            for (let k = 0; k < 4; k++) {
              const a = base + (k / 4) * Math.PI * 2
              const tip = warpPt(heart.x + Math.cos(a) * s * 0.52, heart.y + Math.sin(a) * s * 0.52)
              const mid = warpPt(heart.x + Math.cos(a + 0.5) * s * 0.28, heart.y + Math.sin(a + 0.5) * s * 0.28)
              const h = warpPt(heart.x, heart.y)
              ctx.strokeStyle = k % 2 ? accent : W
              ctx.lineWidth = r * (0.2 - k * 0.03) * h.sc
              ctx.lineCap = 'round'
              ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y); ctx.stroke()
            }
            const h = warpPt(heart.x, heart.y)
            ctx.fillStyle = D
            ctx.beginPath(); ctx.arc(h.x, h.y, r * 0.1 * h.sc, 0, Math.PI * 2); ctx.fill()
          } else if (style === 2) {
            // galaxy: a nebula blob + a spray of flecks
            const nb = warpPt(cellX + (rnd() - 0.5) * s * 0.5, cellY + (rnd() - 0.5) * s * 0.5)
            ctx.fillStyle = 'rgba(255,255,255,0.18)'
            ctx.beginPath(); ctx.arc(nb.x, nb.y, r * 0.42 * nb.sc, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = accent
            ctx.beginPath(); ctx.arc(nb.x, nb.y, r * 0.16 * nb.sc, 0, Math.PI * 2); ctx.fill()
            for (let k = 0; k < 9; k++) {
              const q = warpPt(cellX + (rnd() - 0.5) * s, cellY + (rnd() - 0.5) * s)
              ctx.fillStyle = k % 3 === 0 ? W : k % 3 === 1 ? 'rgba(255,255,255,0.4)' : D
              ctx.beginPath(); ctx.arc(q.x, q.y, r * (0.03 + rnd() * 0.06) * q.sc, 0, Math.PI * 2); ctx.fill()
            }
          } else {
            // candy stripes: a band of wavy parallel strokes
            const ang = rnd() * Math.PI
            const ca = Math.cos(ang), sa = Math.sin(ang)
            for (let k = -1; k <= 1; k++) {
              const off = k * s * 0.24
              const pts: { x: number; y: number; sc: number }[] = []
              for (let tstep = -1; tstep <= 1; tstep += 0.5) {
                const along = tstep * s * 0.6
                const wave = Math.sin(tstep * 5 + k) * s * 0.08
                pts.push(warpPt(
                  cellX + ca * along - sa * (off + wave),
                  cellY + sa * along + ca * (off + wave),
                ))
              }
              ctx.strokeStyle = k === 0 ? accent : k === -1 ? W : D
              ctx.lineWidth = r * (k === 0 ? 0.16 : 0.1) * pts[2].sc
              ctx.lineCap = 'round'
              ctx.beginPath()
              pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
              ctx.stroke()
            }
          }
        }
      }
      // curvature shading so it still reads as a sphere
      ctx.fillStyle = 'rgba(32,26,23,0.14)'
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.arc(-r * 0.18, -r * 0.22, r * 0.92, 0, Math.PI * 2, true); ctx.fill()
      ctx.restore()
      // fixed glint on top
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.24, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill()
    } else {
      // circle-ish props: ball, leaf, cup
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
