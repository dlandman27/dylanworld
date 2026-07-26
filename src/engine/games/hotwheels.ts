import { theme } from '../../config/theme'
import { world } from '../../config/world'
import { spark, registerObstacleProvider, allObstacles } from '../physics'
import { showVehicleHelp, hideVehicleHelp } from '../../ui/vehicleHelp'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// Toy race circuit + die-cast cars. CLICK a car to hop in — drive with WASD /
// arrow keys (up throttle, down brake/reverse, left/right steer), Esc or click
// again to hop out. The whole table is road: plow marbles, clip blocks, leave
// skid marks. The camera follows whichever car you're driving (driveTarget).

const TRACK_W = 118      // asphalt width — wide enough to actually race + drift
const N_PTS = 460        // sampled points around the circuit (smoothness)

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

// ---- track geometry: a big GP circuit sprawling across the whole UPPER-LEFT of
// the room (world 6600×4600). Clockwise waypoints, routed clear of the dresser
// (x ≤ 440 around y1500) and the lower games/rug (y > ~2200); a closed
// Catmull-Rom spline is sampled through them for a smooth ribbon. ----
type Pt = { x: number; y: number }
// the raw layout below is shrunk by TRACK_SCALE and re-centred at (TRACK_CX,
// TRACK_CY) — so the whole track resizes/moves from just these two knobs.
const TRACK_SCALE = 0.66
const TRACK_CX = 2000, TRACK_CY = 900   // shifted right to clear the corner shelves
const RAW_WAYPOINTS: Pt[] = [
  { x: 720, y: 1980 },   // 0 — start/finish, long bottom straight
  { x: 1500, y: 2030 },
  { x: 2300, y: 1990 },
  { x: 2900, y: 1860 },  // sweep up the right side
  { x: 3080, y: 1480 },
  { x: 2960, y: 1120 },  // right-side esse
  { x: 3090, y: 760 },
  { x: 2760, y: 500 },   // top-right hairpin
  { x: 2280, y: 560 },
  { x: 1820, y: 460 },   // gentle wave across the top
  { x: 1380, y: 580 },
  { x: 940, y: 460 },
  { x: 640, y: 700 },    // top-left corner
  { x: 560, y: 1080 },   // down the left side (x≥560 clears the dresser)
  { x: 680, y: 1440 },
  { x: 560, y: 1780 },
  { x: 660, y: 1960 },   // left hairpin, closing back to start
]
const RAW_C = { x: 1825, y: 1245 }   // bbox centre of the raw layout above
const WAYPOINTS: Pt[] = RAW_WAYPOINTS.map((p) => ({
  x: TRACK_CX + (p.x - RAW_C.x) * TRACK_SCALE,
  y: TRACK_CY + (p.y - RAW_C.y) * TRACK_SCALE,
}))

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t, t3 = t2 * t
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
}

const trackPts: Pt[] = []
{
  const n = WAYPOINTS.length
  const per = Math.round(N_PTS / n)
  for (let i = 0; i < n; i++) {
    const p0 = WAYPOINTS[(i - 1 + n) % n], p1 = WAYPOINTS[i], p2 = WAYPOINTS[(i + 1) % n], p3 = WAYPOINTS[(i + 2) % n]
    for (let j = 0; j < per; j++) trackPts.push(catmull(p0, p1, p2, p3, j / per))
  }
}
const trackPoint = (i: number): Pt => trackPts[((i % trackPts.length) + trackPts.length) % trackPts.length]

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

// little pines, rocks, and grass tufts scattered on the grassy infield inside the
// loop — hand-placed (relative to the track centre) so nothing lands on the road.
const TAU = Math.PI * 2
const INFIELD: { dx: number; dy: number; k: 'pine' | 'rock' | 'tuft'; s: number }[] = [
  { dx: -190, dy: -34, k: 'pine', s: 1.0 }, { dx: -70, dy: -74, k: 'rock', s: 1.1 }, { dx: 44, dy: -58, k: 'pine', s: 0.8 },
  { dx: 168, dy: -26, k: 'pine', s: 1.1 }, { dx: -206, dy: 58, k: 'rock', s: 0.8 }, { dx: -84, dy: 66, k: 'tuft', s: 1 },
  { dx: 58, dy: 74, k: 'pine', s: 0.9 }, { dx: 176, dy: 52, k: 'rock', s: 1.0 }, { dx: -8, dy: 4, k: 'rock', s: 1.3 },
  { dx: 116, dy: 6, k: 'tuft', s: 1 }, { dx: -140, dy: 14, k: 'pine', s: 1.0 }, { dx: 26, dy: -8, k: 'tuft', s: 1 },
]

