import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// The toy chest by the door: a wooden trunk with steel straps. Press the lid and
// it swings open toward the wall while the toys inside POP out with real hops,
// scatter, and settle askew. Press again and they hop back in and the lid shuts.

const CW = 520
const CH = 360
const G = 4400

interface Toy {
  kind: 'ball' | 'block' | 'car' | 'star'
  color: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  rot: number
  out: boolean
  homing: boolean
  squash: number
  delay: number
}

export function createToyChest(cx: number, cy: number): TableGame {
  const x0 = cx - CW / 2, y0 = cy - CH / 2
  let open = false
  let lid = 0            // 0 = shut, 1 = fully open
  const seeds: Array<Pick<Toy, 'kind' | 'color'>> = [
    { kind: 'ball', color: theme.colors.coral },
    { kind: 'block', color: theme.colors.sky },
    { kind: 'car', color: theme.colors.lime },
    { kind: 'star', color: '#f7c948' },
  ]
  const toys: Toy[] = seeds.map(t => ({ ...t, x: cx, y: cy, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, out: false, homing: false, squash: 0, delay: 0 }))

  registerObstacleProvider(() => [{ x: cx, y: cy, half: CH / 2 }])

  const inside = (x: number, y: number): boolean =>
    x > x0 - 10 && x < x0 + CW + 10 && y > y0 - 60 && y < y0 + CH + 10

  const burst = (): void => {
    toys.forEach((t, i) => {
      t.out = true; t.homing = false
      t.x = cx + (Math.random() - 0.5) * 120
      t.y = y0 - 10
      t.z = 60
      const a = -Math.PI / 2 + (i - 1.5) * 0.55 + (Math.random() - 0.5) * 0.3
      const sp = 300 + Math.random() * 260
      t.vx = Math.cos(a) * sp * 1.4
      t.vy = Math.abs(Math.sin(a)) * -sp - 140   // always launch away from the wall
      t.vz = 700 + Math.random() * 400
      t.rot = (Math.random() - 0.5) * 2
      t.delay = i * 0.07                          // pop one-two-three-four, not all at once
    })
  }
  const recall = (): void => {
    for (const t of toys) { t.homing = true; t.delay = Math.random() * 0.12 }
  }

  return {
    id: 'toychest',
    onDown(x, y) {
      if (!inside(x, y)) return false
      open = !open
      spark(cx, y0, 0.22)
      if (open) burst()
      else recall()
      return true
    },
    onMove() {},
    onUp() {},
    update(dt) {
      lid += ((open ? 1 : 0) - lid) * Math.min(1, dt * 9)

      for (const t of toys) {
        if (!t.out) continue
        if (t.delay > 0) { t.delay -= dt; continue }
        t.squash = Math.max(0, t.squash - dt * 6)

        if (t.homing) {
          // hop back toward the chest mouth; dive in when close
          const hx = cx - t.x, hy = y0 + 40 - t.y
          const d = Math.hypot(hx, hy)
          if (d < 60 && t.z < 40) { t.out = false; spark(cx, y0 + 20, 0.1); continue }
          t.vx += (hx / (d || 1)) * 2600 * dt
          t.vy += (hy / (d || 1)) * 2600 * dt
          if (t.z <= 0 && t.vz <= 0) t.vz = 460   // keep hopping home
        }

        t.vz -= G * dt
        t.z += t.vz * dt
        if (t.z <= 0) {
          const impact = -t.vz
          t.z = 0
          t.vx *= 0.4; t.vy *= 0.4
          if (impact > 380 && !t.homing) {
            t.vz = impact * 0.22
            t.squash = 1
            spark(t.x, t.y, Math.min(0.6, impact / 2200))
          } else t.vz = 0
          t.rot = (Math.random() - 0.5) * 0.5
        }
        const f = Math.exp(-(t.z > 0.5 ? 1.5 : 14) * dt)
        t.vx *= f; t.vy *= f
        t.x += t.vx * dt
        t.y += t.vy * dt
      }
    },
    draw(g, t) {
      // ---- open lid lies toward the wall behind the chest ----
      if (lid > 0.03) {
        const lh = 150 * lid
        g.fillStyle = '#9a7747'
        roundRect(g, x0 + 10, y0 - lh - 8, CW - 20, lh + 14, 12); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
        g.fillStyle = '#c9ced3'
        for (const fx of [0.16, 0.84]) {   // straps continue over the open lid
          g.fillRect(x0 + CW * fx - 20, y0 - lh - 6, 40, lh + 10)
          g.strokeRect(x0 + CW * fx - 20, y0 - lh - 6, 40, lh + 10)
        }
      }

      // ---- chest body ----
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, x0 + 7, y0 + 11, CW, CH, 20); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, x0, y0, CW, CH, 20); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()

      if (lid > 0.5) {
        // looking into the open chest: dark well + a jumble of toy shapes
        g.fillStyle = '#3d2712'
        roundRect(g, x0 + 22, y0 + 22, CW - 44, CH - 44, 12); g.fill()
        g.lineWidth = 2.5; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.08)'
        g.beginPath(); g.ellipse(cx, cy + 30, CW * 0.3, 40, 0, 0, Math.PI * 2); g.fill()
      } else {
        // closed lid top: planks + a seam near the front
        g.fillStyle = '#b5915a'
        roundRect(g, x0 + 16, y0 + 16, CW - 32, CH - 32, 12); g.fill()
        g.lineWidth = 2.5; g.stroke()
        g.strokeStyle = 'rgba(74,48,22,0.4)'; g.lineWidth = 2
        for (const fy of [0.42, 0.68]) {
          g.beginPath(); g.moveTo(x0 + 20, y0 + CH * fy); g.lineTo(x0 + CW - 20, y0 + CH * fy); g.stroke()
        }
      }
      // steel straps + latch
      g.fillStyle = '#c9ced3'
      for (const fx of [0.16, 0.84]) {
        g.fillRect(x0 + CW * fx - 20, y0 - 2, 40, CH + 4)
        g.lineWidth = 2.5; g.strokeStyle = INK
        g.strokeRect(x0 + CW * fx - 20, y0 - 2, 40, CH + 4)
      }
      const bob = Math.sin(t / 500) * 2   // the latch invites the press
      g.fillStyle = '#e9c96c'
      roundRect(g, cx - 26, y0 + CH - 44 + bob, 52, 34, 8); g.fill()
      g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke()
      g.fillStyle = INK
      g.beginPath(); g.arc(cx, y0 + CH - 27 + bob, 5, 0, Math.PI * 2); g.fill()

      // ---- the toys, sorted so higher hops draw on top ----
      const order = [...toys].filter(ty => ty.out && ty.delay <= 0).sort((a, b) => a.z - b.z)
      for (const toy of order) {
        const raise = toy.z * 0.75
        const shScale = Math.max(0.5, 1 - toy.z / 700)
        g.fillStyle = `rgba(32,26,23,${Math.max(0.08, 0.24 - toy.z / 1200)})`
        g.beginPath(); g.ellipse(toy.x + 4, toy.y + 7, 40 * shScale, 30 * shScale, 0, 0, Math.PI * 2); g.fill()
        g.save()
        g.translate(toy.x, toy.y - raise)
        g.rotate(toy.rot)
        g.scale(1 + toy.squash * 0.14, 1 - toy.squash * 0.16)
        g.lineJoin = 'round'
        if (toy.kind === 'ball') {
          g.fillStyle = toy.color
          g.beginPath(); g.arc(0, 0, 36, 0, Math.PI * 2); g.fill()
          g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
          g.fillStyle = '#fefaf0'
          g.beginPath(); g.ellipse(-12, -13, 9, 5, -0.6, 0, Math.PI * 2); g.fill()
          g.strokeStyle = 'rgba(32,26,23,0.3)'; g.lineWidth = 2.5
          g.beginPath(); g.arc(0, 0, 36, 0.4, 1.6); g.stroke()
        } else if (toy.kind === 'block') {
          g.fillStyle = '#ecd9ae'
          roundRect(g, -30, -30, 60, 60, 8); g.fill()
          g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
          g.lineWidth = 5; g.strokeStyle = toy.color
          roundRect(g, -19, -19, 38, 38, 4); g.stroke()
        } else if (toy.kind === 'car') {
          g.fillStyle = toy.color
          roundRect(g, -40, -22, 80, 44, 14); g.fill()
          g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
          g.fillStyle = '#5aa0db'
          roundRect(g, -12, -14, 30, 28, 6); g.fill()
          g.lineWidth = 2; g.stroke()
          g.fillStyle = INK
          for (const [wx, wy] of [[-24, -24], [24, -24], [-24, 24], [24, 24]] as const) {
            g.beginPath(); g.ellipse(wx, wy, 10, 5, 0, 0, Math.PI * 2); g.fill()
          }
        } else {
          g.fillStyle = toy.color
          g.beginPath()
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? 38 : 17
            const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
            if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            else g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          }
          g.closePath(); g.fill()
          g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        }
        g.restore()
      }
    },
  }
}
