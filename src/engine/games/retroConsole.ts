import { theme } from '../../config/theme'
import { pop, chime } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A retro game console on the lounge rug under the CRT — a chunky grey deck with
// a cartridge poking out of the slot, a power + reset button, and TWO controllers
// trailing curly cords, plus a leaning stack of spare cartridges. Tap POWER to
// boot it (LED flips red→green + a boot chime); tap a controller to mash its
// buttons. Self-contained — it doesn't drive the TV.

const CW = 280, CH = 188
const CONSOLE = '#cfc9bd', CONSOLE_D = '#a7a193'
const CART = [theme.colors.lime, theme.colors.coral, theme.colors.purple, theme.colors.sky]

export function createRetroConsole(cx: number, cy: number): TableGame {
  let powered = false
  let pressA = 0, pressB = 0
  const cA = { x: cx - 128, y: cy + 250, tilt: -0.18 }
  const cB = { x: cx + 132, y: cy + 268, tilt: 0.16 }
  const powerBtn = { x: cx - CW / 2 + 46, y: cy + 44, r: 24 }

  const hitCtrl = (x: number, y: number, c: { x: number; y: number }): boolean =>
    ((x - c.x) / 92) ** 2 + ((y - c.y) / 56) ** 2 <= 1

  return {
    id: 'retroconsole',
    onDown(x, y) {
      if (Math.hypot(x - powerBtn.x, y - powerBtn.y) < powerBtn.r + 8) {
        powered = !powered; pop(); if (powered) { chime(523.25); setTimeout(() => chime(783.99), 90) }
        return true
      }
      if (hitCtrl(x, y, cA)) { pressA = 1; pop(); return true }
      if (hitCtrl(x, y, cB)) { pressB = 1; pop(); return true }
      // capture presses across the whole gadget cluster so the table won't pan
      return x > cx - 240 && x < cx + 250 && y > cy - CH / 2 - 40 && y < cy + 340
    },
    onMove() {}, onUp() {},
    update(dt) { pressA = Math.max(0, pressA - dt * 3.5); pressB = Math.max(0, pressB - dt * 3.5) },
    draw(g: Ctx, t) {
      // curly cords from the deck down to each controller (drawn first, behind)
      drawCord(g, cx - 60, cy + CH / 2 - 12, cA.x, cA.y - 20)
      drawCord(g, cx + 60, cy + CH / 2 - 12, cB.x, cB.y - 20)

      // leaning stack of spare cartridges to the right of the deck
      for (let i = 0; i < 3; i++) {
        const sx = cx + 176 + i * 6, sy = cy + 34 - i * 30
        g.save(); g.translate(sx, sy); g.rotate(-0.08 + i * 0.05)
        g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -46 + 4, -22 + 5, 92, 40, 6); g.fill()
        g.fillStyle = CART[i]; roundRect(g, -46, -22, 92, 40, 6); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
        g.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(g, -34, -14, 68, 15, 3); g.fill()
        g.lineWidth = 1.5; g.stroke()
        g.restore()
      }

      // cartridge sticking up out of the deck's slot
      g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, cx - 52 + 4, cy - CH / 2 - 40 + 4, 104, 56, 7); g.fill()
      g.fillStyle = CART[3]; roundRect(g, cx - 52, cy - CH / 2 - 40, 104, 56, 7); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(g, cx - 40, cy - CH / 2 - 32, 80, 20, 4); g.fill()
      g.lineWidth = 1.5; g.stroke()

      // console deck body
      g.fillStyle = 'rgba(32,26,23,0.24)'; roundRect(g, cx - CW / 2 + 6, cy - CH / 2 + 8, CW, CH, 18); g.fill()
      g.fillStyle = CONSOLE; roundRect(g, cx - CW / 2, cy - CH / 2, CW, CH, 18); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(g, cx - CW / 2 + 14, cy - CH / 2 + 12, CW - 28, 16, 8); g.fill()
      // recessed cartridge slot on top
      g.fillStyle = '#2a2620'; roundRect(g, cx - 66, cy - CH / 2 + 20, 132, 22, 6); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      // side vents
      g.strokeStyle = CONSOLE_D; g.lineWidth = 4; g.lineCap = 'round'
      for (let i = 0; i < 5; i++) { const vx = cx + CW / 2 - 30 - i * 12; g.beginPath(); g.moveTo(vx, cy + 18); g.lineTo(vx, cy + 62); g.stroke() }
      // POWER button (chunky, depresses look via inner ring) + reset
      g.fillStyle = CONSOLE_D; g.beginPath(); g.arc(powerBtn.x, powerBtn.y, powerBtn.r, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = powered ? theme.colors.lime : theme.colors.coral
      g.beginPath(); g.arc(powerBtn.x, powerBtn.y, powerBtn.r - 8, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.stroke()
      g.fillStyle = '#fff'; g.font = `900 12px ${theme.fonts.display}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('⏻', powerBtn.x, powerBtn.y + 1)
      // reset button
      g.fillStyle = CONSOLE_D; roundRect(g, powerBtn.x + 40, powerBtn.y - 12, 40, 22, 6); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      // power LED
      const litOn = powered
      g.fillStyle = litOn ? '#57d06a' : '#5a2a26'
      g.beginPath(); g.arc(cx + CW / 2 - 34, cy - 6, 7, 0, Math.PI * 2); g.fill(); g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      if (litOn) {
        const glow = 0.4 + 0.3 * Math.sin(t / 260)
        g.fillStyle = `rgba(87,208,106,${glow})`; g.beginPath(); g.arc(cx + CW / 2 - 34, cy - 6, 13, 0, Math.PI * 2); g.fill()
      }
      // brand label
      g.fillStyle = INK; g.font = `900 16px "Arial Black", ${theme.fonts.display}, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'
      g.fillText('16·BIT', cx - CW / 2 + 24, cy + 74)

      // the two controllers on top
      drawController(g, cA, pressA, powered, t)
      drawController(g, cB, pressB, powered, t)
    },
  }
}