function drawPine(g: Ctx, x: number, y: number, s: number): void {
  g.fillStyle = 'rgba(32,26,23,0.18)'; g.beginPath(); g.ellipse(x + 4, y + 3, 15 * s, 5 * s, 0, 0, TAU); g.fill()
  g.fillStyle = '#8a5a2b'; roundRect(g, x - 3 * s, y - 8 * s, 6 * s, 12 * s, 2); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = '#3f8f4f'; g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = 'round'
  for (let k = 0; k < 3; k++) { const ty = y - 4 * s - k * 13 * s, w = (20 - k * 5) * s; g.beginPath(); g.moveTo(x, ty - 20 * s); g.lineTo(x + w, ty); g.lineTo(x - w, ty); g.closePath(); g.fill(); g.stroke() }
}
function drawRock(g: Ctx, x: number, y: number, s: number): void {
  g.fillStyle = 'rgba(32,26,23,0.18)'; g.beginPath(); g.ellipse(x + 4, y + 3, 16 * s, 6 * s, 0, 0, TAU); g.fill()
  g.fillStyle = '#9aa0a5'; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(x - 15 * s, y + 4 * s); g.lineTo(x - 10 * s, y - 8 * s); g.lineTo(x + 2 * s, y - 11 * s); g.lineTo(x + 14 * s, y - 4 * s); g.lineTo(x + 12 * s, y + 6 * s); g.closePath(); g.fill(); g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(x - 9 * s, y - 6 * s); g.lineTo(x - 1 * s, y - 8 * s); g.lineTo(x - 4 * s, y - 1 * s); g.closePath(); g.fill()
}
function drawTuft(g: Ctx, x: number, y: number, s: number): void {
  g.strokeStyle = '#5cae61'; g.lineWidth = 3 * s; g.lineCap = 'round'
  for (const dx of [-8, -3, 2, 7]) { g.beginPath(); g.moveTo(x + dx * s, y + 4 * s); g.quadraticCurveTo(x + dx * s * 1.4, y - 8 * s, x + dx * s * 2 + 2, y - 14 * s); g.stroke() }
}
function drawInfield(g: Ctx): void {
  for (const it of INFIELD) {
    const x = TRACK_CX + it.dx, y = TRACK_CY + it.dy
    if (it.k === 'pine') drawPine(g, x, y, it.s)
    else if (it.k === 'rock') drawRock(g, x, y, it.s)
    else drawTuft(g, x, y, it.s)
  }
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
    if (e.code === 'Escape') { controlling = -1; hideVehicleHelp(); return }
    const k = KEYMAP[e.code]
    if (k) { keys[k] = true; e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code]
    if (k) keys[k] = false
  })
  // another vehicle (the drone) took control → hop out of the car
  window.addEventListener('dw-vehicle-claim', (e) => { if ((e as CustomEvent).detail !== 'car') { controlling = -1; hideVehicleHelp() } })

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
          if (controlling !== -1) { window.dispatchEvent(new CustomEvent('dw-vehicle-claim', { detail: 'car' })); showVehicleHelp('car') }
          else hideVehicleHelp()
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
      drawInfield(g)
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
    // ---- orange Hot Wheels track: cast shadow, ink border, bright raised side
    //      rails around a slightly-recessed centre channel (no infield — it's
    //      just track laid on the floor, like the real toy) ----
    g.strokeStyle = 'rgba(32,26,23,0.2)'; g.lineWidth = TRACK_W + 10
    g.save(); g.translate(5, 8); path(); g.stroke(); g.restore()
    g.strokeStyle = INK; g.lineWidth = TRACK_W + 6; path(); g.stroke()
    g.strokeStyle = '#ffb877'; g.lineWidth = TRACK_W; path(); g.stroke()          // bright outer rim
    g.strokeStyle = '#f2872f'; g.lineWidth = TRACK_W - 7; path(); g.stroke()      // rail tops
    g.strokeStyle = '#d9661a'; g.lineWidth = TRACK_W - 42; path(); g.stroke()     // recessed centre channel
    g.strokeStyle = 'rgba(120,50,10,0.3)'; g.lineWidth = 2; path(); g.stroke()    // centre groove hint

    // ---- blue connector clips straddling the track at intervals ----
    const everyClip = Math.round(trackPts.length / 6)
    for (let i = 0; i < trackPts.length; i += everyClip) {
      const p = trackPoint(i), q = trackPoint(i + 1)
      const ang = Math.atan2(q.y - p.y, q.x - p.x)
      g.save(); g.translate(p.x, p.y); g.rotate(ang)
      const cw = 30, ch = TRACK_W + 20
      g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -cw / 2 + 3, -ch / 2 + 4, cw, ch, 8); g.fill()
      g.fillStyle = '#4aa3e0'; roundRect(g, -cw / 2, -ch / 2, cw, ch, 8); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.4)'; roundRect(g, -cw / 2 + 5, -ch / 2 + 4, cw - 10, 6, 3); g.fill()   // sheen
      g.fillStyle = '#2f7cb8'
      for (const py of [-ch * 0.3, ch * 0.3]) { g.beginPath(); g.ellipse(0, py, 6, 6, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.6; g.strokeStyle = INK; g.stroke() }
      g.restore()
    }
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
