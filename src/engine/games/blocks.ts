import { theme } from '../../config/theme'
import { world } from '../../config/world'
import { spark, registerObstacleProvider } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// The hero title: big wooden ABC blocks with real HEIGHT. Every block has a z
// (bottom height above the table) — on load they rain down and build the title,
// you can lift one and drop it ON another (it stacks until knocked off), and
// landings squash, spark and clunk. Grounded blocks slide home after a rest.

interface Block {
  char: string
  color: string
  x: number; y: number
  vx: number; vy: number
  z: number; vz: number
  rot: number
  /** the slightly-askew angle this block naturally rests at */
  tilt: number
  home: { x: number; y: number }
  dropDelay: number
  squash: number
  grabbed: boolean
  rest: number
}

const SZ = 106        // block face size
const R = SZ * 0.62   // xy collide radius
const H = 42          // physical block height (stack step, z units)
const K = 0.75        // z → screen raise factor
const G = 4400        // gravity, z units/s² — wood drops, it doesn't float
const HOLD_Z = 95     // carry height while grabbed
const DEPTH = 13      // drawn side depth
const RETURN_DELAY = 1.4
// wide palette, assigned sequentially so neighbouring blocks never match
const COLORS = [
  theme.colors.coral, theme.colors.sky, '#f7c948', theme.colors.purple,
  theme.colors.lime, theme.colors.orange, '#5a6bb0', theme.colors.pink,
  theme.colors.teal, '#c0392b',
]

