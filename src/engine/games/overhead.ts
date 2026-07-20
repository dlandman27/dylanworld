import type { TableGame } from './shared'
import { world } from '../../config/world'

// Ambient life overhead: flat cartoon cloud shadows drifting slowly across the
// table — crisp scalloped silhouettes at one uniform alpha, matching the hard
// offset shadows everywhere else on the table (and immune to gradient banding).
// Pure atmosphere — never captures the pointer. Renders in drawAbove so the
// shade falls on top of every game, prop, and the title blocks.

const WRAP = 700   // off-world margin before a cloud wraps around
const ALPHA = 0.045 // uniform shade darkness — barely-there, felt more than seen

interface Lobe { dx: number; dy: number; r: number; wob: number }
interface Cloud { x: number; y: number; vx: number; vy: number; lobes: Lobe[] }

function makeCloud(spawnLeft: boolean): Cloud {
  // classic cartoon cloud: flat bottom, dome of bumps on top. Every circle's
  // bottom sits on one shared baseline and neighbours overlap heavily, so the
  // silhouette can never grow a stray appendage — it's a cloud from any angle.
  const scale = 0.8 + Math.random() * 0.9
  const n = 5 + ((Math.random() * 3) | 0)
  const halfW = (150 + Math.random() * 110) * scale
  const rMax = (95 + Math.random() * 30) * scale
  const lobes: Lobe[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5 // -0.5 .. 0.5 across the cloud
    // dome profile: tall in the middle, shorter at the ends, mild jitter
    const r = rMax * (0.55 + 0.45 * Math.cos(t * Math.PI)) * (0.92 + Math.random() * 0.16)
    lobes.push({
      dx: t * 2 * (halfW - rMax * 0.5) + (Math.random() - 0.5) * 14 * scale,
      dy: -r, // bottom of every circle rests on the y=0 baseline
      r,
      wob: Math.random() * Math.PI * 2,
    })
  }
  return {
    x: spawnLeft ? -WRAP : Math.random() * world.width,
    y: 200 + Math.random() * (world.height - 400),
    vx: 22 + Math.random() * 24, // gentle west wind, always eastward
    vy: (Math.random() - 0.5) * 8,
    lobes,
  }
}

export function createOverhead(): TableGame {
  const clouds: Cloud[] = []
  for (let i = 0; i < 4; i++) clouds.push(makeCloud(false))

  return {
    id: 'overhead',
    onDown() { return false }, // shade is intangible — never block pan/grab
    onMove() {},
    onUp() {},
    update(dt) {
      for (const c of clouds) {
        c.x += c.vx * dt
        c.y += c.vy * dt
        if (c.x > world.width + WRAP) Object.assign(c, makeCloud(true))
      }
    },
    draw() { /* everything renders overhead, in drawAbove */ },
    drawAbove(g, t) {
      const s = t / 1000
      // one path + one fill per cloud: overlapping lobes merge into a uniform
      // flat silhouette (nonzero winding), so the shade never double-darkens
      g.fillStyle = `rgba(32,26,23,${ALPHA})`
      for (const c of clouds) {
        g.beginPath()
        for (const l of c.lobes) {
          const r = l.r * (1 + Math.sin(s * 0.3 + l.wob) * 0.05)
          g.moveTo(c.x + l.dx + r, c.y + l.dy)
          g.arc(c.x + l.dx, c.y + l.dy, r, 0, Math.PI * 2)
        }
        g.fill()
      }
    },
  }
}
