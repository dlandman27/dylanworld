import { theme } from '../../config/theme'
import { spark, registerObstacleProvider, allObstacles } from '../physics'
import { clunk } from '../audio'
import { world } from '../../config/world'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// Wind-up chattering teeth. Crank the key in circles to wind the spring
// (ratchet clicks), let go and it hops across the table — jaw clacking, feet
// pattering, veering drunkenly, bumping blocks and marbles — until the spring
// runs out and it dies with a few slow chomps. Drag the body to carry it.

const BW = 46          // body half-width
const KEY_R = 17       // wind-up key radius
const MAX_WIND = 9     // seconds of chatter, fully wound
const HOP_G = 2600

export function createTeeth(hx: number, hy: number): TableGame {
  let x = hx, y = hy
  let z = 0, vz = 0
  let heading = Math.random() * Math.PI * 2
  let energy = 0
  let jaw = 0            // 0 closed … 1 open
  let jawPhase = 0
  let keyAng = 0
  let stepPhase = 0
  let pvx = 0, pvy = 0   // push velocity from getting smacked
  let held: 'body' | 'key' | null = null
  let hoff = { x: 0, y: 0 }
  let lastKeyA = 0
  let ratchet = 0
  const SELF = Symbol('teeth')

  const keyPos = (): { x: number; y: number } => ({ x: x - BW - KEY_R * 0.7, y: y + 10 })
  const chattering = (): boolean => energy > 0 && held === null

  registerObstacleProvider(() => {
    if (held) return []
    return [{
      // box matches the drawn body (jaws slightly high, key poking left)
      x: x - 6, y: y - 8, half: BW * 1.02, owner: SELF,
      onHit: (ix: number, iy: number) => { pvx += ix * 0.4; pvy += iy * 0.4 },
    }]
  })

  const bumpObstacles = (active: boolean): void => {
    for (const o of allObstacles()) {
      if (o.owner === SELF) continue
      const cx = Math.min(Math.max(x, o.x - o.half), o.x + o.half)
      const cy = Math.min(Math.max(y, o.y - o.half), o.y + o.half)
      let dx = x - cx, dy = y - cy
      let d = Math.hypot(dx, dy)
      const rr = BW * 0.9
      if (d >= rr) continue
      if (d === 0) { dx = x - o.x; dy = y - o.y; d = Math.hypot(dx, dy) || 1 }
      const nx = dx / d, ny = dy / d
      // always resolve the overlap so pieces never rest inside each other
      x = cx + nx * rr
      y = cy + ny * rr
      if (active) {
        // shove what it bit, then waddle off some other way
        o.onHit?.(-nx * 260, -ny * 260)
        heading = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.2
        spark(cx, cy, 0.18)
      }
    }
  }

  return {
    id: 'teeth',
    onDown(px, py) {
      const k = keyPos()
      if (Math.hypot(px - k.x, py - k.y) < KEY_R + 12) {
        held = 'key'
        lastKeyA = Math.atan2(py - y, px - x)
        return true
      }
      if (Math.abs(px - x) < BW + 12 && Math.abs(py - y) < BW + 10) {
        held = 'body'
        hoff = { x: px - x, y: py - y }
        return true
      }
      return false
    },
    onMove(px, py) {
      if (held === 'body') {
        x = px - hoff.x
        y = py - hoff.y
      } else if (held === 'key') {
        // crank: angle swept around the body winds the spring
        const a = Math.atan2(py - y, px - x)
        let d = a - lastKeyA
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        lastKeyA = a
        keyAng += d
        energy = Math.min(MAX_WIND, energy + Math.abs(d) * 0.45)
        ratchet += Math.abs(d)
        if (ratchet > 0.9) { ratchet = 0; clunk(0.12) } // the winding clicks
      }
    },
    onUp() { held = null },
    update(dt) {
      stepPhase += dt * (chattering() ? 22 : 4)
      if (held === 'body') { z += (26 - z) * Math.min(1, dt * 12); return }
      if (held === 'key') return

      // spring unwinds → chatter
      if (chattering()) {
        energy = Math.max(0, energy - dt)
        jawPhase += dt * 24
        jaw = Math.abs(Math.sin(jawPhase)) * Math.min(1, 0.35 + energy / 3)
        keyAng -= dt * 9 // key spins backwards as it unwinds
        // hop!
        if (z <= 0 && vz <= 0) {
          vz = 210 + Math.random() * 130
          heading += (Math.random() - 0.5) * 0.8
          clunk(0.06)
        }
        const spd = 120 + Math.min(60, energy * 10)
        x += Math.cos(heading) * spd * dt
        y += Math.sin(heading) * spd * dt
        bumpObstacles(true)
      } else {
        // dying chomps, then stillness — but never resting inside another piece
        jaw = Math.max(0, jaw - dt * 2.2)
        bumpObstacles(false)
      }
      // hop physics + leftover shoves
      vz -= HOP_G * dt
      z = Math.max(0, z + vz * dt)
      if (z === 0 && vz < -50) vz = 0
      x += pvx * dt
      y += pvy * dt
      const pf = Math.exp(-6 * dt)
      pvx *= pf; pvy *= pf
      // stay on the table — turn around at the rim
      if (x < BW || x > world.width - BW) { heading = Math.PI - heading; x = Math.min(Math.max(x, BW), world.width - BW) }
      if (y < BW || y > world.height - BW) { heading = -heading; y = Math.min(Math.max(y, BW), world.height - BW) }
    },
    draw(g: Ctx) {
      // ground shadow (hops lift it)
      const shs = Math.max(0.6, 1 - z / 220)
      g.fillStyle = `rgba(32,26,23,${Math.max(0.1, 0.24 - z / 600)})`
      g.beginPath(); g.ellipse(x + 3, y + BW * 0.72, BW * shs, BW * 0.3 * shs, 0, 0, Math.PI * 2); g.fill()

      g.save()
      g.translate(x, y - z * 0.6)
      g.lineJoin = 'round'

      // the classic toy: glossy RED gums, scalloped white teeth, no face
      const RED = '#d7332f'
      const RED_DARK = '#a8221f'
      const bounce = Math.sin(stepPhase) * (chattering() ? 2.5 : 0)
      g.translate(0, bounce * 0.4)

      // lower jaw: shorter red block, teeth pointing up, sits a touch forward
      g.save()
      g.translate(BW * 0.06, 0)
      g.fillStyle = RED
      g.beginPath()
      g.moveTo(-BW * 0.94, 8)
      g.quadraticCurveTo(-BW * 1.02, BW * 0.58, -BW * 0.5, BW * 0.6)
      g.lineTo(BW * 0.62, BW * 0.6)
      g.quadraticCurveTo(BW * 0.98, BW * 0.55, BW * 0.94, 10)
      g.closePath()
      g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // base shading
      g.fillStyle = RED_DARK
      g.beginPath()
      g.moveTo(-BW * 0.9, BW * 0.44)
      g.quadraticCurveTo(0, BW * 0.66, BW * 0.9, BW * 0.42)
      g.lineTo(BW * 0.9, BW * 0.52)
      g.quadraticCurveTo(0, BW * 0.72, -BW * 0.9, BW * 0.54)
      g.closePath()
      g.fill()
      drawTeethRow(g, -1)
      g.restore()

      // upper jaw: tall glossy red block, hinged at the back, opens by -jaw
      g.save()
      g.translate(-BW * 0.7, 2)
      g.rotate(-jaw * 0.5)
      g.translate(BW * 0.7, -2)
      g.fillStyle = RED
      g.beginPath()
      g.moveTo(-BW * 0.96, 4)
      g.quadraticCurveTo(-BW * 1.05, -BW * 0.85, -BW * 0.3, -BW * 0.9)
      g.quadraticCurveTo(BW * 0.5, -BW * 0.95, BW * 0.86, -BW * 0.45)
      g.quadraticCurveTo(BW * 1.02, -BW * 0.1, BW * 0.96, 6)
      g.closePath()
      g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // glossy highlight sweep
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.beginPath()
      g.ellipse(-BW * 0.35, -BW * 0.55, BW * 0.34, BW * 0.16, -0.35, 0, Math.PI * 2)
      g.fill()
      drawTeethRow(g, 1)
      g.restore()

      // small white wind-up key, low by the hinge (like the real one)
      g.save()
      g.translate(-BW - KEY_R * 0.7, 10)
      g.strokeStyle = INK
      g.lineWidth = 2.2
      g.fillStyle = '#e9e6df'
      g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill(); g.stroke()
      g.rotate(keyAng)
      g.fillStyle = '#f4f1ea'
      g.beginPath()
      g.ellipse(-KEY_R * 0.7, 0, KEY_R * 0.72, 6.5, 0, 0, Math.PI * 2)
      g.fill(); g.stroke()
      g.restore()

      // wind gauge: a tiny arc over it while it has juice
      if (energy > 0 && !chattering() && held !== 'key') { /* held body: skip */ }
      if (held === 'key') {
        g.strokeStyle = theme.colors.lime
        g.lineWidth = 5
        g.lineCap = 'round'
        g.beginPath()
        g.arc(0, -BW * 1.15, 26, -Math.PI * 0.5 - (energy / MAX_WIND) * Math.PI, -Math.PI * 0.5 + (energy / MAX_WIND) * Math.PI)
        g.stroke()
      }
      g.restore()

      function drawTeethRow(gg: Ctx, dir: number): void {
        // a full scalloped row: 7 rounded teeth, tips facing dir (1 = down)
        const N = 7
        const w = (BW * 1.7) / N
        const h = 15
        gg.fillStyle = '#fbfaf4'
        gg.lineWidth = 2
        gg.strokeStyle = INK
        for (let i = 0; i < N; i++) {
          const tx = -BW * 0.85 + i * w
          const ty = dir === 1 ? 2 : -h + 6
          gg.beginPath()
          if (typeof gg.roundRect === 'function') {
            // rounded tips only on the biting edge
            gg.roundRect(tx + 0.5, ty, w - 1, h, dir === 1 ? [1, 1, w * 0.48, w * 0.48] : [w * 0.48, w * 0.48, 1, 1])
          } else {
            gg.rect(tx + 0.5, ty, w - 1, h)
          }
          gg.fill(); gg.stroke()
        }
      }
    },
  }
}
