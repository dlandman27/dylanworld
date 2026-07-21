import { theme } from '../../config/theme'
import { spark } from '../physics'
import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect, pips } from './shared'

// Guided backgammon. Standard start, roll the dice, lift a checker and its
// legal points glow (dice-aware), snap on drop. Hits go to the bar, bar
// re-entry is enforced, bear off from your home. Sandbox turns (you pass the
// device / play both sides). House style: flat fills, ink outlines, top-down.
//
// Board index 0..23 traces the horseshoe: 0 = bottom-right corner, 5 = bottom
// just right of bar, 6 = bottom just left of bar, 11 = bottom-left, 12 = top-
// left, 17 = top just left of bar, 18 = top just right of bar, 23 = top-right.
// Light (0) moves 23→0, home 0..5. Dark (1) moves 0→23, home 18..23.

type Owner = 0 | 1 | null
interface Pt { n: number; c: Owner }

const HW = 440, HH = 280
const BAR = 40                     // half the centre bar width
const PW = (HW - BAR) / 6          // point (triangle) width
const CR = PW * 0.42               // checker radius
const LIGHT = '#f0e2be'
const DARK = '#2b2620'
const P_CORAL = '#c85a40'
const P_CREAM = '#e6d0a0'
const WOOD = '#b5915a'
const FELT = '#caa86a'

