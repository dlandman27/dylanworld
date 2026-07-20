import type { TableGame } from './shared'
import { INK, TILE, roundRect, pips } from './shared'

// Three dice: poke them and they tumble, skitter across the felt patch, and
// settle on new faces.

interface Die { x: number; y: number; vx: number; vy: number; rot: number; vr: number; face: number; tumble: number; flick: number }

export function createDice(cx: number, cy: number): TableGame {
  const dice: Die[] = [
    { x: cx - 42, y: cy + 8, vx: 0, vy: 0, rot: -0.2, vr: 0, face: 5, tumble: 0, flick: 0 },
    { x: cx + 30, y: cy + 22, vx: 0, vy: 0, rot: 0.25, vr: 0, face: 2, tumble: 0, flick: 0 },
    { x: cx + 4, y: cy - 30, vx: 0, vy: 0, rot: 0.05, vr: 0, face: 6, tumble: 0, flick: 0 },
  ]
  const S = 44

  return {
    id: 'dice',
    onDown(x, y) {
      let hit = false
      for (const d of dice) if (Math.hypot(d.x - x, d.y - y) < S * 1.2) hit = true
      if (!hit) return false
      // roll them all
      for (const d of dice) {
        const a = Math.random() * Math.PI * 2
        const sp = 260 + Math.random() * 320
        d.vx = Math.cos(a) * sp
        d.vy = Math.sin(a) * sp
        d.vr = (Math.random() - 0.5) * 18
        d.tumble = 0.7 + Math.random() * 0.5
        d.flick = 0
      }
      return true
    },
    onMove() { /* dice aren't dragged */ },
    onUp() { /* roll fires on down */ },
    update(dt) {
      for (const d of dice) {
        if (d.tumble > 0) {
          d.tumble -= dt
          d.flick -= dt
          if (d.flick <= 0) { d.face = 1 + ((Math.random() * 6) | 0); d.flick = 0.07 }
        }
        const f = Math.exp(-2.2 * dt)
        d.vx *= f; d.vy *= f; d.vr *= f
        d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt
        // keep the pack loosely near home so they don't wander off forever
        const dx = d.x - cx, dy = d.y - cy
        const dist = Math.hypot(dx, dy)
        if (dist > 260) { d.vx -= (dx / dist) * 500 * dt; d.vy -= (dy / dist) * 500 * dt }
      }
      // die-die separation
      for (let i = 0; i < dice.length; i++) for (let j = i + 1; j < dice.length; j++) {
        const a = dice[i], b = dice[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dd = Math.hypot(dx, dy)
        if (dd === 0 || dd >= S) continue
        const nx = dx / dd, ny = dy / dd, push = (S - dd) / 2
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
      }
    },
    draw(g) {
      for (const d of dice) {
        g.save()
        g.translate(d.x, d.y)
        g.rotate(d.rot)
        const wob = d.tumble > 0 ? 1 + Math.sin(d.tumble * 40) * 0.08 : 1
        g.scale(wob, wob)
        g.fillStyle = 'rgba(32,26,23,0.22)'
        roundRect(g, -S / 2 + 4, -S / 2 + 6, S, S, 9); g.fill()
        g.fillStyle = TILE
        roundRect(g, -S / 2, -S / 2, S, S, 9); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        pips(g, 0, 0, S, d.face)
        g.restore()
      }
    },
  }
}
