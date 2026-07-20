import { theme } from '../../config/theme'
import { spark } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A full Scrabble set: 15×15 board with the real premium-square layout, and TWO
// tile bags in different colors. Tap a bag to draw a random tile (real letter
// distribution), drag tiles anywhere, drop them on the board and they snap into
// cells. Sandbox rules — the table doesn't argue about what counts as a word.

interface Tile {
  x: number; y: number
  char: string
  score: number
  light: boolean          // which bag it came from (tile color)
  cell: number | null     // board cell index when seated
  grabbed: boolean
}

const N = 15
const SQ = 46
const TS = 40 // tile size

const SCORES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
}
// official-ish letter distribution, blanks omitted
const BAG =
  'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGG' +
  'BBCCMMPPFFHHVVWWYYKJXQZ'

// premium squares (standard board), as functions of row/col
const TW = new Set(['0,0', '0,7', '0,14', '7,0', '7,14', '14,0', '14,7', '14,14'])
const TL = new Set(['1,5', '1,9', '5,1', '5,5', '5,9', '5,13', '9,1', '9,5', '9,9', '9,13', '13,5', '13,9'])
const DL = new Set(['0,3', '0,11', '2,6', '2,8', '3,0', '3,7', '3,14', '6,2', '6,6', '6,8', '6,12',
  '7,3', '7,11', '8,2', '8,6', '8,8', '8,12', '11,0', '11,7', '11,14', '12,6', '12,8', '14,3', '14,11'])
const isDW = (r: number, c: number): boolean =>
  (r === c || r + c === 14) && r >= 1 && r <= 13 && r !== 7 && (r <= 4 || r >= 10)