// a springy coiled cord between deck and controller
function drawCord(g: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  g.lineCap = 'round'; g.lineJoin = 'round'
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 40
  g.strokeStyle = '#3a362f'; g.lineWidth = 8
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke()
  g.strokeStyle = '#5a554b'; g.lineWidth = 3.5
  g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke()
}

function drawController(g: Ctx, c: { x: number; y: number; tilt: number }, press: number, powered: boolean, t: number): void {
  g.save(); g.translate(c.x, c.y); g.rotate(c.tilt)
  // shadow + grey kidney body
  g.fillStyle = 'rgba(32,26,23,0.22)'; roundRect(g, -92 + 5, -50 + 6, 184, 100, 40); g.fill()
  g.fillStyle = '#d7d2c8'; roundRect(g, -92, -50, 184, 100, 40); g.fill()
  g.lineWidth = 4; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(g, -78, -42, 156, 14, 8); g.fill()
  // D-pad (left)
  g.fillStyle = '#3a362f'
  roundRect(g, -64, -12, 44, 16, 4); g.fill()
  roundRect(g, -50, -26, 16, 44, 4); g.fill()
  // face buttons (right) — depress on press
  const bcol = [theme.colors.coral, theme.colors.sky, theme.colors.lime, '#f7c948']
  const bp: [number, number][] = [[44, -14], [64, 6], [24, 6], [44, 26]]
  bp.forEach((p, i) => {
    const d = press > 0 ? (i === (Math.floor(t / 90) % 4) ? press : press * 0.4) : 0
    g.fillStyle = bcol[i]; g.beginPath(); g.arc(p[0], p[1] + d * 2, 10 - d * 2, 0, Math.PI * 2); g.fill()
    g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
  })
  // start / select pills
  g.fillStyle = powered ? '#57d06a' : '#8a857a'
  for (const sx of [-14, 8]) { roundRect(g, sx, -6, 12, 6, 3); g.fill() }
  g.restore()
}
