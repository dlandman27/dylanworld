import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// A little basketball hoop in the sports corner. Grab the ball and FLICK it at
// the hoop (top-down: the rim is an orange ellipse, the backboard stands behind
// it toward the wall). Land it in the rim and the net swishes, the score ticks,
// and the ball hops back to its spot. Miss and it slides on the court — grab and
// try again. The house rules: wood bite friction, squash on hits, spark+clunk.

type Ctx = CanvasRenderingContext2D

const R = 44                 // ball radius
const RIM_RX = 100, RIM_RY = 48   // rim ellipse (top-down, foreshortened)
const BALL = '#e07b2e', BALL_D = '#c96a22'

export function createBasketball(cx: number, cy: number): TableGame {
  // hoop geometry: rim opening to the LEFT (you flick rightward into it),
  // backboard just behind it toward the wall.
  const rim = { x: cx - 70, y: cy }
  const board = { x: cx + 44, y: cy, w: 40, h: 300 }
  const home = { x: cx - 1020, y: cy + 320 }   // where the ball waits/returns

  const ball = { x: home.x, y: home.y, vx: 0, vy: 0, squash: 0 }
  let grabbed = false
  let target = { x: 0, y: 0 }
  let lift = 0                 // held-ball rise
  let score = 0
  let scorePulse = 0          // scoreboard pop on a make
  let net = 0                 // net swish wobble
  let resetIn = 0             // ball is "in the basket" — respawn countdown
  let swish = 0               // "SWISH!" callout timer

  // the backboard is solid — marbles/props bounce off it
  registerObstacleProvider(() => [{ x: board.x, y: board.y, half: board.h / 2 }])

  const near = (x: number, y: number): boolean =>
    Math.hypot(x - ball.x, y - ball.y) < R + 10

  const respawn = (): void => {
    ball.x = home.x; ball.y = home.y; ball.vx = 0; ball.vy = 0; ball.squash = 0
    resetIn = 0
  }

  return {
    id: 'basketball',
    onDown(x, y) {
      if (resetIn > 0) return false
      if (near(x, y)) {
        grabbed = true
        target = { x, y }
        return true
      }
      return false   // let the table pan elsewhere
    },
    onMove(x, y) {
      if (grabbed) target = { x, y }
    },
    onUp(_x, _y, vx, vy) {
      if (!grabbed) return
      grabbed = false
      ball.vx = vx * 0.5     // flick from cursor velocity
      ball.vy = vy * 0.5
    },
    update(dt) {
      scorePulse = Math.max(0, scorePulse - dt * 2)
      swish = Math.max(0, swish - dt)
      net += (0 - net) * Math.min(1, dt * 6)
      ball.squash += (0 - ball.squash) * Math.min(1, dt * 8)

      if (resetIn > 0) {
        resetIn -= dt
        net = Math.max(net, Math.sin(resetIn * 20) * Math.max(0, resetIn) * 0.6)
        if (resetIn <= 0) respawn()
        lift += (0 - lift) * Math.min(1, dt * 8)
        return
      }

      if (grabbed) {
        // spring toward the cursor, rise like it's lifted off the court
        ball.vx = (target.x - ball.x) * 14
        ball.vy = (target.y - ball.y) * 14
        ball.x += ball.vx * dt
        ball.y += ball.vy * dt
        lift += (1 - lift) * Math.min(1, dt * 10)
        return
      }
      lift += (0 - lift) * Math.min(1, dt * 8)

      // free ball: glides on the court with a gentle roll friction
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      const fr = Math.exp(-1.9 * dt)
      ball.vx *= fr; ball.vy *= fr

      const speed = Math.hypot(ball.vx, ball.vy)

      // make it? ball settling inside the rim at a calm speed drops in
      const dInRim = Math.hypot((ball.x - rim.x) / (RIM_RX * 0.8), (ball.y - rim.y) / (RIM_RY * 0.8))
      if (dInRim < 1 && speed < 900) {
        score++
        scorePulse = 1
        swish = 1.1
        net = 1
        resetIn = 0.9
        spark(rim.x, rim.y, 0.14)
        return
      }

      // backboard bounce (reflect x, damp) + clunk
      if (Math.abs(ball.x - board.x) < board.w / 2 + R && Math.abs(ball.y - board.y) < board.h / 2 + R && ball.vx > 0) {
        ball.x = board.x - board.w / 2 - R
        ball.vx *= -0.5; ball.vy *= 0.8
        ball.squash = Math.min(1, speed / 900)
        if (speed > 260) spark(ball.x, ball.y, speed / 1400)
      }

      // keep it on the floor (soft bounce off the room bounds)
      for (const [p, v, lo, hi] of [['x', 'vx', R, 6600 - R], ['y', 'vy', R, 4600 - R]] as const) {
        if (ball[p] < lo) { ball[p] = lo; ball[v] *= -0.5 }
        else if (ball[p] > hi) { ball[p] = hi; ball[v] *= -0.5 }
      }
    },
    draw(g: Ctx, t) {
      // ---- backboard: a white board standing toward the wall, orange target ----
      const bx = board.x, by = board.y
      g.fillStyle = 'rgba(32,26,23,0.22)'
      roundRect(g, bx - board.w / 2 + 8, by - board.h / 2 + 10, board.w, board.h, 10); g.fill()
      g.fillStyle = '#f3f4f6'
      roundRect(g, bx - board.w / 2, by - board.h / 2, board.w, board.h, 10); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.strokeStyle = BALL; g.lineWidth = 6
      roundRect(g, bx - 8, by - 70, 20, 140, 5); g.stroke()   // the orange shooter's square

      // ---- net: white criss-cross hanging toward the viewer, swaying on a make ----
      const sway = Math.sin(t / 120) * 6 + net * Math.sin(t / 40) * 26
      const nTop = RIM_RY * 0.5, nBot = 150, nHalf = RIM_RX * 0.9
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2.5; g.lineCap = 'round'
      const cols = 7
      for (let i = 0; i <= cols; i++) {
        const u = i / cols
        const topX = rim.x - nHalf + u * nHalf * 2
        const botX = rim.x - nHalf * 0.5 + u * nHalf + sway * (u - 0.5)
        g.beginPath(); g.moveTo(topX, rim.y + nTop); g.lineTo(botX, rim.y + nBot); g.stroke()
      }
      for (const ring of [0.4, 0.72, 1]) {
        g.beginPath()
        g.ellipse(rim.x + sway * (ring - 0.3), rim.y + nTop + (nBot - nTop) * ring, nHalf * (1 - ring * 0.42), (RIM_RY + 6) * (1 - ring * 0.3), 0, 0, Math.PI)
        g.stroke()
      }

      // ---- ball (draw BELOW the rim if it's not made, so the rim reads on top) ----
      const s = 1 + lift * 0.14
      const sq = ball.squash
      g.save()
      g.fillStyle = 'rgba(32,26,23,0.22)'
      const shOff = 6 + lift * 16
      g.beginPath(); g.ellipse(ball.x + shOff, ball.y + shOff + 6, R * s, R * s * 0.9, 0, 0, Math.PI * 2); g.fill()
      g.translate(ball.x, ball.y); g.scale(s * (1 + sq * 0.12), s * (1 - sq * 0.16))
      g.fillStyle = BALL
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // seams
      g.strokeStyle = BALL_D; g.lineWidth = 3
      g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.stroke()
      g.beginPath(); g.moveTo(0, -R); g.lineTo(0, R); g.stroke()
      g.beginPath(); g.arc(-R * 1.3, 0, R * 1.5, -0.7, 0.7); g.stroke()
      g.beginPath(); g.arc(R * 1.3, 0, R * 1.5, Math.PI - 0.7, Math.PI + 0.7); g.stroke()
      // highlight
      g.fillStyle = 'rgba(255,255,255,0.3)'
      g.beginPath(); g.ellipse(-R * 0.35, -R * 0.4, R * 0.22, R * 0.12, -0.6, 0, Math.PI * 2); g.fill()
      g.restore()

      // ---- rim: chunky orange ellipse ring, sits above the net + ball ----
      g.strokeStyle = BALL
      g.lineWidth = 12
      g.beginPath(); g.ellipse(rim.x, rim.y, RIM_RX, RIM_RY, 0, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = INK; g.lineWidth = 2.5
      g.beginPath(); g.ellipse(rim.x, rim.y, RIM_RX + 6, RIM_RY + 6, 0, 0, Math.PI * 2); g.stroke()
      g.beginPath(); g.ellipse(rim.x, rim.y, RIM_RX - 6, RIM_RY - 6, 0, 0, Math.PI * 2); g.stroke()

      // ---- scoreboard above the hoop ----
      const sbx = cx - 20, sby = cy - 320, pop = 1 + scorePulse * 0.25
      g.save(); g.translate(sbx, sby); g.scale(pop, pop)
      g.fillStyle = 'rgba(32,26,23,0.22)'; roundRect(g, -70 + 5, -40 + 6, 140, 80, 12); g.fill()
      g.fillStyle = INK; roundRect(g, -70, -40, 140, 80, 12); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.fillStyle = theme.colors.orange
      g.font = `900 20px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText('BASKETS', 0, -18)
      g.fillStyle = '#f7c948'
      g.font = `900 40px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.fillText(String(score), 0, 14)
      g.restore()

      // ---- "SWISH!" callout on a make ----
      if (swish > 0) {
        g.save(); g.translate(rim.x, rim.y - 90 - (1 - swish) * 40); g.globalAlpha = Math.min(1, swish * 2)
        g.font = `900 44px "Arial Black", ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.lineWidth = 8; g.lineJoin = 'round'; g.strokeStyle = INK; g.strokeText('SWISH!', 0, 0)
        g.fillStyle = '#f7c948'; g.fillText('SWISH!', 0, 0)
        g.restore()
      }
    },
  }
}