export function createScrabble(cx: number, cy: number): TableGame {
  const bx = cx - (N * SQ) / 2
  const by = cy - (N * SQ) / 2
  const bagA = { x: bx + N * SQ + 90, y: cy - 130 }  // classic cream
  const bagB = { x: bx + N * SQ + 90, y: cy + 130 }  // sky blue
  const tiles: Tile[] = []
  const occupied = new Map<number, Tile>()
  let held: Tile | null = null
  let hoff = { x: 0, y: 0 }

  const cellCenter = (i: number): { x: number; y: number } => ({
    x: bx + (i % N) * SQ + SQ / 2,
    y: by + Math.floor(i / N) * SQ + SQ / 2,
  })
  const nearestCell = (x: number, y: number): number | null => {
    const c = Math.min(Math.max(Math.round((x - bx - SQ / 2) / SQ), 0), N - 1)
    const r = Math.min(Math.max(Math.round((y - by - SQ / 2) / SQ), 0), N - 1)
    const i = r * N + c
    const cc = cellCenter(i)
    return Math.hypot(x - cc.x, y - cc.y) < SQ * 1.1 ? i : null
  }
  const overBag = (bag: { x: number; y: number }, x: number, y: number): boolean =>
    Math.hypot(x - bag.x, y - bag.y) < 62

  const drawFromBag = (bag: { x: number; y: number }, light: boolean): void => {
    const char = BAG[(Math.random() * BAG.length) | 0]
    tiles.push({
      x: bag.x - 90 - Math.random() * 30,
      y: bag.y + (Math.random() - 0.5) * 60,
      char, score: SCORES[char] ?? 1, light, cell: null, grabbed: false,
    })
    spark(bag.x - 60, bag.y, 0.15)
  }

  return {
    id: 'scrabble',
    onDown(x, y) {
      // tiles first (topmost)
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i]
        if (Math.abs(x - t.x) < TS / 2 + 6 && Math.abs(y - t.y) < TS / 2 + 6) {
          tiles.splice(i, 1); tiles.push(t)
          if (t.cell !== null) { occupied.delete(t.cell); t.cell = null }
          t.grabbed = true
          held = t
          hoff = { x: x - t.x, y: y - t.y }
          return true
        }
      }
      if (overBag(bagA, x, y)) { drawFromBag(bagA, true); return true }
      if (overBag(bagB, x, y)) { drawFromBag(bagB, false); return true }
      // capture presses on the board so the table doesn't pan mid-play
      return x > bx - 20 && x < bx + N * SQ + 20 && y > by - 20 && y < by + N * SQ + 20
    },
    onMove(x, y) {
      if (held) { held.x = x - hoff.x; held.y = y - hoff.y }
    },
    onUp() {
      if (!held) return
      const i = nearestCell(held.x, held.y)
      if (i !== null && !occupied.has(i)) {
        const cc = cellCenter(i)
        held.x = cc.x; held.y = cc.y
        held.cell = i
        occupied.set(i, held)
        spark(cc.x, cc.y, 0.12)
      }
      held.grabbed = false
      held = null
    },
    update() { /* scrabble tiles sit where you put them */ },
    draw(g: Ctx) {
      // ---- board ----
      g.fillStyle = 'rgba(32,26,23,0.18)'
      roundRect(g, bx - 16 + 8, by - 16 + 12, N * SQ + 32, N * SQ + 32, 12); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, bx - 16, by - 16, N * SQ + 32, N * SQ + 32, 12); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const key = `${r},${c}`
        let fill = '#e8dfc8'
        if (TW.has(key)) fill = theme.colors.coral
        else if (isDW(r, c)) fill = theme.colors.pink
        else if (TL.has(key)) fill = theme.colors.sky
        else if (DL.has(key)) fill = theme.colors.lime
        g.fillStyle = fill
        g.fillRect(bx + c * SQ + 1.5, by + r * SQ + 1.5, SQ - 3, SQ - 3)
      }
      g.lineWidth = 1
      g.strokeStyle = 'rgba(32,26,23,0.25)'
      for (let i = 0; i <= N; i++) {
        g.beginPath(); g.moveTo(bx + i * SQ, by); g.lineTo(bx + i * SQ, by + N * SQ); g.stroke()
        g.beginPath(); g.moveTo(bx, by + i * SQ); g.lineTo(bx + N * SQ, by + i * SQ); g.stroke()
      }
      // centre star
      g.save()
      g.translate(bx + 7 * SQ + SQ / 2, by + 7 * SQ + SQ / 2)
      g.fillStyle = theme.colors.orange
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 13 : 5.5
        const a = -Math.PI / 2 + (Math.PI * i) / 5
        i === 0 ? g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      g.closePath(); g.fill()
      g.lineWidth = 1.8; g.strokeStyle = INK; g.stroke()
      g.restore()

      // ---- the two bags ----
      for (const [bag, light] of [[bagA, true], [bagB, false]] as [typeof bagA, boolean][]) {
        const col = light ? '#f0e2be' : '#bcd7ea'
        g.fillStyle = 'rgba(32,26,23,0.2)'
        g.beginPath(); g.ellipse(bag.x + 5, bag.y + 44, 46, 14, 0, 0, Math.PI * 2); g.fill()
        // pouch body
        g.fillStyle = col
        g.strokeStyle = INK
        g.lineWidth = 3
        g.beginPath()
        g.moveTo(bag.x - 26, bag.y - 30)
        g.bezierCurveTo(bag.x - 62, bag.y - 8, bag.x - 52, bag.y + 46, bag.x, bag.y + 48)
        g.bezierCurveTo(bag.x + 52, bag.y + 46, bag.x + 62, bag.y - 8, bag.x + 26, bag.y - 30)
        g.closePath(); g.fill(); g.stroke()
        // cinched neck + tie
        g.fillStyle = col
        g.beginPath(); g.ellipse(bag.x, bag.y - 34, 20, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke()
        g.lineWidth = 4
        g.beginPath(); g.moveTo(bag.x - 18, bag.y - 28); g.lineTo(bag.x + 18, bag.y - 28); g.stroke()
        // a peeking tile
        g.fillStyle = light ? '#fbf4e2' : '#d4e6f4'
        roundRect(g, bag.x - 9, bag.y - 52, 18, 18, 3); g.fill()
        g.lineWidth = 2; g.stroke()
      }

      // ---- tiles ----
      for (const t of tiles) {
        g.save()
        g.translate(t.x, t.y)
        const lift = t.grabbed ? 1 : 0
        g.fillStyle = `rgba(32,26,23,${0.24 - lift * 0.1})`
        roundRect(g, -TS / 2 + 2 + lift * 6, -TS / 2 + 4 + lift * 9, TS, TS, 6); g.fill()
        g.fillStyle = t.light ? '#f0e2be' : '#bcd7ea'
        roundRect(g, -TS / 2, -TS / 2, TS, TS, 6); g.fill()
        g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke()
        g.fillStyle = INK
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.font = `800 ${Math.round(TS * 0.56)}px ${theme.fonts.display}, Arial, sans-serif`
        g.fillText(t.char, 0, 1)
        g.font = `700 ${Math.round(TS * 0.26)}px ${theme.fonts.body}, sans-serif`
        g.fillText(String(t.score), TS * 0.3, TS * 0.28)
        g.restore()
      }
    },
  }
}
