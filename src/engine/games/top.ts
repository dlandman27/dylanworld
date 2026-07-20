import { theme } from '../../config/theme'
import { spark, registerObstacleProvider, allObstacles } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A little spinning top. Flick it: it spins up, wanders the table in lazy
// arcs, wobbles harder as it slows, then topples with a clatter and lies on
// its side until you grab it again. One toy, one mechanic.

const R = 46            // body radius
const SPIN_MAX = 46     // rad/s cap
const TOPPLE_AT = 3     // spin below this falls over
// brushed-metal palettes (Inception-style machined tops)
export interface Metal { light: string; mid: string; dark: string; deep: string }
export const STEEL: Metal = { light: '#f2f4f6', mid: '#cdd2d6', dark: '#9aa0a5', deep: '#767c81' }
export const GOLD: Metal = { light: '#fbeec6', mid: '#e9c96c', dark: '#c7a23f', deep: '#a2812b' }

export function createTop(hx: number, hy: number, metal: Metal = STEEL): TableGame {
  let x = hx, y = hy
  let vx = 0, vy = 0
  let ang = 0.4            // visual rotation
  let spin = 0             // rad/s
  let lean = 1             // 0 = upright, 1 = lying on its side
  let leanDir = 0.8        // which way it fell (radians)
  let wobPhase = 0
  let held = false
  let hoff = { x: 0, y: 0 }

  const spinning = (): boolean => spin > TOPPLE_AT
  const fallSide = (): number => (Math.cos(leanDir) >= 0 ? 1 : -1)
  const SELF = Symbol('top')

  // marbles knock the top: it scoots the way it was hit, loses some spin, and
  // its wobble jolts. Standing = a small target at the tip; lying = the body.
  registerObstacleProvider(() => {
    if (held) return []
    return [{
      x: x + fallSide() * lean * R * 0.89,
      y,
      half: R * (0.78 + lean * 0.17), // the disc overhang is what things hit
      owner: SELF,
      onHit: (ix: number, iy: number) => {
        vx += ix * 0.55
        vy += iy * 0.55
        if (spinning()) {
          spin *= 0.88
          wobPhase += 0.9
        }
      },
    }]
  })

  /** The roaming top bumps into other games' obstacles (the ABC blocks). */
  const bumpObstacles = (): void => {
    for (const o of allObstacles()) {
      if (o.owner === SELF) continue
      const cx = Math.min(Math.max(x, o.x - o.half), o.x + o.half)
      const cy = Math.min(Math.max(y, o.y - o.half), o.y + o.half)
      let dx = x - cx, dy = y - cy
      let d = Math.hypot(dx, dy)
      const rr = R * 0.95 // contact at the visible disc edge, not an inner core
      if (d >= rr) continue
      if (d === 0) { dx = x - o.x; dy = y - o.y; d = Math.hypot(dx, dy) || 1 }
      const nx = dx / d, ny = dy / d
      x = cx + nx * rr
      y = cy + ny * rr
      const along = vx * nx + vy * ny
      if (along < 0) {
        const speed = -along
        // the top glances off; the block gets shoved the way it was hit
        vx -= 1.4 * along * nx
        vy -= 1.4 * along * ny
        o.onHit?.(-nx * speed, -ny * speed)
        if (speed > 110) {
          spark(cx, cy, Math.min(1, speed / 800))
          if (spinning()) { spin *= 0.9; wobPhase += 0.7 }
        }
      }
    }
  }

  return {
    id: 'top',
    onDown(px, py) {
      // the silhouette stands upward from the tip — accept the whole body
      const inBody = Math.abs(px - x) < R + 14 && py < y + 18 && py > y - R * 1.9
      if (!inBody && Math.hypot(px - x, py - y) > R + 16) return false
      held = true
      hoff = { x: px - x, y: py - y }
      spin = 0
      lean = 0 // picking it up rights it
      vx = 0; vy = 0
      return true
    },
    onMove(px, py) {
      if (held) { x = px - hoff.x; y = py - hoff.y }
    },
    onUp(_px, _py, uvx, uvy) {
      if (!held) return
      held = false
      const speed = Math.hypot(uvx, uvy)
      if (speed > 240) {
        // a real flick: most energy becomes SPIN, a little becomes travel
        spin = Math.min(SPIN_MAX, 6 + speed * 0.026)
        vx = uvx * 0.16
        vy = uvy * 0.16
        wobPhase = Math.random() * Math.PI * 2
        spark(x, y + R * 0.5, 0.15)
      }
      // a gentle set-down just leaves it standing (and it will topple)
    },
    update(dt, t) {
      if (held) return
      ang += spin * dt

      if (spinning()) {
        // friction bleeds the spin; wobble grows as it dies
        spin *= Math.exp(-0.34 * dt)
        // lazy precession arcs — the drunken walk of a real top
        vx += Math.cos(t / 700 + wobPhase) * 46 * dt
        vy += Math.sin(t / 900 + wobPhase * 1.7) * 46 * dt
        const f = Math.exp(-0.9 * dt)
        vx *= f; vy *= f
        x += vx * dt
        y += vy * dt
        lean = Math.max(0, lean - dt * 4)
        // soft leash back toward its home patch so it never wanders off
        const dx = hx - x, dy = hy - y
        const d = Math.hypot(dx, dy)
        if (d > 300) { vx += (dx / d) * 220 * dt; vy += (dy / d) * 220 * dt }
      } else if (spin > 0 || lean < 1) {
        // out of juice: fall over with a clatter
        if (lean === 0) leanDir = Math.atan2(vy, vx) || Math.random() * Math.PI * 2
        const before = lean
        lean = Math.min(1, lean + dt * 3.4)
        if (before < 1 && lean === 1) {
          spark(x + Math.cos(leanDir) * R * 0.7, y + Math.sin(leanDir) * R * 0.7, 0.22)
          spin = 0
        }
        const f = Math.exp(-8 * dt)
        vx *= f; vy *= f
        x += vx * dt
        y += vy * dt
      }
      // whatever state it's in, never sit inside another piece
      bumpObstacles()
    },
    draw(g: Ctx, _t) {
      // only the ground shadow lives on the table layer (under the marbles):
      // tight under the tip when upright; tracking the fallen body when lying
      const wobble = spinning() ? Math.max(0, 1 - spin / 14) : 0
      const side = fallSide()
      const shCx = x + side * lean * R * 0.89 + 3
      const shLen = R * (0.55 + lean * 0.5) + wobble * 4
      g.fillStyle = 'rgba(32,26,23,0.22)'
      g.beginPath()
      g.ellipse(shCx, y + 7, shLen, R * (0.3 - lean * 0.08), 0, 0, Math.PI * 2)
      g.fill()
    },
    drawAbove(g: Ctx, t) {
      // Side-profile silhouette (like the real thing): tip on the table, cone
      // up to a wide disc lip, tapered neck, tall stem with a rounded cap.
      // Standing = silhouette upright, leaning as it wobbles; falling rotates
      // the whole silhouette about the TIP until it lies flat. Drawn above the
      // props layer so marbles roll behind it, not over it.
      const wobble = spinning() ? Math.max(0, 1 - spin / 14) : 0
      const side = fallSide()
      const tiltNow = spinning()
        ? Math.sin(t / 42 + wobPhase) * wobble * 0.22
        : side * lean * (Math.PI / 2 - 0.06)

      // proportions (all off R)
      const DISC_Y = -R * 0.78   // disc height above the tip
      const DISC_RX = R          // disc half-width
      const NECK_Y = -R * 1.06
      const STEM_TOP = -R * 1.78

      g.save()
      g.translate(x, y)
      g.rotate(tiltNow)
      g.lineJoin = 'round'

      // banded metal gradient — hard stops read as machined steel
      const cone = g.createLinearGradient(-DISC_RX, 0, DISC_RX, 0)
      cone.addColorStop(0, metal.dark)
      cone.addColorStop(0.18, metal.light)
      cone.addColorStop(0.3, '#ffffff')
      cone.addColorStop(0.42, metal.mid)
      cone.addColorStop(0.72, metal.dark)
      cone.addColorStop(1, metal.deep)
      g.fillStyle = cone
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(-DISC_RX * 0.92, DISC_Y + R * 0.1)
      g.lineTo(DISC_RX * 0.92, DISC_Y + R * 0.1)
      g.closePath()
      g.fill()
      g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()

      // disc lip: wide flat ellipse
      g.fillStyle = cone
      g.beginPath()
      g.ellipse(0, DISC_Y, DISC_RX, R * 0.22, 0, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()

      // faint machined groove on the lip (bare metal)
      g.strokeStyle = 'rgba(70,76,80,0.3)'
      g.lineWidth = 1.4
      g.beginPath()
      g.ellipse(0, DISC_Y, DISC_RX * 0.8, R * 0.155, 0, 0, Math.PI * 2)
      g.stroke()
      // cone-side specular streak: crosses the front, vanishes around the back
      const cs = Math.cos(ang * 0.7)
      if (cs > 0.05) {
        g.save()
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(-DISC_RX * 0.92, DISC_Y + R * 0.1)
        g.lineTo(DISC_RX * 0.92, DISC_Y + R * 0.1)
        g.closePath()
        g.clip()
        const bx = Math.sin(ang * 0.7) * DISC_RX * 0.7
        g.globalAlpha = 0.32 * cs
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.moveTo(bx * 0.15, -2)
        g.lineTo(bx - 7 * cs, DISC_Y + R * 0.1)
        g.lineTo(bx + 7 * cs, DISC_Y + R * 0.1)
        g.closePath()
        g.fill()
        g.globalAlpha = 1
        g.restore()
      }

      // upper cone: disc → neck
      g.fillStyle = cone
      g.beginPath()
      g.moveTo(-DISC_RX * 0.42, DISC_Y - R * 0.06)
      g.lineTo(-R * 0.14, NECK_Y)
      g.lineTo(R * 0.14, NECK_Y)
      g.lineTo(DISC_RX * 0.42, DISC_Y - R * 0.06)
      g.closePath()
      g.fill()
      g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()

      // stem: slight taper up to a rounded cap
      g.fillStyle = cone
      g.beginPath()
      g.moveTo(-R * 0.14, NECK_Y)
      g.lineTo(-R * 0.1, STEM_TOP)
      g.arc(0, STEM_TOP, R * 0.1, Math.PI, 0)
      g.lineTo(R * 0.14, NECK_Y)
      g.closePath()
      g.fill()
      g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()
      // stem highlight line
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = 2
      g.beginPath(); g.moveTo(-R * 0.045, NECK_Y - 2); g.lineTo(-R * 0.03, STEM_TOP + 3); g.stroke()
      // coral cap on the stem
      g.fillStyle = theme.colors.coral
      g.beginPath(); g.arc(0, STEM_TOP, R * 0.095, Math.PI, 0); g.closePath(); g.fill()
      g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke()

      g.restore()
    },
  }
}
