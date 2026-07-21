import { theme } from '../../config/theme'
import { world } from '../../config/world'
import { spark, registerObstacleProvider, allObstacles } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// Toy race circuit + die-cast cars. CLICK a car to hop in — drive with WASD /
// arrow keys (up throttle, down brake/reverse, left/right steer), Esc or click
// again to hop out. The whole table is road: plow marbles, clip blocks, leave
// skid marks. The camera follows whichever car you're driving (driveTarget).

const TRACK_CX = 700
const TRACK_CY = 420
const TRACK_A = 500      // circuit x half-extent
const TRACK_B = 270      // circuit y half-extent
const TRACK_W = 92       // asphalt width — wide enough to actually race on
const N_PTS = 240

const CAR_LEN = 54
const CAR_W = 30
const MAX_SPEED = 560
const BOOST_SPEED = 940  // hold Shift: nitro
const BOOST_ACCEL = 1700
const MAX_REVERSE = -180
const ACCEL = 750
const BRAKE = 1600
const COAST = 1.1        // drag while coasting
const TURN_RATE = 5.2    // rad/s at full grip — tight, toy-car handling

interface Car {
  color: string
  accent: string
  flames: boolean
  x: number
  y: number
  heading: number
  v: number
  squash: number
}

interface Skid { x: number; y: number; rot: number; age: number }

// ---- track geometry: a rounded club-circuit oval with a gentle chicane ----
const trackPts: { x: number; y: number }[] = []
for (let i = 0; i < N_PTS; i++) {
  const t = (i / N_PTS) * Math.PI * 2
  trackPts.push({
    x: TRACK_CX + TRACK_A * Math.cos(t),
    y: TRACK_CY + TRACK_B * Math.sin(t) + Math.sin(t * 3) * 40, // the chicane wiggle
  })
}
const trackPoint = (i: number): { x: number; y: number } => trackPts[((i % N_PTS) + N_PTS) % N_PTS]

// ---- keyboard state (armed only while driving) ----
const keys = { up: false, down: false, left: false, right: false, boost: false }
let controlling = -1 // index into cars, -1 = nobody driving

const KEYMAP: Record<string, keyof typeof keys> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
}

// module-level so main.ts can make the camera chase the driven car
let driveTargetPos: { x: number; y: number } | null = null
export function driveTarget(): { x: number; y: number } | null {
  return driveTargetPos
}