export function createBlocks(): TableGame {
  const blocks: Block[] = []
  const words = world.name.split(' ')
  const gap = 126
  const rowH = 140
  const firstRowY = world.spawn.y - 560
  let idx = 0
  words.forEach((word, wi) => {
    const rowY = firstRowY + wi * rowH
    const totalW = (word.length - 1) * gap
    ;[...word].forEach((char, i) => {
      // hand-placed, not machine-gridded: every home is a touch off the line
      const x = world.spawn.x - totalW / 2 + i * gap + (Math.random() - 0.5) * 18
      const y = rowY + (Math.random() - 0.5) * 16
      blocks.push({
        char, color: COLORS[idx % COLORS.length],
        x, y, vx: 0, vy: 0,
        z: 850 + Math.random() * 120, vz: 0,        // start high in the air…
        rot: (Math.random() - 0.5) * 0.5,
        tilt: (Math.random() - 0.5) * 0.14,
        home: { x, y },
        dropDelay: 0.25 + idx * 0.09,               // …and rain down in sequence
        squash: 0, grabbed: false, rest: 0,
      })
      idx++
    })
  })

  let contacts = new Set<number>() // block pairs touching last frame (spark debounce)
  let held: Block | null = null
  let target = { x: 0, y: 0 }

  // marbles (and other props) bounce off grounded blocks; a lifted or flying
  // block lets them roll underneath. Hits nudge the block a little.
  registerObstacleProvider(() =>
    blocks
      .filter(b => b.z < 20 && !b.grabbed && b.dropDelay <= 0)
      .map(b => ({
        x: b.x, y: b.y, half: SZ / 2,
        onHit: (ix: number, iy: number) => {
          b.vx += ix * 0.12
          b.vy += iy * 0.12
          b.rest = 0
        },
      })),
  )

  /**
   * Highest SOLID surface under this block (0 = the table). Solid needs most of
   * the block over the one below; edge overlaps don't count — see glanceOff.
   */
  const landingHeight = (b: Block): number => {
    let top = 0
    for (const o of blocks) {
      if (o === b || o.grabbed) continue
      if (Math.abs(o.x - b.x) < SZ * 0.55 && Math.abs(o.y - b.y) < SZ * 0.55) {
        const t = o.z + H
        if (t <= b.z + 4 && t > top) top = t
      }
    }
    return top
  }

  /** A falling block clipping another block's EDGE skids off it sideways. */
  const glanceOff = (b: Block, dt: number): void => {
    for (const o of blocks) {
      if (o === b || o.grabbed) continue
      const dx = b.x - o.x, dy = b.y - o.y
      const ax = Math.abs(dx), ay = Math.abs(dy)
      const nearTop = Math.abs(b.z - (o.z + H)) < 14
      const onEdge = (ax > SZ * 0.55 || ay > SZ * 0.55) && ax < SZ * 0.95 && ay < SZ * 0.95
      if (nearTop && onEdge) {
        const d = Math.hypot(dx, dy) || 1
        b.vx += (dx / d) * 900 * dt
        b.vy += (dy / d) * 900 * dt
        b.rot += (dx > 0 ? 1 : -1) * dt * 2
      }
    }
  }

  return {
    id: 'blocks',
    onDown(x, y) {
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i]
        const drawY = b.y - b.z * K
        if (Math.abs(x - b.x) < SZ / 2 + 8 && Math.abs(y - drawY) < SZ / 2 + 8) {
          blocks.splice(i, 1)
          blocks.push(b)
          held = b
          b.grabbed = true
          b.dropDelay = 0
          target = { x, y }
          return true
        }
      }
      return false
    },
    onMove(x, y) { if (held) target = { x, y } },
    onUp() {
      if (held) held.grabbed = false // gravity takes it from here
      held = null
    },
    update(dt) {
      for (const b of blocks) {
        // the opening rain: hold position in the sky until its cue
        if (b.dropDelay > 0) { b.dropDelay -= dt; continue }

        if (b.grabbed) {
          b.vx = (target.x - b.x) * 14
          b.vy = (target.y - b.y + b.z * K) * 14 // cursor holds the FACE, not the feet
          b.z += (HOLD_Z - b.z) * Math.min(1, dt * 10)
          b.vz = 0
          b.rest = 0
        } else {
          // fall
          b.vz -= G * dt
          b.z += b.vz * dt
          if (b.z > 0.5) glanceOff(b, dt) // edge hits skid off sideways
          const floor = landingHeight(b)
          if (b.z <= floor) {
            const impact = -b.vz
            b.z = floor
            // wood THUDS: a landing kills most of the slide
            b.vx *= 0.3
            b.vy *= 0.3
            if (impact > 320) {
              b.vz = impact * 0.18         // small bounce
              b.squash = 1
              spark(b.x, b.y + SZ * 0.4, Math.min(1, impact / 1600))
            } else {
              b.vz = 0
            }
            b.rot = b.tilt + (b.rot - b.tilt) * 0.4 // settle toward its natural tilt
          }
        }

        // xy motion: airborne blocks coast, grounded wood BITES
        const f = Math.exp(-(b.z > 0.5 && !b.grabbed ? 2 : 24) * dt)
        b.vx *= f; b.vy *= f
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.x = Math.min(Math.max(b.x, R), world.width - R)
        b.y = Math.min(Math.max(b.y, R), world.height - R)
        b.squash = Math.max(0, b.squash - dt * 6)

        // homing: only blocks resting ON THE TABLE tidy themselves back — a
        // block sitting on a stack stays stacked until it's knocked off
        const speed = Math.hypot(b.vx, b.vy)
        b.rest = speed < 8 && !b.grabbed ? b.rest + dt : 0
        if (!b.grabbed && b.z === 0 && b.rest > RETURN_DELAY) {
          const hx = b.home.x - b.x, hy = b.home.y - b.y
          const hd = Math.hypot(hx, hy)
          if (hd < 6 && speed < 60) {
            if (b.x !== b.home.x || b.y !== b.home.y) spark(b.home.x, b.home.y, 0.12)
            b.x = b.home.x; b.y = b.home.y
            b.vx = 0; b.vy = 0; b.rot = b.tilt
          } else if (hd >= 6) {
            b.vx += hx * 9 * dt
            b.vy += hy * 9 * dt
            b.rot += (b.tilt - b.rot) * Math.min(1, dt * 8)
          }
        }
      }

      // xy knocks — only between blocks in the SAME layer (their heights overlap)
      const nowContacts = new Set<number>()
      for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i], b = blocks[j]
        if (a.grabbed || b.grabbed) continue
        if (Math.abs(a.z - b.z) >= H * 0.8) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d === 0 || d >= R * 1.7) continue
        const nx = dx / d, ny = dy / d, push = (R * 1.7 - d) / 2
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rel < 0) {
          a.vx += nx * rel * 0.7; a.vy += ny * rel * 0.7
          b.vx -= nx * rel * 0.7; b.vy -= ny * rel * 0.7
          a.rot += rel * 0.0004; b.rot -= rel * 0.0004
          // spark only on a FRESH hard hit — not every frame two blocks rest
          // against each other (which was firing the impact endlessly)
          const key = i * 1000 + j
          nowContacts.add(key)
          if (-rel > 130 && !contacts.has(key)) spark(a.x + nx * R, a.y + ny * R, Math.min(1, -rel / 900))
        }
      }
      contacts = nowContacts
    },
    draw(g: Ctx) {
      // paint low-to-high so stacked/held blocks cover the ones beneath
      const order = [...blocks].sort((a, b) => a.z - b.z || a.y - b.y)
      for (const b of order) {
        const col = b.color
        const raise = b.z * K
        const sqx = 1 + b.squash * 0.12
        const sqy = 1 - b.squash * 0.16
        // ground shadow: stays on the table, shrinks + fades as the block rises
        const shScale = Math.max(0.55, 1 - b.z / 900)
        const shAlpha = Math.max(0.08, 0.3 - b.z / 1400)
        g.fillStyle = `rgba(32,26,23,${shAlpha})`
        roundRect(g, b.x - (SZ / 2) * shScale + 4, b.y - (SZ / 2) * shScale + 7, SZ * shScale, SZ * shScale, 12)
        g.fill()

        g.save()
        g.translate(b.x, b.y - raise)
        g.rotate(b.rot)
        g.scale(sqx, sqy)
        // side depth (bottom-right) — the 3D read
        g.fillStyle = '#b5915a'
        roundRect(g, -SZ / 2 + DEPTH * 0.45, -SZ / 2 + DEPTH, SZ, SZ, 12); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        // wood face
        g.fillStyle = '#ecd9ae'
        roundRect(g, -SZ / 2, -SZ / 2, SZ, SZ, 12); g.fill()
        g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
        // bevel: light catches the top-left edge, base sits in shade
        g.save()
        roundRect(g, -SZ / 2, -SZ / 2, SZ, SZ, 12); g.clip()
        g.strokeStyle = 'rgba(255,255,255,0.55)'
        g.lineWidth = 5
        g.beginPath()
        g.moveTo(-SZ / 2 + 6, SZ / 2 - 10)
        g.lineTo(-SZ / 2 + 6, -SZ / 2 + 6)
        g.lineTo(SZ / 2 - 10, -SZ / 2 + 6)
        g.stroke()
        g.fillStyle = 'rgba(32,26,23,0.12)'
        g.fillRect(-SZ / 2, SZ / 2 - 9, SZ, 9)
        g.fillRect(SZ / 2 - 9, -SZ / 2, 9, SZ)
        g.restore()
        // classic colored inner frame
        g.lineWidth = SZ * 0.075
        g.strokeStyle = col
        roundRect(g, -SZ / 2 + SZ * 0.12, -SZ / 2 + SZ * 0.12, SZ * 0.76, SZ * 0.76, 6); g.stroke()
        // big letter with ink outline
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
        g.font = `900 ${Math.round(SZ * 0.52)}px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
        g.lineWidth = SZ * 0.055
        g.strokeStyle = INK
        g.strokeText(b.char, 0, SZ * 0.03)
        g.fillStyle = col
        g.fillText(b.char, 0, SZ * 0.03)
        g.restore()
      }
    },
  }
}
