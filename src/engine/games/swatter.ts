import { theme } from '../../config/theme'
import { spark } from '../physics'
import { critters } from '../critters'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A flyswatter. Grab it, aim the mesh head (it follows your cursor), and swing
// it FAST across a fly to swat it — a slow drag won't (you have to actually
// whack). Left where you drop it, like a real swatter on the table.

const HEAD = 66            // mesh-head half-size
const HANDLE = 150         // handle length
const SWAT_SPEED = 620     // world units/s the head must be moving to connect
const HIT_R = HEAD * 0.9

export function createSwatter(hx: number, hy: number): TableGame {
  let x = hx, y = hy       // head centre
  let held = false
  let lift = 0
  let px = hx, py = hy     // head last frame → speed
  let speed = 0
  let smack = 0            // flash timer on a successful hit

  const onHead = (mx: number, my: number): boolean => Math.abs(mx - x) < HEAD + 8 && Math.abs(my - y) < HEAD + 8
  const onHandle = (mx: number, my: number): boolean => {
    // handle runs down-right from the head
    const ex = x + HANDLE * 0.7, ey = y + HANDLE * 0.7
    return Math.hypot(mx - (x + ex) / 2, my - (y + ey) / 2) < HANDLE * 0.55
  }

  return {
    id: 'swatter',
    onDown(mx, my) {
      if (!onHead(mx, my) && !onHandle(mx, my)) return false
      held = true; px = mx; py = my
      return true
    },
    onMove(mx, my) { if (held) { x = mx; y = my } },
    onUp() { held = false },
    update(dt, _t) {
      lift += ((held ? 1 : 0) - lift) * Math.min(1, dt * 14)
      smack = Math.max(0, smack - dt)
      speed = dt > 0 ? Math.hypot(x - px, y - py) / dt : 0
      // swing fast enough over a live fly → SMACK
      if (held && speed > SWAT_SPEED) {
        for (const c of critters()) {
          if (!c.alive()) continue
          const p = c.pos()
          if (Math.hypot(p.x - x, p.y - y) < HIT_R) {
            c.swat()
            spark(p.x, p.y, 0.6)
            smack = 0.4
          }
        }
      }
      px = x; py = y
    },
    draw() { /* the swatter floats above the table — see drawAbove */ },
    drawAbove(g: Ctx) {
      const s = 1 + lift * 0.06
      // ground shadow (drops away as it lifts)
      g.fillStyle = `rgba(32,26,23,${0.22 - lift * 0.08})`
      g.save(); g.translate(x + 4 + lift * 10, y + 6 + lift * 14); g.rotate(0.7)
      roundRect(g, -HEAD, -HEAD, HEAD * 2, HEAD * 2, 14); g.fill(); g.restore()

      g.save()
      g.translate(x, y)
      g.rotate(0.5) // canted like a held swatter
      g.scale(s, s)
      // handle (rod + grip), pointing down-right
      g.strokeStyle = '#c0392b'; g.lineWidth = 12; g.lineCap = 'round'
      g.beginPath(); g.moveTo(HEAD * 0.4, HEAD * 0.4); g.lineTo(HANDLE, HANDLE); g.stroke()
      g.strokeStyle = INK; g.lineWidth = 15
      g.beginPath(); g.moveTo(HEAD * 0.4, HEAD * 0.4); g.lineTo(HANDLE, HANDLE); g.stroke()
      g.strokeStyle = '#c0392b'; g.lineWidth = 11
      g.beginPath(); g.moveTo(HEAD * 0.4, HEAD * 0.4); g.lineTo(HANDLE, HANDLE); g.stroke()
      // grip loop at the end
      g.fillStyle = '#c0392b'; g.strokeStyle = INK; g.lineWidth = 3
      g.beginPath(); g.arc(HANDLE, HANDLE, 13, 0, Math.PI * 2); g.fill(); g.stroke()
      g.fillStyle = theme.colors.card; g.beginPath(); g.arc(HANDLE, HANDLE, 5, 0, Math.PI * 2); g.fill(); g.stroke()

      // mesh head — rounded square, holes, ink border
      g.fillStyle = smack > 0 ? '#ffe08a' : '#e9e6df'
      roundRect(g, -HEAD, -HEAD, HEAD * 2, HEAD * 2, 14); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      // hole grid
      g.save()
      roundRect(g, -HEAD, -HEAD, HEAD * 2, HEAD * 2, 14); g.clip()
      g.fillStyle = 'rgba(32,26,23,0.28)'
      const step = HEAD * 2 / 7
      for (let gx = 0; gx <= 7; gx++) for (let gy = 0; gy <= 7; gy++) {
        g.beginPath(); g.arc(-HEAD + gx * step, -HEAD + gy * step, 3.4, 0, Math.PI * 2); g.fill()
      }
      g.restore()
      // inner frame ring
      g.lineWidth = 3; g.strokeStyle = 'rgba(32,26,23,0.45)'
      roundRect(g, -HEAD + 9, -HEAD + 9, HEAD * 2 - 18, HEAD * 2 - 18, 8); g.stroke()
      g.restore()

      // SMACK! callout
      if (smack > 0) {
        g.save()
        g.globalAlpha = Math.min(1, smack / 0.4)
        g.translate(x, y - HEAD - 16)
        g.fillStyle = theme.colors.coral
        g.font = `900 ${Math.round(28 + (0.4 - smack) * 40)}px "Arial Black", ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = INK
        g.strokeText('SMACK!', 0, 0); g.fillText('SMACK!', 0, 0)
        g.restore()
      }
    },
  }
}