export function createBackgammon(cx: number, cy: number): TableGame {
  const pts: Pt[] = Array.from({ length: 24 }, () => ({ n: 0, c: null as Owner }))
  const set = (i: number, n: number, c: Owner): void => { pts[i] = { n, c } }
  // standard opening position
  set(23, 2, 0); set(12, 5, 0); set(7, 3, 0); set(5, 5, 0)   // Light
  set(0, 2, 1); set(11, 5, 1); set(16, 3, 1); set(18, 5, 1)  // Dark
  const bar = [0, 0]  // checkers on the bar, per player
  const off = [0, 0]  // borne off, per player
  let turn: 0 | 1 = 0
  let dice: number[] = []       // remaining die values this turn
  let rolled: [number, number] | null = null
  let rollAnim = 0              // seconds of dice-tumble left
  let doublePulse = 0          // celebratory glow when doubles land
  // drag: the checker eases toward (tx,ty); on release it flies to a target
  let drag: {
    from: number | 'bar'; c: Owner
    x: number; y: number; tx: number; ty: number   // rendered vs target (cursor)
    legal: Map<number | 'off', number>
  } | null = null
  // checkers mid-flight to their landing spot (snappy glide, not teleport)
  type Act = { kind: 'place'; dest: number | 'off'; die: number } | { kind: 'return'; from: number | 'bar' }
  const flying: { x: number; y: number; tx: number; ty: number; c: Owner; act: Act }[] = []
  let winPulse = 0

  // ---- geometry ----
  const pointPos = (i: number): { x: number; baseY: number; dir: number } => {
    if (i <= 11) {
      const baseY = HH
      const x = i <= 5 ? BAR + PW * (5 - i + 0.5) : -(BAR + PW * (i - 6 + 0.5))
      return { x, baseY, dir: -1 } // triangles point up, stack upward
    }
    const baseY = -HH
    const x = i <= 17 ? -(BAR + PW * (17 - i + 0.5)) : BAR + PW * (i - 18 + 0.5)
    return { x, baseY, dir: 1 }    // point down, stack downward
  }
  const checkerXY = (i: number, k: number): { x: number; y: number } => {
    const p = pointPos(i)
    // dir points INWARD (toward centre): +dir stacks off the base into the board
    return { x: p.x, y: p.baseY + p.dir * (CR + 2 + k * (CR * 2 - 3)) }
  }
  const diceBox = { x: -HW * 0.42, y: 0 } // where the dice sit / roll button
  const offXY = (c: Owner): { x: number; y: number } => ({ x: c === 0 ? HW + 4 : -HW - 4, y: 0 })
  const barXY = (c: Owner, k: number): { x: number; y: number } => ({ x: 0, y: (c === 0 ? 1 : -1) * (CR + 4 + k * (CR * 2 - 3)) })

  // ---- rules ----
  const allHome = (pl: 0 | 1): boolean => {
    if (bar[pl] > 0) return false
    const lo = pl === 0 ? 6 : 0, hi = pl === 0 ? 23 : 17
    for (let i = lo; i <= hi; i++) if (pts[i].c === pl && pts[i].n > 0) return false
    return true
  }
  const canBearOff = (pl: 0 | 1, from: number, d: number): boolean => {
    if (!allHome(pl)) return false
    if (pl === 0) {
      const dest = from - d
      if (dest === -1) return true
      if (dest < -1) { for (let k = from + 1; k <= 5; k++) if (pts[k].c === 0 && pts[k].n > 0) return false; return true }
      return false
    }
    const dest = from + d
    if (dest === 24) return true
    if (dest > 24) { for (let k = from - 1; k >= 18; k--) if (pts[k].c === 1 && pts[k].n > 0) return false; return true }
    return false
  }
  const legalFrom = (from: number | 'bar'): Map<number | 'off', number> => {
    const m = new Map<number | 'off', number>()
    const pl = turn
    for (const d of new Set(dice)) {
      if (from === 'bar') {
        const dest = pl === 0 ? 24 - d : d - 1
        const t = pts[dest]
        if (t.c === null || t.c === pl || t.n === 1) if (!m.has(dest)) m.set(dest, d)
        continue
      }
      const dest = pl === 0 ? from - d : from + d
      if ((pl === 0 && dest < 0) || (pl === 1 && dest > 23)) {
        if (canBearOff(pl, from, d) && !m.has('off')) m.set('off', d)
        continue
      }
      if (dest < 0 || dest > 23) continue
      const t = pts[dest]
      if (t.c === null || t.c === pl || t.n === 1) if (!m.has(dest)) m.set(dest, d)
    }
    return m
  }
  const anyMove = (): boolean => {
    if (dice.length === 0) return false
    if (bar[turn] > 0) return legalFrom('bar').size > 0
    for (let i = 0; i < 24; i++) if (pts[i].c === turn && pts[i].n > 0 && legalFrom(i).size > 0) return true
    return false
  }
  const endIfDone = (): void => {
    if (dice.length === 0 || !anyMove()) { dice = []; rolled = null; turn = (turn === 0 ? 1 : 0) }
  }
  // executed when a flying checker lands
  const placeResolve = (dest: number | 'off', die: number, c: Owner): void => {
    const di = dice.indexOf(die); if (di >= 0) dice.splice(di, 1)
    if (dest === 'off') { off[c as number]++; spark(cx + offXY(c).x, cy, 0.3) } else {
      if (pts[dest].c !== null && pts[dest].c !== c && pts[dest].n === 1) {
        bar[pts[dest].c as number]++; pts[dest].n = 0; pts[dest].c = null
        spark(cx + pointPos(dest).x, cy, 0.35)
      }
      if (pts[dest].c === null) pts[dest].c = c
      pts[dest].n++
    }
    clunk(0.15)
    if (off[c as number] >= 15) winPulse = 2
    endIfDone()
  }
  const returnResolve = (from: number | 'bar', c: Owner): void => {
    if (from === 'bar') { bar[c as number]++; return }
    if (pts[from].c === null) pts[from].c = c
    pts[from].n++
  }

  // ---- picking + input ----
  const pointAt = (x: number, y: number): number | null => {
    for (let i = 0; i < 24; i++) {
      const p = pointPos(i)
      if (Math.abs(x - p.x) < PW / 2 && (p.dir < 0 ? y < p.baseY && y > p.baseY - HH * 0.9 : y > p.baseY && y < p.baseY + HH * 0.9)) return i
    }
    return null
  }

  return {
    id: 'backgammon',
    onDown(gx, gy) {
      const x = gx - cx, y = gy - cy
      const onBoard = Math.abs(x) < HW + 30 && Math.abs(y) < HH + 30
      if (!onBoard) return false
      // roll / pass by clicking the dice
      if (Math.hypot(x - diceBox.x, y - diceBox.y) < 70) {
        if (dice.length === 0 && rollAnim <= 0) {
          const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0)
          rolled = [a, b]
          dice = a === b ? [a, a, a, a] : [a, b]
          rollAnim = 0.7                        // tumble before they settle
          if (a === b) doublePulse = 1.6        // celebrate doubles
          clunk(0.35)
        } else if (rollAnim <= 0 && !anyMove()) {
          dice = []; rolled = null; turn = (turn === 0 ? 1 : 0)
        }
        return true
      }
      if (rollAnim > 0) return true // no moving pieces mid-roll
      // must play off the bar first
      if (bar[turn] > 0) {
        if (Math.abs(x) < BAR + 20 && Math.abs(y) < HH) {
          const q = barXY(turn, bar[turn] - 1)
          drag = { from: 'bar', c: turn, x: q.x, y: q.y, tx: x, ty: y, legal: legalFrom('bar') }
          bar[turn]--
        }
        return true
      }
      const i = pointAt(x, y)
      if (i !== null && pts[i].c === turn && pts[i].n > 0) {
        const q = checkerXY(i, pts[i].n - 1)
        drag = { from: i, c: turn, x: q.x, y: q.y, tx: x, ty: y, legal: legalFrom(i) }
        pts[i].n--
        if (pts[i].n === 0) pts[i].c = null
      }
      return true
    },
    onMove(gx, gy) {
      if (drag) { drag.tx = gx - cx; drag.ty = gy - cy }
    },
    onUp() {
      if (!drag) return
      const d = drag
      drag = null
      // nearest legal destination to the drop
      let best: number | 'off' | null = null, bestD = Infinity
      for (const dest of d.legal.keys()) {
        const q = dest === 'off' ? offXY(d.c) : checkerXY(dest, pts[dest].c === d.c ? pts[dest].n : 0)
        const dd = Math.hypot(d.x - q.x, d.y - q.y)
        if (dd < bestD) { bestD = dd; best = dest }
      }
      if (best !== null && bestD < CR * 3.4) {
        const die = d.legal.get(best)!
        const q = best === 'off' ? offXY(d.c) : checkerXY(best, pts[best].c === d.c ? pts[best].n : 0)
        flying.push({ x: d.x, y: d.y, tx: q.x, ty: q.y, c: d.c, act: { kind: 'place', dest: best, die } })
      } else {
        // illegal / no target → the checker glides back home
        const q = d.from === 'bar' ? barXY(d.c, bar[d.c as number]) : checkerXY(d.from, pts[d.from].n)
        flying.push({ x: d.x, y: d.y, tx: q.x, ty: q.y, c: d.c, act: { kind: 'return', from: d.from } })
      }
    },
    update(dt) {
      if (winPulse > 0) winPulse = Math.max(0, winPulse - dt)
      if (doublePulse > 0) doublePulse = Math.max(0, doublePulse - dt)
      if (rollAnim > 0) { rollAnim = Math.max(0, rollAnim - dt); if (rollAnim === 0 && !anyMove()) spark(cx + diceBox.x, cy, 0.2) }
      // dragged checker eases toward the cursor (glide, slight lag)
      if (drag) {
        const e = Math.min(1, dt * 22)
        drag.x += (drag.tx - drag.x) * e
        drag.y += (drag.ty - drag.y) * e
      }
      // in-flight checkers snap toward their landing spot, then resolve
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]
        const e = Math.min(1, dt * 16)
        f.x += (f.tx - f.x) * e
        f.y += (f.ty - f.y) * e
        if (Math.hypot(f.tx - f.x, f.ty - f.y) < 4) {
          if (f.act.kind === 'place') placeResolve(f.act.dest, f.act.die, f.c)
          else returnResolve(f.act.from, f.c)
          flying.splice(i, 1)
        }
      }
    },
    draw(g: Ctx, t: number) {
      g.save()
      g.translate(cx, cy)
      // shadow + wood frame
      g.fillStyle = 'rgba(32,26,23,0.2)'; roundRect(g, -HW - 30 + 6, -HH - 30 + 9, (HW + 30) * 2, (HH + 30) * 2, 20); g.fill()
      g.fillStyle = WOOD; roundRect(g, -HW - 30, -HH - 30, (HW + 30) * 2, (HH + 30) * 2, 20); g.fill()
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      // felt playing field
      g.fillStyle = FELT; roundRect(g, -HW, -HH, HW * 2, HH * 2, 8); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // points
      for (let i = 0; i < 24; i++) {
        const p = pointPos(i)
        g.fillStyle = i % 2 === 0 ? P_CORAL : P_CREAM
        g.beginPath()
        g.moveTo(p.x - PW / 2, p.baseY)
        g.lineTo(p.x + PW / 2, p.baseY)
        g.lineTo(p.x, p.baseY + p.dir * HH * 0.82)
        g.closePath(); g.fill()
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(32,26,23,0.4)'; g.stroke()
      }
      // centre bar
      g.fillStyle = WOOD; g.fillRect(-BAR, -HH, BAR * 2, HH * 2)
      g.lineWidth = 3; g.strokeStyle = INK; g.strokeRect(-BAR, -HH, BAR * 2, HH * 2)

      // checker helper — a proper backgammon stone: beveled rim, carved
      // grooves, inset centre, flat highlight. Flat top-down, ink outlines.
      const disc = (x: number, y: number, c: Owner, dim = false): void => {
        const light = c === 0
        const face = light ? '#efe3c4' : '#4a3b30'
        const rim = light ? '#d8c497' : '#2e241d'
        const groove = light ? 'rgba(120,95,55,0.45)' : 'rgba(20,14,10,0.6)'
        g.globalAlpha = dim ? 0.5 : 1
        // hard offset shadow
        g.fillStyle = 'rgba(32,26,23,0.24)'; g.beginPath(); g.arc(x + 1.5, y + 3, CR, 0, Math.PI * 2); g.fill()
        // beveled rim ring (darker), then the raised face
        g.fillStyle = rim; g.beginPath(); g.arc(x, y, CR, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()
        g.fillStyle = face; g.beginPath(); g.arc(x, y, CR * 0.82, 0, Math.PI * 2); g.fill()
        // carved concentric grooves
        g.strokeStyle = groove; g.lineWidth = 1.5
        g.beginPath(); g.arc(x, y, CR * 0.62, 0, Math.PI * 2); g.stroke()
        g.beginPath(); g.arc(x, y, CR * 0.44, 0, Math.PI * 2); g.stroke()
        // inset centre pip
        g.fillStyle = rim; g.beginPath(); g.arc(x, y, CR * 0.24, 0, Math.PI * 2); g.fill()
        g.lineWidth = 1.2; g.strokeStyle = groove; g.stroke()
        // flat highlight crescent (top-left)
        g.save()
        g.beginPath(); g.arc(x, y, CR * 0.82, 0, Math.PI * 2); g.clip()
        g.fillStyle = light ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)'
        g.beginPath(); g.ellipse(x - CR * 0.28, y - CR * 0.32, CR * 0.5, CR * 0.3, -0.6, 0, Math.PI * 2); g.fill()
        g.restore()
        g.globalAlpha = 1
      }

      // legal-point glow while dragging
      if (drag) {
        for (const dest of drag.legal.keys()) {
          if (dest === 'off') continue
          const p = pointPos(dest)
          g.fillStyle = 'rgba(247, 201, 72, 0.5)'
          g.beginPath()
          g.moveTo(p.x - PW / 2, p.baseY); g.lineTo(p.x + PW / 2, p.baseY)
          g.lineTo(p.x, p.baseY + p.dir * HH * 0.82); g.closePath(); g.fill()
        }
        if (drag.legal.has('off')) {
          g.fillStyle = 'rgba(247,201,72,0.5)'
          const ox = drag.c === 0 ? HW + 6 : -HW - 22
          g.fillRect(ox, -HH, 16, HH * 2)
        }
      }

      // stacked checkers
      for (let i = 0; i < 24; i++) {
        const p = pts[i]
        if (!p.c && p.n === 0) continue
        const show = Math.min(p.n, 5)
        for (let k = 0; k < show; k++) { const q = checkerXY(i, k); disc(q.x, q.y, p.c) }
        if (p.n > 5) {
          const q = checkerXY(i, 4)
          g.fillStyle = p.c === 0 ? INK : '#fbfaf4'
          g.font = `800 ${Math.round(CR)}px ${theme.fonts.display}, sans-serif`
          g.textAlign = 'center'; g.textBaseline = 'middle'
          g.fillText(String(p.n), q.x, q.y)
        }
      }
      // bar checkers
      for (const pl of [0, 1] as const) {
        for (let k = 0; k < bar[pl]; k++) { const q = barXY(pl as Owner, k); disc(q.x, q.y, pl as Owner) }
      }
      // in-flight checkers gliding to their landing spot
      for (const f of flying) disc(f.x, f.y, f.c)
      // off trays (counts)
      for (const pl of [0, 1] as const) {
        if (off[pl] === 0) continue
        g.fillStyle = pl === 0 ? INK : '#fbfaf4'
        g.font = `800 16px ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(`off ${off[pl]}`, pl === 0 ? HW - 4 : -HW + 4, pl === 0 ? HH - 14 : -HH + 14)
      }

      // ---- dice / roll button ----
      g.save()
      g.translate(diceBox.x, diceBox.y)
      const doubles = rolled !== null && rolled[0] === rolled[1]
      const drawDie = (dx: number, dy: number, v: number, rot: number, dim: boolean): void => {
        const sz = 36
        g.save(); g.translate(dx, dy); g.rotate(rot)
        g.globalAlpha = dim ? 0.4 : 1
        g.fillStyle = 'rgba(32,26,23,0.22)'; roundRect(g, -sz / 2 + 2, -sz / 2 + 3, sz, sz, 7); g.fill()
        g.fillStyle = doubles ? '#f7c948' : '#f0e2be'
        roundRect(g, -sz / 2, -sz / 2, sz, sz, 7); g.fill()
        g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()
        pips(g, 0, 0, sz, v)
        g.globalAlpha = 1
        g.restore()
      }
      if (!rolled && rollAnim <= 0) {
        g.fillStyle = turn === 0 ? LIGHT : DARK
        g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill()
        g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        g.fillStyle = turn === 0 ? INK : '#fbfaf4'
        g.font = `800 15px ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('roll', 0, 1)
      } else if (rollAnim > 0) {
        // a real throw: two dice bounce (damped hops), tumble with a wobble
        // that eases out, and the faces LOCK to the final value as they settle
        const p = 1 - rollAnim / 0.7       // 0..1 progress
        for (let i = 0; i < 2; i++) {
          const s = i === 0 ? -1 : 1
          const final = rolled ? rolled[i] : 1
          // face cycles fast early (slowing down), then locks in the last third
          const face = p < 0.66
            ? 1 + ((Math.floor(t / (45 + p * 220)) + i * 2) % 6 + 6) % 6
            : final
          const x = s * 26
          const bounce = Math.abs(Math.sin(p * Math.PI * 2)) * 30 * (1 - p) // two hops, damping
          const rot = (1 - p) * (1 - p) * Math.sin(p * 22 + i * 2) * 0.9     // wobble → rest
          drawDie(x, -bounce, face, rot, false)
        }
      } else if (rolled) {
        const ds = doubles ? [rolled[0], rolled[0], rolled[0], rolled[0]] : rolled
        const sz = 36, gap = 9
        const total = ds.length * sz + (ds.length - 1) * gap
        // a slot is "used" if its value is no longer among the remaining dice
        const remain = [...dice]
        ds.forEach((v, i) => {
          const ri = remain.indexOf(v)
          const used = ri < 0
          if (ri >= 0) remain.splice(ri, 1)
          drawDie(-total / 2 + sz / 2 + i * (sz + gap), 0, v, 0, used)
        })
        if (doublePulse > 0) {
          g.globalAlpha = Math.min(1, doublePulse)
          g.fillStyle = '#e0a92a'
          g.font = `900 20px ${theme.fonts.display}, sans-serif`
          g.textAlign = 'center'; g.textBaseline = 'middle'
          g.fillText('DOUBLES!', 0, -34)
          g.globalAlpha = 1
        }
        if (!anyMove()) {
          g.fillStyle = INK; g.font = `800 13px ${theme.fonts.display}, sans-serif`
          g.textAlign = 'center'; g.textBaseline = 'middle'
          g.fillText('click to pass', 0, 34)
        }
      }
      g.restore()

      // turn indicator
      g.fillStyle = INK
      g.font = `800 16px ${theme.fonts.display}, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(turn === 0 ? "Light's turn" : "Dark's turn", 0, -HH - 14)

      // dragged checker rides the cursor
      if (drag) disc(drag.x, drag.y, drag.c)

      if (winPulse > 0) {
        g.globalAlpha = Math.min(1, winPulse)
        g.fillStyle = off[0] >= 15 ? INK : '#c85a40'
        g.font = `900 60px "Arial Black", ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.lineWidth = 6; g.lineJoin = 'round'; g.strokeStyle = '#fbfaf4'
        g.strokeText('WINNER', 0, 0); g.fillText('WINNER', 0, 0)
        g.globalAlpha = 1
      }
      g.restore()
    },
  }
}
