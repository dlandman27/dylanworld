import { theme } from '../../config/theme'
import { clunk } from '../audio'
import { registerObstacleProvider } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// The Staples "Easy" button. Press the big red dome — it depresses with a
// chunky click, springs back, and a beat later pops a deadpan line. Does
// nothing useful whatsoever, which is the entire point.
//
// TODO: replace the speech-bubble line with the real "That was easy." voice
// clip (add an audio asset + play it on release, alongside/instead of the
// bubble). See TODO.md.

const R = 96          // dome radius
const RED = '#e0231c'
const RED_DK = '#a8140f'
const STEEL = '#cfd3d6'
const STEEL_DK = '#9aa0a5'

const LINES = [
  'That was easy.',
  'That was easy.',
  'That was easy.',
  'Was it though?',
  'Too easy.',
  'Easy.',
]

export function createEasyButton(cx: number, cy: number): TableGame {
  let press = 0        // 0 = up, 1 = fully pressed
  let held = false
  let line = ''
  let lineT = 0        // seconds remaining on the speech bubble
  let lineIdx = 0
  const SELF = Symbol('easy')

  // the button is a bolted-down chunk of plastic — props and cars carom off
  // its solid base
  registerObstacleProvider(() => [
    { x: cx, y: cy + 10, half: R * 0.98, owner: SELF },
  ])

  return {
    id: 'easy-button',
    onDown(x, y) {
      if (Math.hypot(x - cx, y - cy) > R) return false
      held = true
      clunk(0.5) // the satisfying mechanical thunk
      return true
    },
    onMove() { /* it's a button, you just press it */ },
    onUp() {
      if (!held) return
      held = false
      line = LINES[lineIdx % LINES.length]
      lineIdx++
      lineT = 1.8
    },
    update(dt) {
      press += ((held ? 1 : 0) - press) * Math.min(1, dt * 22) // snappy
      lineT = Math.max(0, lineT - dt)
    },
    draw(g: Ctx) {
      // top-down, flat fills + bold ink outlines + hard offset shadow, like
      // every other piece on the table (coins, spinner, tops)
      const BASE = R * 1.26
      // hard offset shadow under the base
      g.fillStyle = 'rgba(32,26,23,0.22)'
      g.beginPath(); g.arc(cx + 5, cy + 8, BASE, 0, Math.PI * 2); g.fill()
      // ---- silver base ring ----
      g.fillStyle = STEEL
      g.beginPath(); g.arc(cx, cy, BASE, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      // darker inner well the dome sits in
      g.fillStyle = STEEL_DK
      g.beginPath(); g.arc(cx, cy, R + 6, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      // little rim highlight
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2
      g.beginPath(); g.arc(cx, cy, BASE - 3, Math.PI * 1.05, Math.PI * 1.55); g.stroke()
      // wordmark on the ring, played straight
      g.fillStyle = '#5a6066'
      g.font = `800 13px ${theme.fonts.body}, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('EASY', cx, cy + BASE - 12)

      // ---- red button top (shrinks a hair when pressed = "sunk in") ----
      const rr = R * (1 - press * 0.06)
      // ring of dark red showing under the top when pressed
      g.fillStyle = RED_DK
      g.beginPath(); g.arc(cx, cy, R + 1, 0, Math.PI * 2); g.fill()
      g.fillStyle = RED
      g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      // flat highlight crescent (not a gradient)
      g.save()
      g.beginPath(); g.arc(cx, cy, rr - 2, 0, Math.PI * 2); g.clip()
      g.fillStyle = 'rgba(255,255,255,0.28)'
      g.beginPath(); g.ellipse(cx - rr * 0.28, cy - rr * 0.34, rr * 0.72, rr * 0.5, -0.5, 0, Math.PI * 2); g.fill()
      g.restore()
      // the word "easy" — lowercase italic, white with ink outline
      g.save()
      g.fillStyle = '#fbfaf4'
      g.strokeStyle = INK
      g.font = `italic 900 ${Math.round(rr * 0.64)}px "Arial Black", ${theme.fonts.display}, Arial, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.lineJoin = 'round'
      g.lineWidth = Math.max(3, rr * 0.07)
      g.strokeText('easy', cx, cy + 2)
      g.fillText('easy', cx, cy + 2)
      g.restore()

      // ---- speech bubble ----
      if (lineT > 0) {
        const a = Math.min(1, lineT / 0.35) * Math.min(1, (1.8 - lineT) / 0.15 + 0.2)
        g.save()
        g.globalAlpha = Math.max(0, Math.min(1, a))
        g.font = `800 26px ${theme.fonts.display}, sans-serif`
        const w = g.measureText(line).width + 40
        const bx = cx - w / 2, by = cy - R - 92, bh = 52
        g.fillStyle = 'rgba(32,26,23,0.18)'
        roundRect(g, bx + 4, by + 6, w, bh, 14); g.fill()
        g.fillStyle = theme.colors.card
        roundRect(g, bx, by, w, bh, 14); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        // tail
        g.fillStyle = theme.colors.card
        g.beginPath(); g.moveTo(cx - 12, by + bh - 2); g.lineTo(cx + 2, by + bh + 20); g.lineTo(cx + 14, by + bh - 2); g.closePath()
        g.fill()
        g.beginPath(); g.moveTo(cx - 12, by + bh - 1); g.lineTo(cx + 2, by + bh + 20); g.stroke()
        g.beginPath(); g.moveTo(cx + 14, by + bh - 1); g.lineTo(cx + 2, by + bh + 20); g.stroke()
        g.fillStyle = INK
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(line, cx, by + bh / 2)
        g.restore()
      }
    },
  }
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
