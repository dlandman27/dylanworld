import { theme } from '../../config/theme'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// A scattered hand of playing cards: drag them anywhere on the table, tap one
// to flip it over. Face-down cards show the patterned back.

interface Card { x: number; y: number; rot: number; up: boolean; rank: string; suit: string; red: boolean }

const CW = 62, CH = 90

export function createCards(cx: number, cy: number): TableGame {
  const deal: [string, string, boolean][] = [
    ['A', '♠', false], ['K', '♥', true], ['Q', '♣', false], ['J', '♦', true],
    ['7', '♠', false], ['3', '♥', true], ['9', '♦', true],
  ]
  const cards: Card[] = deal.map(([rank, suit, red], i) => ({
    x: cx + (i - 3) * 46 + (i % 3) * 8,
    y: cy + ((i * 37) % 60) - 30,
    rot: ((i * 53) % 40 - 20) / 100,
    up: i < 4,
    rank, suit, red,
  }))
  let grab: { card: Card; dx: number; dy: number; moved: boolean } | null = null

  const hit = (c: Card, x: number, y: number): boolean => {
    const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot)
    const lx = (x - c.x) * cos - (y - c.y) * sin
    const ly = (x - c.x) * sin + (y - c.y) * cos
    return Math.abs(lx) < CW / 2 + 4 && Math.abs(ly) < CH / 2 + 4
  }

  return {
    id: 'cards',
    onDown(x, y) {
      for (let i = cards.length - 1; i >= 0; i--) {
        if (hit(cards[i], x, y)) {
          const c = cards[i]
          cards.splice(i, 1)
          cards.push(c) // bring to top
          grab = { card: c, dx: x - c.x, dy: y - c.y, moved: false }
          return true
        }
      }
      return false
    },
    onMove(x, y) {
      if (!grab) return
      const nx = x - grab.dx, ny = y - grab.dy
      if (Math.hypot(nx - grab.card.x, ny - grab.card.y) > 5) grab.moved = true
      grab.card.x = nx
      grab.card.y = ny
    },
    onUp() {
      if (grab && !grab.moved) grab.card.up = !grab.card.up // tap = flip
      grab = null
    },
    update() { /* cards lie still */ },
    draw(g) {
      for (const c of cards) {
        g.save()
        g.translate(c.x, c.y)
        g.rotate(c.rot)
        g.fillStyle = 'rgba(32,26,23,0.18)'
        roundRect(g, -CW / 2 + 3, -CH / 2 + 5, CW, CH, 8); g.fill()
        g.fillStyle = '#fbfaf4'
        roundRect(g, -CW / 2, -CH / 2, CW, CH, 8); g.fill()
        g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
        if (c.up) {
          g.fillStyle = c.red ? '#c0392b' : INK
          g.textAlign = 'left'; g.textBaseline = 'top'
          g.font = `800 17px ${theme.fonts.display}, sans-serif`
          g.fillText(c.rank, -CW / 2 + 6, -CH / 2 + 5)
          g.font = '19px serif'
          g.fillText(c.suit, -CW / 2 + 6, -CH / 2 + 23)
          g.textAlign = 'center'; g.textBaseline = 'middle'
          g.font = '34px serif'
          g.fillText(c.suit, 0, 6)
        } else {
          // patterned back
          g.fillStyle = theme.colors.coral
          roundRect(g, -CW / 2 + 6, -CH / 2 + 6, CW - 12, CH - 12, 5); g.fill()
          g.strokeStyle = 'rgba(255,255,255,0.7)'
          g.lineWidth = 1.5
          for (let k = -2; k <= 2; k++) {
            g.beginPath(); g.moveTo(-CW / 2 + 8, k * 14); g.lineTo(CW / 2 - 8, k * 14 + 10); g.stroke()
          }
          g.lineWidth = 2; g.strokeStyle = INK
          roundRect(g, -CW / 2 + 6, -CH / 2 + 6, CW - 12, CH - 12, 5); g.stroke()
        }
        g.restore()
      }
    },
  }
}
