import { theme } from '../../config/theme'
import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// A carnival prize wheel you flick. The whole wheel spins under a fixed flapper
// at the top that TICKS past a peg at every wedge boundary (click + a little
// deflection), a bulb-studded rim, star pips, and a gold hub. When it coasts to
// a stop the winning wedge pulses.

const R = 132
const N = 8
const WEDGE = (Math.PI * 2) / N
const COLS = [
  theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.orange,
  theme.colors.purple, theme.colors.pink, theme.colors.teal, '#f7c948',
]

export function createSpinner(cx: number, cy: number): TableGame {
  let ang = -0.4
  let angVel = 0
  let grab: { lastA: number; moved: boolean } | null = null
  let flapper = 0        // pointer deflection, eases back to 0
  let lastIdx = 0        // which peg was last under the pointer
  let settle = 0         // win-pulse timer after it stops

  const angleAt = (x: number, y: number): number => Math.atan2(y - cy, x - cx)
  const wrap = (a: number): number => {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }
  const pegIdx = (): number => Math.floor((ang + Math.PI / 2) / WEDGE)

  return {
    id: 'spinner',
    onDown(x, y) {
      if (Math.hypot(x - cx, y - cy) > R + 24) return false
      grab = { lastA: angleAt(x, y), moved: false }
      angVel = 0
      settle = 0
      return true
    },
    onMove(x, y) {
      if (!grab) return
      const a = angleAt(x, y)
      const d = wrap(a - grab.lastA)
      ang += d
      angVel = angVel * 0.5 + d * 34
      grab.lastA = a
      if (Math.abs(d) > 0.01) grab.moved = true
    },
    onUp() {
      // a plain click (no drag) just kicks the wheel a good random spin
      if (grab && !grab.moved) {
        angVel = (18 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1)
      }
      grab = null
      lastIdx = pegIdx()
    },
    update(dt, t) {
      flapper += (0 - flapper) * Math.min(1, dt * 12)
      void t
      if (!grab) {
        ang += angVel * dt
        angVel *= Math.exp(-0.62 * dt)
        if (Math.abs(angVel) < 0.06 && angVel !== 0) {
          angVel = 0
          settle = 1 // just stopped — pulse the winner
        }
      }
      if (settle > 0) settle = Math.max(0, settle - dt * 1.4)
      // peg ticks: fire whenever a wedge boundary crosses the top pointer
      const idx = pegIdx()
      if (idx !== lastIdx) {
        const steps = Math.abs(idx - lastIdx)
        lastIdx = idx
        const sp = Math.abs(angVel)
        if (sp > 0.4 || grab) {
          flapper = Math.sign(angVel || 1) * Math.min(0.5, 0.15 + sp * 0.02)
          clunk(Math.min(0.5, 0.08 + sp * 0.015))
          angVel *= 1 - Math.min(0.12, 0.02 * steps) // pegs bleed a little speed
        }
      }
    },
    draw(g: Ctx) {
      g.save()
      g.translate(cx, cy)
      // hard offset shadow
      g.fillStyle = 'rgba(32,26,23,0.22)'
      g.beginPath(); g.arc(6, 9, R + 14, 0, Math.PI * 2); g.fill()

      // ---- decorative rim with bulbs ----
      g.fillStyle = '#7a4e28'
      g.beginPath(); g.arc(0, 0, R + 14, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      for (let i = 0; i < N * 2; i++) {
        const a = (i / (N * 2)) * Math.PI * 2 + ang * 0.15
        const bx = Math.cos(a) * (R + 7), by = Math.sin(a) * (R + 7)
        g.fillStyle = i % 2 ? '#f7c948' : '#fbfaf4'
        g.beginPath(); g.arc(bx, by, 4.5, 0, Math.PI * 2); g.fill()
        g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke()
      }

      // ---- spinning wheel ----
      g.save()
      g.rotate(ang)
      const winIdx = ((-lastIdx % N) + N) % N
      for (let i = 0; i < N; i++) {
        g.beginPath(); g.moveTo(0, 0)
        g.arc(0, 0, R, i * WEDGE, (i + 1) * WEDGE)
        g.closePath()
        g.fillStyle = COLS[i]
        g.fill()
        // winning wedge brightens on settle
        if (settle > 0 && i === winIdx) {
          g.fillStyle = `rgba(255,255,255,${0.4 * settle})`
          g.fill()
        }
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        // white star pip mid-wedge
        g.save()
        g.rotate(i * WEDGE + WEDGE / 2)
        g.translate(R * 0.62, 0)
        g.rotate(Math.PI / 2)
        g.fillStyle = 'rgba(255,255,255,0.9)'
        g.beginPath()
        for (let k = 0; k < 10; k++) {
          const rr = k % 2 === 0 ? 13 : 5.5
          const aa = -Math.PI / 2 + (Math.PI * k) / 5
          k === 0 ? g.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr)
        }
        g.closePath(); g.fill()
        g.restore()
      }
      g.lineWidth = 4; g.strokeStyle = INK
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke()
      // pegs at each boundary
      for (let i = 0; i < N; i++) {
        const a = i * WEDGE
        const px = Math.cos(a) * (R - 3), py = Math.sin(a) * (R - 3)
        g.fillStyle = '#e9e6df'
        g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      }
      g.restore()

      // ---- gold hub cap ----
      g.fillStyle = '#f7c948'
      g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#e0a92a'
      g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2; g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.6)'
      g.beginPath(); g.ellipse(-6, -7, 5, 3, -0.6, 0, Math.PI * 2); g.fill()

      // ---- fixed flapper/pointer at the top ----
      g.save()
      g.translate(0, -R - 12)
      g.rotate(flapper)
      g.fillStyle = '#3a3630'
      g.beginPath()
      g.moveTo(-9, -6); g.lineTo(9, -6); g.lineTo(3, 24); g.lineTo(-3, 24); g.closePath()
      g.fill()
      g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      // pivot knob
      g.fillStyle = '#f7c948'
      g.beginPath(); g.arc(0, -6, 7, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2; g.stroke()
      g.restore()

      g.restore()
    },
  }
}
