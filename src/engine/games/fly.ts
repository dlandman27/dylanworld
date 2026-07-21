import { world } from '../../config/world'
import { pointer } from '../pointer'
import { isLensing } from './magnifier'
import { registerCritter } from '../critters'
import { spark } from '../physics'
import { clunk } from '../audio'
import { theme } from '../../config/theme'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// what each fly holds up when you look at it through the magnifier
const SIGNS = [
  'made you look', 'buzz off', 'hi there', 'you found me', 'help', 'why so close?',
  'i live here now', 'no swatting', 'not the swatter', 'i regret nothing', "you'll never catch me",
  'hire dylan', 'this table rules', 'free the flies', "i'm just vibing", 'do not press easy',
  'pizza?', "i've seen things", 'top gun', 'catch me if u can',
]

// An ambient housefly. It wanders in jittery bursts, lands on the table, grooms
// its legs, and darts off the instant your cursor gets near. Purely ambient —
// it never captures the pointer, so it never gets in the way. Drawn above
// everything (it's flying over the table).

const FLEE_R = 150
const MARGIN = 240
const CRUISE = 34          // flying height
const BODY = 8

type Mode = 'fly' | 'land' | 'groom' | 'dead'

export function createFly(): TableGame {
  // spawn each fly somewhere random, not all stacked at the centre
  let x = MARGIN + Math.random() * (world.width - MARGIN * 2)
  let y = MARGIN + Math.random() * (world.height - MARGIN * 2)
  let vx = 0, vy = 0, z = CRUISE
  let heading = 0
  let mode: Mode = 'fly'
  let target = pickTarget()
  let timer = 1 + Math.random() * 2
  let wing = 0
  let groom = 0
  let startle = 0
  let deadT = 0
  const sign = SIGNS[(Math.random() * SIGNS.length) | 0]

  // hittable by the flyswatter
  registerCritter({
    pos: () => ({ x, y, z }),
    alive: () => mode !== 'dead',
    swat: () => {
      if (mode === 'dead') return
      mode = 'dead'; deadT = 1.6
      for (let i = 0; i < 6; i++) spark(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 24, 0.4)
      clunk(0.45)
    },
  })

  function pickTarget(): { x: number; y: number } {
    return { x: MARGIN + Math.random() * (world.width - MARGIN * 2), y: MARGIN + Math.random() * (world.height - MARGIN * 2) }
  }
  const takeOff = (awayX = 0, awayY = 0): void => {
    mode = 'fly'
    startle = awayX || awayY ? 1 : 0
    target = awayX || awayY
      ? { x: Math.min(Math.max(x + awayX, MARGIN), world.width - MARGIN), y: Math.min(Math.max(y + awayY, MARGIN), world.height - MARGIN) }
      : pickTarget()
    timer = 1.4 + Math.random() * 2.5
  }

  return {
    id: 'fly',
    onDown() { return false }, // you can't grab a fly; it stays out of the way
    onMove() { /* ambient */ },
    onUp() { /* ambient */ },
    update(dt) {
      if (mode === 'dead') {
        z += (0 - z) * Math.min(1, dt * 12) // drop
        deadT -= dt
        if (deadT <= 0) { // respawn elsewhere, good as new
          x = MARGIN + Math.random() * (world.width - MARGIN * 2)
          y = MARGIN + Math.random() * (world.height - MARGIN * 2)
          z = CRUISE; vx = 0; vy = 0; mode = 'fly'; target = pickTarget(); timer = 1.4 + Math.random() * 2.5
        }
        return
      }
      wing += dt * (mode === 'fly' ? 60 : 7)
      startle = Math.max(0, startle - dt)
      const p = pointer()
      const near = Math.hypot(p.x - x, p.y - y) < FLEE_R
      // startled off any resting state
      if (near && mode !== 'fly') {
        const d = Math.hypot(x - p.x, y - p.y) || 1
        takeOff(((x - p.x) / d) * 500, ((y - p.y) / d) * 500)
      }

      if (mode === 'fly') {
        // dart toward the target with erratic housefly jitter
        const dx = target.x - x, dy = target.y - y
        const d = Math.hypot(dx, dy) || 1
        const urge = near ? 3.4 : 1.2
        vx += (dx / d) * (260 * urge) * dt + (Math.random() - 0.5) * 240 * dt
        vy += (dy / d) * (260 * urge) * dt + (Math.random() - 0.5) * 240 * dt
        const fr = Math.exp(-3.2 * dt)
        vx *= fr; vy *= fr
        x += vx * dt; y += vy * dt
        z += (CRUISE - z) * Math.min(1, dt * 6)
        const sp = Math.hypot(vx, vy)
        if (sp > 6) heading = Math.atan2(vy, vx)
        timer -= dt
        if (d < 60 || timer <= 0) {
          // decide: keep flying, or come in to land (not while the cursor's near)
          if (!near && Math.random() < 0.5) { mode = 'land'; target = { x, y } } else { target = pickTarget(); timer = 1.4 + Math.random() * 2.5 }
        }
      } else if (mode === 'land') {
        vx *= Math.exp(-8 * dt); vy *= Math.exp(-8 * dt)
        x += vx * dt; y += vy * dt
        z += (0 - z) * Math.min(1, dt * 8)
        if (z < 1.5) { mode = 'groom'; z = 0; groom = 0; timer = 1.5 + Math.random() * 3 }
      } else { // groom
        groom += dt
        timer -= dt
        if (timer <= 0) takeOff()
      }
      // keep it on the table
      x = Math.min(Math.max(x, MARGIN * 0.5), world.width - MARGIN * 0.5)
      y = Math.min(Math.max(y, MARGIN * 0.5), world.height - MARGIN * 0.5)
    },
    draw() { /* nothing on the base layer */ },
    drawAbove(g: Ctx) {
      if (mode === 'dead') {
        // splatted on its back — legs up, X eyes, a little green splat
        g.save(); g.translate(x, y)
        g.fillStyle = 'rgba(120,150,70,0.35)'
        g.beginPath(); g.ellipse(0, 2, BODY * 1.4, BODY * 0.9, 0.3, 0, Math.PI * 2); g.fill()
        g.strokeStyle = INK; g.lineWidth = 1; g.lineCap = 'round'
        for (const s of [-1, 1]) for (const ly of [-0.4, 0.2, 0.8]) {
          g.beginPath(); g.moveTo(s * BODY * 0.3, BODY * ly); g.lineTo(s * BODY * 1.1, BODY * (ly - 0.5)); g.stroke()
        }
        g.fillStyle = '#2b2620'
        g.beginPath(); g.ellipse(0, 0, BODY * 0.5, BODY * 0.85, 0, 0, Math.PI * 2); g.fill()
        g.lineWidth = 1.4; g.strokeStyle = '#fbfaf4'
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * BODY * 0.3 - 2, -BODY * 0.6); g.lineTo(s * BODY * 0.3 + 2, -BODY * 0.4); g.moveTo(s * BODY * 0.3 + 2, -BODY * 0.6); g.lineTo(s * BODY * 0.3 - 2, -BODY * 0.4); g.stroke() }
        g.restore()
        return
      }
      // ground shadow (stays on the table, shrinks with height)
      const sh = Math.max(0.35, 1 - z / 90)
      g.fillStyle = `rgba(32,26,23,${0.22 * sh})`
      g.beginPath(); g.ellipse(x, y + 3, BODY * 1.1 * sh, BODY * 0.55 * sh, 0, 0, Math.PI * 2); g.fill()

      g.save()
      g.translate(x, y - z)
      g.rotate(heading + Math.PI / 2) // sprite drawn facing "up", nose = +heading
      const flying = mode === 'fly'

      // wings — fast translucent blur while flying, folded when landed
      const flap = Math.sin(wing)
      g.fillStyle = 'rgba(210,225,235,0.5)'
      g.strokeStyle = 'rgba(32,26,23,0.35)'
      g.lineWidth = 0.8
      for (const s of [-1, 1]) {
        g.save()
        g.translate(s * BODY * 0.3, -BODY * 0.2)
        const spread = flying ? 0.5 + Math.abs(flap) * 0.5 : 0.2
        g.rotate(s * (0.5 + (flying ? flap * 0.5 : 0.9)))
        g.beginPath(); g.ellipse(s * BODY * 0.5, -BODY * 0.4, BODY * 0.85, BODY * 0.4 * spread, 0, 0, Math.PI * 2)
        g.fill(); g.stroke()
        g.restore()
      }

      // legs (six) — the front pair rub together while grooming
      g.strokeStyle = INK; g.lineWidth = 1; g.lineCap = 'round'
      const rub = mode === 'groom' ? Math.sin(groom * 16) * 2 : 0
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(s * BODY * 0.35, -BODY * 0.4); g.lineTo(s * (BODY * 0.9 + rub), -BODY * 0.9); g.stroke() // front
        g.beginPath(); g.moveTo(s * BODY * 0.4, 0); g.lineTo(s * BODY * 1.1, BODY * 0.2); g.stroke()                     // mid
        g.beginPath(); g.moveTo(s * BODY * 0.4, BODY * 0.4); g.lineTo(s * BODY * 1.0, BODY * 1.2); g.stroke()            // rear
      }

      // body: abdomen + thorax + head, charcoal
      g.fillStyle = '#2b2620'; g.strokeStyle = INK; g.lineWidth = 1.2
      g.beginPath(); g.ellipse(0, BODY * 0.45, BODY * 0.55, BODY * 0.95, 0, 0, Math.PI * 2); g.fill(); g.stroke() // abdomen
      // abdomen stripes
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.8
      for (const yy of [0.2, 0.6, 1.0]) { g.beginPath(); g.moveTo(-BODY * 0.4, BODY * yy); g.lineTo(BODY * 0.4, BODY * yy); g.stroke() }
      g.fillStyle = '#3a332b'; g.strokeStyle = INK; g.lineWidth = 1.2
      g.beginPath(); g.ellipse(0, -BODY * 0.3, BODY * 0.5, BODY * 0.55, 0, 0, Math.PI * 2); g.fill(); g.stroke()   // thorax
      g.fillStyle = '#241f1a'
      g.beginPath(); g.arc(0, -BODY * 0.8, BODY * 0.4, 0, Math.PI * 2); g.fill(); g.stroke()                       // head
      // big red compound eyes
      g.fillStyle = '#7a2d24'
      g.beginPath(); g.arc(-BODY * 0.28, -BODY * 0.85, BODY * 0.22, 0, Math.PI * 2); g.arc(BODY * 0.28, -BODY * 0.85, BODY * 0.22, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.5)'
      g.beginPath(); g.arc(-BODY * 0.34, -BODY * 0.92, BODY * 0.07, 0, Math.PI * 2); g.fill()
      g.restore()

      // a tiny protest sign — only legible (and only drawn) under the magnifier
      if (isLensing()) {
        g.save()
        g.translate(x, y - z) // upright, regardless of which way the fly faces
        g.strokeStyle = INK; g.lineWidth = 1.4; g.lineCap = 'round'
        g.beginPath(); g.moveTo(BODY * 0.7, -BODY * 0.2); g.lineTo(BODY * 1.5, -BODY * 2.6); g.stroke() // held stick
        g.font = `700 8px ${theme.fonts.body}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        const w = g.measureText(sign).width + 8
        const bx = BODY * 1.5, by = -BODY * 3.8
        g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, bx - w / 2 + 1, by - 7 + 1.5, w, 15, 3); g.fill()
        g.fillStyle = theme.colors.card; roundRect(g, bx - w / 2, by - 7, w, 15, 3); g.fill()
        g.lineWidth = 1.2; g.strokeStyle = INK; g.stroke()
        g.fillStyle = INK; g.fillText(sign, bx, by + 0.5)
        g.restore()
      }
    },
  }
}
