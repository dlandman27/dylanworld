import { theme } from '../../config/theme'
import { spark, allObstacles } from '../physics'
import { drawRollingBall } from '../rollingBall'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// Rocket-League-on-the-table. A big grass pitch with a goal at each end and a
// soccer ball. Drive the Hot Wheels cars in and smack the ball into a net —
// a fast car LAUNCHES it (the ball resolves against each car's velocity). Ball
// resets to centre after a goal; a scoreboard keeps count. The ball is walled
// into the arena; cars roam the whole table and fly in over the low walls.

const PX = 6150       // pitch centre — out in the new right-side space
const PY = 2350
const HW = 850        // half width  (field 1700 wide)
const HH = 460        // half height (field 920 tall)
const GOAL_H = 300    // goal mouth height
const GOAL_D = 90     // net depth
const R = 30          // ball radius
const WALL_E = 0.6    // wall restitution
const BALL_FR = 1.0   // rolling friction
const MAX_BALL = 1500
const GRASS = '#79ad4a'
const GRASS_DK = '#6b9d40'
const ORANGE = theme.colors.coral
const BLUE = theme.colors.sky

interface Ball { x: number; y: number; vx: number; vy: number; tex: { x: number; y: number } }

export function createSoccer(): TableGame {
  const ball: Ball = { x: PX, y: PY, vx: 0, vy: 0, tex: { x: 0, y: 0 } }
  let scoreOrange = 0
  let scoreBlue = 0
  let goalFlash = 0
  let flashSide = 0 // -1 blue scored (left net), +1 orange scored (right net)
  const inGoalBand = (y: number): boolean => Math.abs(y - PY) < GOAL_H / 2

  const reset = (dir: number): void => {
    ball.x = PX; ball.y = PY
    ball.vx = 0; ball.vy = 0
    goalFlash = 1.6
    flashSide = dir
    for (let i = 0; i < 8; i++) spark(PX + (Math.random() - 0.5) * 120, PY + (Math.random() - 0.5) * 120, 0.5)
  }

  return {
    id: 'soccer',
    onDown(x, y) {
      // grabbing the ball to reposition it (tap-drag); return true only on it
      if (Math.hypot(x - ball.x, y - ball.y) < R + 10) {
        ball.vx = 0; ball.vy = 0
        grabbed = true
        return true
      }
      return false
    },
    onMove(x, y) {
      if (grabbed) { ball.x = x; ball.y = y }
    },
    onUp(_x, _y, vx, vy) {
      if (grabbed) { ball.vx = vx * 0.4; ball.vy = vy * 0.4; grabbed = false }
    },
    update(dt) {
      goalFlash = Math.max(0, goalFlash - dt)
      if (grabbed) return

      // roll
      const f = Math.exp(-BALL_FR * dt)
      ball.vx *= f; ball.vy *= f
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      const sp = Math.hypot(ball.vx, ball.vy)
      if (sp > MAX_BALL) { ball.vx = ball.vx / sp * MAX_BALL; ball.vy = ball.vy / sp * MAX_BALL }
      // roll: the surface pattern streams with the travel vector (marble system)
      ball.tex.x += ball.vx * dt * 0.5
      ball.tex.y += ball.vy * dt * 0.5

      // cars (and any obstacle) launch the ball via relative velocity
      for (const o of allObstacles()) {
        const cx = Math.min(Math.max(ball.x, o.x - o.half), o.x + o.half)
        const cy = Math.min(Math.max(ball.y, o.y - o.half), o.y + o.half)
        let dx = ball.x - cx, dy = ball.y - cy
        let d = Math.hypot(dx, dy)
        if (d >= R) continue
        if (d === 0) { dx = ball.x - o.x; dy = ball.y - o.y; d = Math.hypot(dx, dy) || 1 }
        const nx = dx / d, ny = dy / d
        ball.x = cx + nx * R
        ball.y = cy + ny * R
        const ovx = o.vx ?? 0, ovy = o.vy ?? 0
        const along = (ball.vx - ovx) * nx + (ball.vy - ovy) * ny
        if (along < 0) {
          ball.vx -= 1.85 * along * nx // e≈0.85 for a punchy launch
          ball.vy -= 1.85 * along * ny
          if (-along > 150) spark(cx, cy, Math.min(1, -along / 700))
        }
      }

      // walls — full top/bottom, left/right except the goal mouths
      if (ball.y - R < PY - HH) { ball.y = PY - HH + R; ball.vy = Math.abs(ball.vy) * WALL_E }
      if (ball.y + R > PY + HH) { ball.y = PY + HH - R; ball.vy = -Math.abs(ball.vy) * WALL_E }
      if (ball.x - R < PX - HW) {
        if (inGoalBand(ball.y)) {
          if (ball.x < PX - HW - GOAL_D * 0.4) { scoreBlue++; reset(-1) }
        } else { ball.x = PX - HW + R; ball.vx = Math.abs(ball.vx) * WALL_E }
      }
      if (ball.x + R > PX + HW) {
        if (inGoalBand(ball.y)) {
          if (ball.x > PX + HW + GOAL_D * 0.4) { scoreOrange++; reset(1) }
        } else { ball.x = PX + HW - R; ball.vx = -Math.abs(ball.vx) * WALL_E }
      }
    },
    draw(g: Ctx) {
      drawPitch(g)
      drawGoal(g, -1, ORANGE) // left net (orange defends)
      drawGoal(g, 1, BLUE)    // right net (blue defends)
      drawScoreboard(g, scoreOrange, scoreBlue)
      drawBall(g, ball)
      if (goalFlash > 0) drawGoalFlash(g, goalFlash, flashSide)
    },
  }
}

