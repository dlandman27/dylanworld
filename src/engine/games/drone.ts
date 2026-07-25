import { world } from '../../config/world'
import { theme } from '../../config/theme'
import { spark } from '../physics'
import type { Prop } from '../../types'
import { showVehicleHelp, hideVehicleHelp } from '../../ui/vehicleHelp'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A little RC quadcopter parked on a helipad. CLICK it to take off, then:
//   WASD / arrows — fly in any direction   Space — climb   C — drop
//   Shift — boost                          G — grab/drop a marble   Esc — land
// It hovers ABOVE everything, tilts + yaws into its motion, its rotor-wash blows
// loose props out from under it, and it can pluck a marble off the floor and
// carry it through the air. One vehicle at a time (shared with the cars).

const R = 44
const MAX_V = 650
const ALT_MIN = 24, ALT_MAX = 150, ALT_DEFAULT = 62
const CARRY_GAP = 52     // how far the grabbed marble hangs below the drone

let droneTargetPos: { x: number; y: number } | null = null
export function droneTarget(): { x: number; y: number } | null { return droneTargetPos }

const keys = { up: false, down: false, left: false, right: false, ascend: false, descend: false, boost: false }
const KEYMAP: Record<string, keyof typeof keys> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'ascend', KeyC: 'descend', ShiftLeft: 'boost', ShiftRight: 'boost',
}
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

