import { eastWallP } from '../walls'
import { pop } from '../audio'
import { spark } from '../physics'
import { toggleNight, getNight } from '../daynight'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A wall light switch on the EAST wall by the bed. Tap it to flip the whole room
// between day and night (see engine/daynight). It rides the wall plane like the
// whiteboard, foreshortened by the fold. The rocker + a little sun/moon show the
// current state.

interface Vec { x: number; y: number }
const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l } }

const TC = 0.585, SC = 0.3
const PW = 42, PH = 66          // switch-plate half-size

export function createLightSwitch(): TableGame {
  const c = eastWallP(TC, SC)
  const ax = norm({ x: eastWallP(TC + 0.004, SC).x - eastWallP(TC - 0.004, SC).x, y: eastWallP(TC + 0.004, SC).y - eastWallP(TC - 0.004, SC).y })
  const ux = norm({ x: eastWallP(TC, SC + 0.006).x - eastWallP(TC, SC - 0.006).x, y: eastWallP(TC, SC + 0.006).y - eastWallP(TC, SC - 0.006).y })
  const Wc = (lx: number, ly: number): Vec => ({ x: c.x + ax.x * lx - ux.x * ly, y: c.y + ax.y * lx - ux.y * ly })

  const inQuad = (px: number, py: number, q: Vec[]): boolean => {
    let sign = 0
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4]
      const cr = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
      if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false }
    }
    return true
  }

  return {
    id: 'lightswitch',
    onDown(x, y) {
      const q = [Wc(-PW, -PH), Wc(PW, -PH), Wc(PW, PH), Wc(-PW, PH)]
      if (!inQuad(x, y, q)) return false
      toggleNight(); pop(); spark(c.x, c.y, 0.12)
      return true
    },
    onMove() {}, onUp() {},
    update() {},
    draw(g: Ctx) {
      const n = getNight()
      g.save()
      g.transform(ax.x, ax.y, -ux.x, -ux.y, c.x, c.y)
      g.lineJoin = 'round'; g.lineCap = 'round'
      // cast shadow + plate
      g.fillStyle = 'rgba(32,26,23,0.2)'; plate(g, -PW + 8, -PH - 8, PW * 2, PH * 2, 10); g.fill()
      g.fillStyle = '#eef0f2'; plate(g, -PW, -PH, PW * 2, PH * 2, 10); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5; plate(g, -PW + 4, -PH + 4, PW * 2 - 8, PH * 2 - 8, 8); g.stroke()
      // switch well
      g.fillStyle = '#cfd3d7'; plate(g, -15, -40, 30, 80, 7); g.fill()
      g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      // rocker — slides toward the lit end (down = night/on)
      const ry = (n - 0.5) * 40
      g.fillStyle = n > 0.5 ? '#f7c948' : '#f3f4f6'
      plate(g, -12, ry - 20, 24, 40, 6); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(32,26,23,0.18)'; plate(g, -12, ry - 20, 24, 8, 5); g.fill()
      // sun (top) / moon (bottom) markers
      g.fillStyle = 'rgba(32,26,23,0.4)'
      g.beginPath(); g.arc(0, -52, 4, 0, Math.PI * 2); g.fill()   // sun dot
      g.beginPath(); g.arc(0, 52, 5, 0, Math.PI * 2); g.fill()
      g.fillStyle = n > 0.5 ? '#eef0f2' : '#cfd3d7'
      g.beginPath(); g.arc(2, 52, 4, 0, Math.PI * 2); g.fill()    // moon crescent
      g.restore()
    },
  }
}

function plate(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