let grabbed = false

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function drawPitch(g: Ctx): void {
  // ground shadow + grass
  g.fillStyle = 'rgba(32,26,23,0.16)'
  roundRect(g, PX - HW - 20 + 6, PY - HH - 20 + 10, (HW + 20) * 2, (HH + 20) * 2, 26); g.fill()
  g.fillStyle = GRASS
  roundRect(g, PX - HW - 20, PY - HH - 20, (HW + 20) * 2, (HH + 20) * 2, 26); g.fill()
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke()
  // mown stripes
  g.save()
  roundRect(g, PX - HW - 20, PY - HH - 20, (HW + 20) * 2, (HH + 20) * 2, 26); g.clip()
  g.fillStyle = GRASS_DK
  for (let x = PX - HW; x < PX + HW; x += 170) g.fillRect(x, PY - HH - 20, 85, (HH + 20) * 2)
  g.restore()
  // white pitch markings
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 4
  g.strokeRect(PX - HW, PY - HH, HW * 2, HH * 2)         // boundary
  g.beginPath(); g.moveTo(PX, PY - HH); g.lineTo(PX, PY + HH); g.stroke() // halfway
  g.beginPath(); g.arc(PX, PY, 120, 0, Math.PI * 2); g.stroke()          // centre circle
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath(); g.arc(PX, PY, 8, 0, Math.PI * 2); g.fill()              // centre spot
  // penalty boxes
  for (const s of [-1, 1]) {
    const bx = s === -1 ? PX - HW : PX + HW - 190
    g.strokeRect(bx, PY - GOAL_H / 2 - 70, 190, GOAL_H + 140)
  }
}

function drawGoal(g: Ctx, side: number, color: string): void {
  const lineX = PX + side * HW
  const backX = lineX + side * GOAL_D
  const y0 = PY - GOAL_H / 2, y1 = PY + GOAL_H / 2
  // net box
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.beginPath()
  g.moveTo(lineX, y0); g.lineTo(backX, y0); g.lineTo(backX, y1); g.lineTo(lineX, y1); g.closePath()
  g.fill()
  // net mesh
  g.strokeStyle = 'rgba(255,255,255,0.8)'
  g.lineWidth = 1.2
  for (let i = 1; i < 5; i++) {
    const xx = lineX + side * (GOAL_D * i / 5)
    g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx, y1); g.stroke()
  }
  for (let j = 1; j < 6; j++) {
    const yy = y0 + (y1 - y0) * j / 6
    g.beginPath(); g.moveTo(lineX, yy); g.lineTo(backX, yy); g.stroke()
  }
  // coloured posts + crossbar
  g.strokeStyle = color
  g.lineWidth = 8
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(lineX, y0); g.lineTo(backX, y0)
  g.moveTo(lineX, y1); g.lineTo(backX, y1)
  g.moveTo(backX, y0); g.lineTo(backX, y1)
  g.stroke()
  // ink outline on the posts
  g.strokeStyle = INK; g.lineWidth = 2
  g.beginPath(); g.arc(lineX, y0, 6, 0, Math.PI * 2); g.arc(lineX, y1, 6, 0, Math.PI * 2); g.stroke()
  g.fillStyle = color
  g.beginPath(); g.arc(lineX, y0, 7, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(lineX, y1, 7, 0, Math.PI * 2); g.fill()
  g.lineWidth = 2; g.strokeStyle = INK
  g.beginPath(); g.arc(lineX, y0, 7, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.arc(lineX, y1, 7, 0, Math.PI * 2); g.stroke()
}

function drawScoreboard(g: Ctx, orange: number, blue: number): void {
  const w = 220, h = 74
  const x = PX - w / 2, y = PY - HH - 20 - h - 24
  g.fillStyle = 'rgba(32,26,23,0.18)'; roundRect(g, x + 5, y + 7, w, h, 12); g.fill()
  g.fillStyle = '#2b2620'; roundRect(g, x, y, w, h, 12); g.fill()
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `900 46px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.fillStyle = ORANGE; g.fillText(String(orange), x + w * 0.28, y + h / 2 + 2)
  g.fillStyle = BLUE; g.fillText(String(blue), x + w * 0.72, y + h / 2 + 2)
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = `800 30px ${theme.fonts.display}, sans-serif`
  g.fillText('-', x + w / 2, y + h / 2 + 1)
}

function drawBall(g: Ctx, b: Ball): void {
  // the shared rolling-ball renderer (same one the marbles use) with a soccer
  // texture: black pentagon patches. Bigger lens since the ball is large.
  g.save()
  g.translate(b.x, b.y)
  drawRollingBall(g, {
    r: R,
    tex: b.tex,
    body: '#fbfaf4',
    ink: INK,
    cellSize: 1.15,
    lens: 0.42,
    paint: (gg, c) => {
      // one black pentagon per cell, warped + scaled by the fisheye
      const w = c.warp(c.cellX, c.cellY)
      const pr = c.s * 0.4 * w.sc
      gg.fillStyle = '#23201c'
      gg.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2
        const px = w.x + Math.cos(a) * pr, py = w.y + Math.sin(a) * pr
        i === 0 ? gg.moveTo(px, py) : gg.lineTo(px, py)
      }
      gg.closePath(); gg.fill()
    },
  })
  g.restore()
}

function drawGoalFlash(g: Ctx, amt: number, side: number): void {
  const a = Math.min(1, amt / 1.6)
  g.save()
  g.globalAlpha = a
  g.fillStyle = side > 0 ? ORANGE : BLUE
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `900 ${Math.round(70 + (1 - a) * 40)}px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.lineWidth = 6; g.lineJoin = 'round'; g.strokeStyle = INK
  g.strokeText('GOAL!', PX, PY)
  g.fillText('GOAL!', PX, PY)
  g.restore()
}