export function createHotwheels(): TableGame {
  const cars: Car[] = [
    { color: theme.colors.coral, accent: '#f7c948', flames: true, ...spawnAt(0.03), squash: 0 },
    { color: theme.colors.sky, accent: '#fbfaf4', flames: false, ...spawnAt(0.28), squash: 0 },
    { color: '#f7c948', accent: '#e04434', flames: true, ...spawnAt(0.53), squash: 0 },
    { color: theme.colors.lime, accent: '#fbfaf4', flames: false, ...spawnAt(0.78), squash: 0 },
  ]
  const skids: Skid[] = []
  const SELF = Symbol('hotwheels')

  function spawnAt(frac: number): { x: number; y: number; heading: number; v: number } {
    const i = Math.floor(frac * N_PTS)
    const p = trackPoint(i)
    const q = trackPoint(i + 2)
    return { x: p.x, y: p.y, heading: Math.atan2(q.y - p.y, q.x - p.x), v: 0 }
  }

  window.addEventListener('keydown', (e) => {
    if (controlling === -1) return
    if (e.code === 'Escape') { controlling = -1; return }
    const k = KEYMAP[e.code]
    if (k) { keys[k] = true; e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code]
    if (k) keys[k] = false
  })

  // marbles/coins/ball carom off the cars, launched by the car's own velocity
  registerObstacleProvider(() =>
    cars.map((c, i) => ({
      x: c.x, y: c.y, half: CAR_LEN * 0.42, owner: SELF,
      vx: Math.cos(c.heading) * c.v,
      vy: Math.sin(c.heading) * c.v,
      onHit: (ix: number, iy: number) => {
        if (i !== controlling) { c.x += ix * 0.004; c.y += iy * 0.004 }
      },
    })),
  )

  const bumpObstacles = (c: Car): void => {
    for (const o of allObstacles()) {
      if (o.owner === SELF) continue
      const cx = Math.min(Math.max(c.x, o.x - o.half), o.x + o.half)
      const cy = Math.min(Math.max(c.y, o.y - o.half), o.y + o.half)
      let dx = c.x - cx, dy = c.y - cy
      let d = Math.hypot(dx, dy)
      const rr = CAR_LEN * 0.45
      if (d >= rr) continue
      if (d === 0) { dx = c.x - o.x; dy = c.y - o.y; d = Math.hypot(dx, dy) || 1 }
      const nx = dx / d, ny = dy / d
      c.x = cx + nx * rr
      c.y = cy + ny * rr
      const impact = Math.abs(c.v)
      if (impact > 120) {
        // the car is heavy die-cast — hits send things FLYING
        o.onHit?.(-nx * impact * 3.5, -ny * impact * 3.5)
        spark(cx, cy, Math.min(1, impact / 700))
        c.squash = 1
      }
      // barely slows the car down — it plows through
      c.v *= impact > 400 ? 0.82 : -0.2
    }
  }

  return {
    id: 'hotwheels',
    onDown(x, y) {
      for (let i = 0; i < cars.length; i++) {
        if (Math.hypot(x - cars[i].x, y - cars[i].y) < CAR_LEN) {
          controlling = controlling === i ? -1 : i // hop in / out / switch cars
          keys.up = keys.down = keys.left = keys.right = false
          return true
        }
      }
      return false
    },
    onMove() { /* keyboard-driven */ },
    onUp() { /* nothing */ },
    update(dt) {
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i]
        const driven = i === controlling

        if (driven) {
          // throttle / brake / reverse — Shift is the nitro button
          const boosting = keys.boost && keys.up
          const cap = boosting ? BOOST_SPEED : MAX_SPEED
          const accel = boosting ? BOOST_ACCEL : ACCEL
          if (keys.up) {
            c.v = c.v > cap
              ? Math.max(cap, c.v * Math.exp(-1.5 * dt)) // ease down off-boost
              : Math.min(cap, c.v + accel * dt)
          } else if (keys.down) c.v = Math.max(MAX_REVERSE, c.v - BRAKE * dt)
          else c.v *= Math.exp(-COAST * dt)
          // steering scales with speed (no pivoting in place)
          const speedFactor = Math.min(1, Math.abs(c.v) / 260)
          const dir = c.v >= 0 ? 1 : -1
          if (keys.left) c.heading -= TURN_RATE * speedFactor * dir * dt
          if (keys.right) c.heading += TURN_RATE * speedFactor * dir * dt
          // skid marks when cornering hard at speed
          if ((keys.left || keys.right) && Math.abs(c.v) > 330) {
            const back = c.heading + Math.PI
            for (const side of [-1, 1]) {
              skids.push({
                x: c.x + Math.cos(back) * CAR_LEN * 0.32 + Math.cos(c.heading + Math.PI / 2) * side * CAR_W * 0.32,
                y: c.y + Math.sin(back) * CAR_LEN * 0.32 + Math.sin(c.heading + Math.PI / 2) * side * CAR_W * 0.32,
                rot: c.heading, age: 0,
              })
            }
            if (skids.length > 400) skids.splice(0, skids.length - 400)
          }
        } else {
          c.v *= Math.exp(-2.5 * dt) // parked cars roll to a stop
        }

        c.x += Math.cos(c.heading) * c.v * dt
        c.y += Math.sin(c.heading) * c.v * dt
        c.squash = Math.max(0, c.squash - dt * 6)

        // stay on the table — thud into the rim
        const M = CAR_LEN * 0.5
        if (c.x < M || c.x > world.width - M || c.y < M || c.y > world.height - M) {
          if (Math.abs(c.v) > 250) { spark(c.x, c.y, Math.min(1, Math.abs(c.v) / 1200)); c.squash = 1 }
          c.x = Math.min(Math.max(c.x, M), world.width - M)
          c.y = Math.min(Math.max(c.y, M), world.height - M)
          c.v *= -0.3
        }
        bumpObstacles(c)
      }
      // fade skid marks
      for (let i = skids.length - 1; i >= 0; i--) {
        skids[i].age += dt
        if (skids[i].age > 6) skids.splice(i, 1)
      }
      const dc = controlling >= 0 ? cars[controlling] : null
      driveTargetPos = dc ? { x: dc.x, y: dc.y } : null
    },
    draw(g: Ctx, t) {
      drawTrack(g)
      // skid marks under the cars
      for (const s of skids) {
        g.save()
        g.translate(s.x, s.y)
        g.rotate(s.rot)
        g.globalAlpha = Math.max(0, 0.35 - s.age * 0.058)
        g.fillStyle = '#2a241f'
        g.fillRect(-4, -2, 8, 4)
        g.restore()
      }
      g.globalAlpha = 1
      for (let i = 0; i < cars.length; i++) drawCar(g, cars[i], i === controlling, t)
    },
  }

  function drawTrack(g: Ctx): void {
    const path = (): void => {
      g.beginPath()
      trackPts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
      g.closePath()
    }
    g.save()
    g.lineJoin = 'round'
    g.lineCap = 'round'
    // shadow + ink edge + asphalt
    g.strokeStyle = 'rgba(32,26,23,0.16)'
    g.lineWidth = TRACK_W + 10
    g.save(); g.translate(4, 7); path(); g.stroke(); g.restore()
    g.strokeStyle = INK
    g.lineWidth = TRACK_W + 6
    path(); g.stroke()
    g.strokeStyle = '#4d4f52' // asphalt
    g.lineWidth = TRACK_W
    path(); g.stroke()
    // red/white kerbs through the corners (left and right ends of the oval)
    for (let i = 0; i < N_PTS; i++) {
      const t = (i / N_PTS) * Math.PI * 2
      const inCorner = Math.abs(Math.cos(t)) > 0.75 // the two 180° turns
      if (!inCorner || i % 4 >= 2) continue
      const p = trackPoint(i)
      const q = trackPoint(i + 1)
      const ang = Math.atan2(q.y - p.y, q.x - p.x)
      for (const side of [-1, 1]) {
        g.save()
        g.translate(
          p.x + Math.cos(ang + Math.PI / 2) * side * (TRACK_W / 2 + 3),
          p.y + Math.sin(ang + Math.PI / 2) * side * (TRACK_W / 2 + 3),
        )
        g.rotate(ang)
        g.fillStyle = i % 8 < 4 ? '#e04434' : '#fbfaf4'
        g.fillRect(-7, -3, 14, 6)
        g.restore()
      }
    }
    // white edge lines
    g.strokeStyle = 'rgba(255,255,255,0.85)'
    g.lineWidth = 2.5
    g.save(); path(); g.stroke(); g.restore()
    // (inner edge line via slightly narrower stroke of transparent trick is
    // overkill — the single boundary line + kerbs read as a toy circuit)
    // checkered start/finish line at t=0 (right side of the oval)
    const s0 = trackPoint(0)
    const s1 = trackPoint(2)
    const sAng = Math.atan2(s1.y - s0.y, s1.x - s0.x)
    g.save()
    g.translate(s0.x, s0.y)
    g.rotate(sAng)
    const sq = 6
    for (let r = 0; r < 2; r++) {
      for (let k = -Math.floor(TRACK_W / 2 / sq); k < Math.floor(TRACK_W / 2 / sq); k++) {
        g.fillStyle = (r + k) % 2 === 0 ? '#fbfaf4' : INK
        g.fillRect(r * sq - sq, k * sq, sq, sq)
      }
    }
    g.restore()
    g.restore()
  }

  function drawCar(g: Ctx, c: Car, driven: boolean, t: number): void {
    g.save()
    g.translate(c.x, c.y)
    // "click to drive" ring on the active car
    if (driven) {
      g.strokeStyle = 'rgba(247, 201, 72, 0.85)'
      g.lineWidth = 3.5
      g.setLineDash([8, 7])
      g.beginPath()
      g.arc(0, 0, CAR_LEN * 0.85, t / 400, t / 400 + Math.PI * 2)
      g.stroke()
      g.setLineDash([])
    }
    g.rotate(c.heading)
    g.scale(1 + c.squash * 0.1, 1 - c.squash * 0.14)
    // shadow
    g.fillStyle = 'rgba(32,26,23,0.24)'
    g.beginPath(); g.ellipse(2, 4, CAR_LEN * 0.52, CAR_W * 0.55, 0, 0, Math.PI * 2); g.fill()
    // nitro flame out the back while boosting
    if (driven && keys.boost && keys.up && Math.abs(c.v) > 60) {
      const flick = 1 + Math.sin(t / 28) * 0.35 + Math.sin(t / 9) * 0.15
      const fx = -CAR_LEN * 0.52
      g.lineJoin = 'round'
      g.fillStyle = '#f7a94f'
      g.beginPath()
      g.moveTo(fx, -CAR_W * 0.22)
      g.lineTo(fx - 26 * flick, 0)
      g.lineTo(fx, CAR_W * 0.22)
      g.closePath()
      g.fill()
      g.strokeStyle = INK
      g.lineWidth = 2
      g.stroke()
      g.fillStyle = '#ffe08a'
      g.beginPath()
      g.moveTo(fx, -CAR_W * 0.1)
      g.lineTo(fx - 13 * flick, 0)
      g.lineTo(fx, CAR_W * 0.1)
      g.closePath()
      g.fill()
    }
    // wheels
    g.fillStyle = '#26211c'
    for (const [wx, wy] of [[-CAR_LEN * 0.28, -CAR_W * 0.52], [-CAR_LEN * 0.28, CAR_W * 0.52], [CAR_LEN * 0.3, -CAR_W * 0.52], [CAR_LEN * 0.3, CAR_W * 0.52]]) {
      g.beginPath()
      if (typeof g.roundRect === 'function') g.roundRect(wx - 7, wy - 4, 14, 8, 3)
      else g.rect(wx - 7, wy - 4, 14, 8)
      g.fill()
    }
    // body: die-cast capsule with a nose taper
    const grad = g.createLinearGradient(0, -CAR_W / 2, 0, CAR_W / 2)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.18, c.color)
    grad.addColorStop(1, c.color)
    g.fillStyle = grad
    g.strokeStyle = INK
    g.lineWidth = 2.6
    g.beginPath()
    g.moveTo(CAR_LEN / 2, 0)
    g.quadraticCurveTo(CAR_LEN / 2, -CAR_W / 2, CAR_LEN * 0.16, -CAR_W / 2)
    g.lineTo(-CAR_LEN * 0.42, -CAR_W / 2)
    g.quadraticCurveTo(-CAR_LEN / 2, -CAR_W / 2, -CAR_LEN / 2, 0)
    g.quadraticCurveTo(-CAR_LEN / 2, CAR_W / 2, -CAR_LEN * 0.42, CAR_W / 2)
    g.lineTo(CAR_LEN * 0.16, CAR_W / 2)
    g.quadraticCurveTo(CAR_LEN / 2, CAR_W / 2, CAR_LEN / 2, 0)
    g.closePath()
    g.fill(); g.stroke()
    // flame decal on the hot one
    if (c.flames) {
      g.fillStyle = c.accent
      g.beginPath()
      g.moveTo(CAR_LEN * 0.42, 0)
      g.lineTo(CAR_LEN * 0.1, -CAR_W * 0.22)
      g.lineTo(CAR_LEN * 0.2, 0)
      g.lineTo(CAR_LEN * 0.1, CAR_W * 0.22)
      g.closePath()
      g.fill()
    }
    // cockpit glass
    g.fillStyle = '#3d444b'
    g.beginPath()
    if (typeof g.roundRect === 'function') g.roundRect(-CAR_LEN * 0.22, -CAR_W * 0.3, CAR_LEN * 0.32, CAR_W * 0.6, 5)
    else g.rect(-CAR_LEN * 0.22, -CAR_W * 0.3, CAR_LEN * 0.32, CAR_W * 0.6)
    g.fill()
    g.lineWidth = 1.8
    g.stroke()
    // spoiler
    g.fillStyle = c.color
    g.fillRect(-CAR_LEN * 0.52, -CAR_W * 0.42, 6, CAR_W * 0.84)
    g.strokeRect(-CAR_LEN * 0.52, -CAR_W * 0.42, 6, CAR_W * 0.84)
    // windshield glint
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath(); g.ellipse(-CAR_LEN * 0.1, -CAR_W * 0.12, 6, 2.5, -0.4, 0, Math.PI * 2); g.fill()
    g.restore()
  }
}
