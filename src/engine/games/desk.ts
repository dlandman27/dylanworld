import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// The desk against the south wall: a wooden slab with an open laptop (press it —
// it's the resume), a steaming mug of coffee, a paper stack and a pencil, with a
// chair pulled up slightly askew. Mostly scenery; the laptop is the doorway.

const DESK_W = 1150
const DESK_H = 430
const WOOD = '#b5915a'
const WOOD_D = '#9a7747'

export function createDesk(cx: number, cy: number): TableGame {
  const dx0 = cx - DESK_W / 2, dy0 = cy - DESK_H / 2
  const lap = { x: cx - 210, y: cy + 10, rot: -0.05 }   // laptop centre
  const mug = { x: cx + 230, y: cy - 90 }
  const chair = { x: cx + 300, y: cy - DESK_H / 2 - 190, rot: 0.16 }
  let lapPress = 0
  let chairWiggle = 0

  registerObstacleProvider(() => [
    { x: cx - 290, y: cy, half: DESK_H / 2 },
    { x: cx + 290, y: cy, half: DESK_H / 2 },
    { x: chair.x, y: chair.y, half: 130 },
  ])

  const onLaptop = (x: number, y: number): boolean =>
    Math.abs(x - lap.x) < 190 && Math.abs(y - lap.y) < 150
  const onDesk = (x: number, y: number): boolean =>
    x > dx0 - 8 && x < dx0 + DESK_W + 8 && y > dy0 - 8 && y < dy0 + DESK_H + 8
  const onChair = (x: number, y: number): boolean =>
    Math.abs(x - chair.x) < 150 && Math.abs(y - chair.y) < 150

  return {
    id: 'desk',
    onDown(x, y) {
      if (onLaptop(x, y)) {
        lapPress = 1
        spark(lap.x, lap.y, 0.1)
        window.open('/resume.html', '_blank')
        return true
      }
      if (onChair(x, y)) { chairWiggle = 1; return true }
      return onDesk(x, y)   // capture desk presses so the table doesn't pan
    },
    onMove() {},
    onUp() {},
    update(dt) {
      lapPress = Math.max(0, lapPress - dt * 6)
      chairWiggle = Math.max(0, chairWiggle - dt * 3)
    },
    draw(g, t) {
      // ---- chair first (the desk's shadow falls over its top edge) ----
      g.save()
      g.translate(chair.x, chair.y)
      g.rotate(chair.rot + Math.sin(t / 60) * chairWiggle * 0.06)
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, -125 + 6, -125 + 9, 250, 250, 34); g.fill()
      g.fillStyle = WOOD
      roundRect(g, -125, -125, 250, 250, 34); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = '#d3a163'   // seat cushion
      roundRect(g, -100, -100, 200, 200, 26); g.fill()
      g.lineWidth = 2.5; g.stroke()
      // backrest: a wooden band on the room side (away from the desk)
      g.fillStyle = WOOD_D
      roundRect(g, -118, -152, 236, 44, 16); g.fill()
      g.lineWidth = 3; g.stroke()
      for (const sx of [-70, 0, 70]) {   // spindles peeking through
        g.beginPath(); g.arc(sx, -130, 7, 0, Math.PI * 2)
        g.fillStyle = WOOD; g.fill(); g.lineWidth = 2; g.stroke()
      }
      g.restore()

      // ---- desk slab ----
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, dx0 + 8, dy0 + 12, DESK_W, DESK_H, 22); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, dx0, dy0, DESK_W, DESK_H, 22); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = WOOD
      roundRect(g, dx0 + 18, dy0 + 18, DESK_W - 36, DESK_H - 36, 14); g.fill()
      g.lineWidth = 3; g.stroke()
      // plank seams along the top
      g.strokeStyle = 'rgba(74,48,22,0.35)'; g.lineWidth = 2
      for (const fy of [0.38, 0.66]) {
        g.beginPath(); g.moveTo(dx0 + 22, dy0 + DESK_H * fy); g.lineTo(dx0 + DESK_W - 22, dy0 + DESK_H * fy); g.stroke()
      }

      // ---- paper stack + pencil ----
      g.save()
      g.translate(cx + 20, cy + 60)
      for (let i = 0; i < 3; i++) {
        g.save()
        g.rotate((i - 1) * 0.07)
        g.fillStyle = 'rgba(32,26,23,0.12)'
        roundRect(g, -95 + 3, -70 + 4, 190, 140, 6); g.fill()
        g.fillStyle = i === 2 ? '#fefaf0' : '#f0e2be'
        roundRect(g, -95, -70, 190, 140, 6); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        g.restore()
      }
      g.strokeStyle = 'rgba(32,26,23,0.4)'; g.lineWidth = 2.5
      for (let i = 0; i < 4; i++) {   // scribbled lines on the top sheet
        g.beginPath(); g.moveTo(-70, -40 + i * 26); g.lineTo(-70 + 130 - i * 18, -40 + i * 26); g.stroke()
      }
      g.save()   // pencil beside the stack
      g.translate(130, 26); g.rotate(0.5)
      g.fillStyle = '#f7c948'; g.fillRect(-8, -80, 16, 140)
      g.lineWidth = 2.5; g.strokeStyle = INK; g.strokeRect(-8, -80, 16, 140)
      g.fillStyle = '#ecd9ae'
      g.beginPath(); g.moveTo(-8, 60); g.lineTo(8, 60); g.lineTo(0, 92); g.closePath(); g.fill(); g.stroke()
      g.fillStyle = INK
      g.beginPath(); g.moveTo(-3, 80); g.lineTo(3, 80); g.lineTo(0, 92); g.closePath(); g.fill()
      g.fillStyle = '#f0563e'   // eraser
      g.fillRect(-8, -96, 16, 16); g.strokeRect(-8, -96, 16, 16)
      g.restore()
      g.restore()

      // ---- the laptop (press = resume) ----
      const lp = 1 - lapPress * 0.08
      g.save()
      g.translate(lap.x, lap.y)
      g.rotate(lap.rot)
      g.scale(lp, lp)
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, -170 + 5, -140 + 8, 340, 280, 16); g.fill()
      // screen half (toward the room) — dark glass with a tiny doc window
      g.fillStyle = '#c9ced3'
      roundRect(g, -170, -140, 340, 132, 12); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#3a4048'
      roundRect(g, -156, -128, 312, 108, 8); g.fill()
      g.lineWidth = 2; g.stroke()
      g.fillStyle = '#fefaf0'   // the "resume" doc glowing on screen
      roundRect(g, -44, -122, 88, 96, 5); g.fill()
      g.strokeStyle = 'rgba(32,26,23,0.5)'; g.lineWidth = 2
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-30, -104 + i * 20); g.lineTo(24 - i * 6, -104 + i * 20); g.stroke() }
      // keyboard half
      g.fillStyle = '#c9ced3'
      roundRect(g, -170, 0, 340, 140, 12); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#e3e6e9'
      roundRect(g, -150, 14, 300, 74, 8); g.fill()
      g.lineWidth = 2; g.stroke()
      g.strokeStyle = 'rgba(32,26,23,0.3)'; g.lineWidth = 1.6
      for (let r = 1; r < 3; r++) { g.beginPath(); g.moveTo(-150, 14 + r * 24.6); g.lineTo(150, 14 + r * 24.6); g.stroke() }
      for (let c = 1; c < 10; c++) { g.beginPath(); g.moveTo(-150 + c * 30, 14); g.lineTo(-150 + c * 30, 88); g.stroke() }
      g.fillStyle = '#e3e6e9'   // trackpad
      roundRect(g, -40, 96, 80, 34, 6); g.fill()
      g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      g.restore()

      // ---- mug with idle steam ----
      g.fillStyle = 'rgba(32,26,23,0.22)'
      g.beginPath(); g.arc(mug.x + 5, mug.y + 7, 58, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#5aa0db'
      g.beginPath(); g.arc(mug.x, mug.y, 58, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = '#5aa0db'   // handle
      g.beginPath(); g.ellipse(mug.x + 66, mug.y, 26, 16, 0.4, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3; g.stroke()
      g.fillStyle = '#7a4e28'   // coffee
      g.beginPath(); g.arc(mug.x, mug.y, 42, 0, Math.PI * 2); g.fill()
      g.lineWidth = 2.5; g.stroke()
      // steam: two wisps rising and fading on a loop
      for (const [ox, ph] of [[-14, 0], [14, 1.6]] as const) {
        const u = ((t / 1400 + ph) % 1)
        g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - u)})`
        g.lineWidth = 4
        g.beginPath()
        const sy = mug.y - 30 - u * 70
        g.moveTo(mug.x + ox, sy)
        g.quadraticCurveTo(mug.x + ox + 12, sy - 18, mug.x + ox, sy - 36)
        g.stroke()
      }
    },
  }
}