export function createDrone(padX: number, padY: number, props: Prop[], color: string, id: string): TableGame {
  let flying = false
  let returning = false     // auto-flying home to the pad (recalled)
  const d = { x: padX, y: padY, vx: 0, vy: 0, z: 0, alt: ALT_DEFAULT, spin: 0, yaw: 0, tiltX: 0, tiltY: 0 }
  let carried: Prop | null = null
  // the held marble follows on a spring (it swings/trails, settles when hovering)
  let hx = 0, hy = 0, hvx = 0, hvy = 0
  // a marble mid-drop: falls (z→0) under gravity then hands back to physics
  let dropping: { p: Prop; sx: number; gy: number; z: number; vz: number; vx: number; vy: number } | null = null

  const releaseCarried = (): void => {
    if (!carried) return
    carried.grabbed = false
    // let it fall from where it's hanging (screen y hy, height d.z above the floor)
    dropping = { p: carried, sx: hx, gy: hy + d.z, z: d.z, vz: 0, vx: d.vx + hvx * 0.5, vy: d.vy + hvy * 0.5 }
    carried = null
  }
  const toggleGrab = (): void => {
    if (carried) { releaseCarried(); return }
    let best: Prop | null = null, bd = 140
    for (const p of props) {
      if (p.kind === 'duck' || p.home) continue    // no ducks, no title letters
      const dd = Math.hypot(p.pos.x - d.x, p.pos.y - d.y)
      if (dd < bd) { bd = dd; best = p }
    }
    if (best) { carried = best; best.grabbed = true; hx = best.pos.x; hy = best.pos.y; hvx = 0; hvy = 0 }
  }

  const setFlying = (on: boolean): void => {
    flying = on
    if (on) { returning = false; d.alt = ALT_DEFAULT; window.dispatchEvent(new CustomEvent('dw-vehicle-claim', { detail: id })); showVehicleHelp('drone') }
    else { keys.up = keys.down = keys.left = keys.right = keys.ascend = keys.descend = keys.boost = false; releaseCarried(); hideVehicleHelp(); droneTargetPos = null }
  }

  window.addEventListener('keydown', (e) => {
    if (!flying) return
    if (e.code === 'Escape') { setFlying(false); return }
    if (e.code === 'KeyG') { toggleGrab(); e.preventDefault(); return }
    const k = KEYMAP[e.code]
    if (k) { keys[k] = true; e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false })
  // any other vehicle (another drone, or a car) claimed control → land this one
  window.addEventListener('dw-vehicle-claim', (e) => { if ((e as CustomEvent).detail !== id) setFlying(false) })

  const bodyX = (): number => d.x + d.tiltX
  const bodyY = (): number => d.y - d.z + d.tiltY

  return {
    id: 'drone',
    onDown(x, y) {
      if (Math.hypot(x - bodyX(), y - bodyY()) < R + 20) { setFlying(!flying); return true }
      // tap this drone's empty pad to recall it home (only when it's not in use)
      if (!flying && Math.hypot(x - padX, y - padY) < 66) {
        if (Math.hypot(d.x - padX, d.y - padY) > 12) returning = true
        return true
      }
      return false
    },
    onMove() {},
    onUp() {},
    update(dt) {
      if (flying) {
        if (keys.ascend) d.alt = Math.min(ALT_MAX, d.alt + 175 * dt)
        if (keys.descend) d.alt = Math.max(ALT_MIN, d.alt - 175 * dt)
        // buttery: ease velocity toward a target (smooth ramp up AND glide to stop)
        const maxv = keys.boost ? MAX_V * 1.7 : MAX_V
        let tvx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        let tvy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
        const tl = Math.hypot(tvx, tvy)
        if (tl > 0) { tvx = (tvx / tl) * maxv; tvy = (tvy / tl) * maxv }
        const k = Math.min(1, dt * 4.5)
        d.vx += (tvx - d.vx) * k
        d.vy += (tvy - d.vy) * k
      } else if (!returning) {
        const dr = Math.exp(-4 * dt); d.vx *= dr; d.vy *= dr
      }
      const tz = flying ? d.alt : (returning ? 46 : 0)
      d.z += (tz - d.z) * Math.min(1, dt * 5)
      d.spin += dt * (flying || returning ? 42 : 6)
      d.x = clamp(d.x + d.vx * dt, 60, world.width - 60)
      d.y = clamp(d.y + d.vy * dt, 60, world.height - 60)
      // recalled → ease home to the pad, then settle
      if (!flying && returning) {
        d.x += (padX - d.x) * Math.min(1, dt * 3)
        d.y += (padY - d.y) * Math.min(1, dt * 3)
        d.vx = 0; d.vy = 0
        if (Math.hypot(padX - d.x, padY - d.y) < 8) { d.x = padX; d.y = padY; returning = false }
      }

      // lean + yaw into the motion
      d.tiltX += (d.vx * 0.02 - d.tiltX) * Math.min(1, dt * 8)
      d.tiltY += (d.vy * 0.02 - d.tiltY) * Math.min(1, dt * 8)
      if (Math.hypot(d.vx, d.vy) > 45) {
        let dif = (Math.atan2(d.vy, d.vx) - Math.PI / 2) - d.yaw
        while (dif > Math.PI) dif -= Math.PI * 2
        while (dif < -Math.PI) dif += Math.PI * 2
        d.yaw += dif * Math.min(1, dt * 6)
      }

      // rotor downwash — blow loose props out from under the drone
      if (flying) {
        const washK = Math.max(0.15, 1 - d.z / ALT_MAX)
        for (const p of props) {
          if (p === carried || p.kind === 'duck' || p.home) continue
          const dx = p.pos.x - d.x, dy = p.pos.y - d.y, dd = Math.hypot(dx, dy)
          if (dd > 1 && dd < 175) { const f = (1 - dd / 175) * 780 * washK * dt; p.vel.x += (dx / dd) * f; p.vel.y += (dy / dd) * f }
        }
      }

      // carry a plucked marble on a spring — it swings/trails, settles when hovering
      if (carried) {
        const tx = bodyX(), ty = bodyY() + CARRY_GAP
        hvx += (tx - hx) * 190 * dt; hvy += (ty - hy) * 190 * dt
        const hd = Math.exp(-7 * dt); hvx *= hd; hvy *= hd
        hx += hvx * dt; hy += hvy * dt
        carried.pos.x = hx; carried.pos.y = hy
        carried.vel.x = 0; carried.vel.y = 0; carried.restTime = 0; carried.sleeping = false
      }
      // a released marble falling back to the floor under gravity
      if (dropping) {
        dropping.vz += 2600 * dt; dropping.z -= dropping.vz * dt; dropping.sx += dropping.vx * dt
        const p = dropping.p; p.restTime = 0; p.sleeping = false
        if (dropping.z <= 0) {
          p.pos.x = dropping.sx; p.pos.y = dropping.gy; p.vel.x = dropping.vx; p.vel.y = dropping.vy
          spark(dropping.sx, dropping.gy, 0.2)
          dropping = null
        } else {
          p.pos.x = dropping.sx; p.pos.y = dropping.gy - dropping.z; p.vel.x = 0; p.vel.y = 0
        }
      }

      if (flying) droneTargetPos = { x: d.x, y: bodyY() }
    },
    draw(g: Ctx, t) { drawPad(g, padX, padY, color); if (!flying && !returning) drawDrone(g, d, false, t, color, false) },
    drawAbove(g: Ctx, t) {
      // shadow that grows as a dropped marble nears the floor
      if (dropping) {
        const s = 1 - dropping.z / ALT_MAX
        g.fillStyle = `rgba(32,26,23,${0.1 + 0.16 * s})`
        g.beginPath(); g.ellipse(dropping.sx, dropping.gy, 5 + 12 * s, 3 + 8 * s, 0, 0, Math.PI * 2); g.fill()
      }
      if (!(flying || returning)) return
      if (carried) drawBeam(g, bodyX(), bodyY(), carried.pos.x, carried.pos.y, t)
      drawDrone(g, d, true, t, color, flying)
    },
  }
}

// the magnet tractor-beam from the drone down to whatever it's holding
function drawBeam(g: Ctx, x0: number, y0: number, x1: number, y1: number, t: number): void {
  g.save()
  g.fillStyle = 'rgba(120,200,235,0.26)'   // translucent cone
  g.beginPath(); g.moveTo(x0 - 7, y0); g.lineTo(x0 + 7, y0); g.lineTo(x1 + 20, y1); g.lineTo(x1 - 20, y1); g.closePath(); g.fill()
  g.lineWidth = 2.5; g.lineCap = 'round'; g.strokeStyle = '#7ec8eb'   // pulsing magnet rings on the object
  for (let i = 0; i < 3; i++) {
    const rr = 8 + ((t / 7 + i * 10) % 30)
    g.globalAlpha = Math.max(0, 0.85 * (1 - rr / 38))
    g.beginPath(); g.arc(x1, y1, rr, 0, Math.PI * 2); g.stroke()
  }
  g.globalAlpha = 1; g.fillStyle = '#cdeaf8'   // sparks drifting up the beam
  for (let i = 0; i < 3; i++) { const f = ((t / 320 + i / 3) % 1); g.beginPath(); g.arc(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, 2.5, 0, Math.PI * 2); g.fill() }
  g.restore()
}

function drawPad(g: Ctx, x: number, y: number, color: string): void {
  g.fillStyle = 'rgba(32,26,23,0.14)'; g.beginPath(); g.ellipse(x + 4, y + 6, 64, 47, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#3a3f45'; g.beginPath(); g.ellipse(x, y, 62, 45, 0, 0, Math.PI * 2); g.fill()
  g.lineWidth = 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
  g.strokeStyle = color; g.setLineDash([11, 8]); g.lineWidth = 3   // ring matches the drone
  g.beginPath(); g.ellipse(x, y, 49, 35, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
  g.fillStyle = color; g.font = `900 36px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = INK; g.strokeText('H', x, y + 2); g.fillText('H', x, y + 2)
}

function drawDrone(g: Ctx, d: { x: number; y: number; z: number; spin: number; yaw: number; tiltX: number; tiltY: number }, airborne: boolean, t: number, color: string, piloted: boolean): void {
  const sh = Math.max(0.28, 1 - (d.z / ALT_MAX) * 0.55)
  g.fillStyle = `rgba(32,26,23,${0.24 * sh})`
  g.beginPath(); g.ellipse(d.x, d.y, R * 0.85 * sh, R * 0.6 * sh, 0, 0, Math.PI * 2); g.fill()

  const bx = d.x + d.tiltX, by = d.y - d.z + d.tiltY
  const hs = 1 + d.z / 520
  g.save(); g.translate(bx, by); g.scale(hs, hs); g.rotate(d.yaw)
  const arms: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  g.strokeStyle = '#3a3f45'; g.lineWidth = 8; g.lineCap = 'round'
  for (const [ax, ay] of arms) { g.beginPath(); g.moveTo(0, 0); g.lineTo(ax * R, ay * R * 0.82); g.stroke() }
  for (const [ax, ay] of arms) {
    const rx = ax * R, ry = ay * R * 0.82
    g.fillStyle = '#2a2e33'; g.beginPath(); g.arc(rx, ry, 20, 0, Math.PI * 2); g.fill()
    g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
    g.save(); g.translate(rx, ry); g.rotate(d.spin + (ax * ay > 0 ? 0 : 1.2))
    if (airborne) {
      g.globalAlpha = 0.28; g.fillStyle = '#cfd3d6'; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1
      g.strokeStyle = 'rgba(220,222,226,0.55)'; g.lineWidth = 15; g.lineCap = 'round'
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke()
    } else {
      g.strokeStyle = '#9aa0a5'; g.lineWidth = 5; g.lineCap = 'round'
      for (const a of [0, Math.PI / 2]) { g.save(); g.rotate(a); g.beginPath(); g.moveTo(-15, 0); g.lineTo(15, 0); g.stroke(); g.restore() }
    }
    g.restore()
  }
  g.fillStyle = color
  roundRect(g, -23, -19, 46, 38, 11); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(g, -18, -15, 36, 8, 4); g.fill()
  g.fillStyle = '#1c2126'; g.beginPath(); g.arc(0, 12, 8, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
  g.fillStyle = 'rgba(120,200,235,0.8)'; g.beginPath(); g.arc(-2, 10, 3, 0, Math.PI * 2); g.fill()
  g.fillStyle = airborne ? '#57d06a' : '#e0503e'; g.beginPath(); g.arc(0, -13, 4, 0, Math.PI * 2); g.fill()
  g.restore()

  if (piloted) {
    g.strokeStyle = 'rgba(247,201,72,0.85)'; g.lineWidth = 3.5; g.setLineDash([8, 7])
    g.beginPath(); g.arc(bx, by, R * hs + 20, t / 400, t / 400 + Math.PI * 2); g.stroke(); g.setLineDash([])
  }
}
