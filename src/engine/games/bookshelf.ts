import { theme } from '../../config/theme'
import { projects } from '../../config/projects'
import type { ProjectEntry } from '../../types'
import { spark, registerObstacleProvider } from '../physics'
import type { TableGame } from './shared'
import { INK, roundRect } from './shared'

// A low bookcase against the top wall, seen from above: a wooden case packed
// with standing books — you're looking at their top edges. One book per project;
// pull a book toward the room and its paper card pops open, push it home (or
// dismiss the card) to shelve it. A couple of books lie flat on top of the row
// like someone gave up shelving them.

const CASE_H = 330
const OUT = 64            // how far a pulled book slides toward the room
const MARGIN = 40         // gap from the case wall to the first/last book
const GAP = 6             // gap between books
const BW = 58             // slim, book-like width per project

export type BookshelfGame = TableGame & { closeBook: () => void }

interface Book { x: number; w: number; color: string; depth: number; project: ProjectEntry; out: number; target: number }

export function createBookshelf(
  cx: number,
  cy: number,
  onOpen: (p: ProjectEntry) => void,
  onClose: () => void,
): BookshelfGame {
  const COLORS = [
    theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple,
    theme.colors.orange, theme.colors.teal, '#f7c948', theme.colors.pink, '#5a6bb0',
  ]

  // one book per project. The case is sized to wrap the row (never a fixed width),
  // so adding or removing projects grows/shrinks the shelf to fit.
  const n = projects.length
  const rowW = BW * n + GAP * (n - 1)
  const CASE_W = rowW + MARGIN * 2
  const x0 = cx - CASE_W / 2, y0 = cy - CASE_H / 2
  const books: Book[] = projects.map((project, i) => ({
    x: x0 + MARGIN + i * (BW + GAP),
    w: BW,
    color: COLORS[i % COLORS.length],
    depth: CASE_H - 96 - ((i * 37) % 44),   // deterministic slight stagger
    project,
    out: 0, target: 0,
  }))

  let openIdx = -1        // which book is pulled out / card open (-1 = none)

  // three collision boxes spanning the case, their outer edges flush with it
  const ob = CASE_W / 2 - CASE_H / 2
  registerObstacleProvider(() => [
    { x: cx - ob, y: cy, half: CASE_H / 2 },
    { x: cx, y: cy, half: CASE_H / 2 },
    { x: cx + ob, y: cy, half: CASE_H / 2 },
  ])

  const shelveOpen = (): void => {
    if (openIdx >= 0) books[openIdx].target = 0
    openIdx = -1
  }

  return {
    id: 'bookshelf',
    closeBook: shelveOpen,   // the card dismissing pushes the book home
    onDown(x, y) {
      if (x < x0 - 8 || x > x0 + CASE_W + 8 || y < y0 - 8 || y > y0 + CASE_H + 60) return false
      for (let i = 0; i < books.length; i++) {
        const b = books[i]
        if (x > b.x - 3 && x < b.x + b.w + 3 && y > y0 && y < y0 + CASE_H + b.out) {
          spark(b.x + b.w / 2, y0 + CASE_H, 0.08)
          if (i === openIdx) {                 // press the open book → shelve + close card
            shelveOpen()
            onClose()
          } else {                             // pull this one out, push any other home
            if (openIdx >= 0) books[openIdx].target = 0
            b.target = OUT
            openIdx = i
            onOpen(b.project)
          }
          return true
        }
      }
      return true   // capture presses on the case so the table doesn't pan
    },
    onMove() {},
    onUp() {},
    update(dt) {
      for (const b of books) b.out += (b.target - b.out) * Math.min(1, dt * 10)
    },
    draw(g) {
      // case: dark walnut frame with a lighter well the books sit in
      g.fillStyle = 'rgba(32,26,23,0.24)'
      roundRect(g, x0 + 8, y0 + 11, CASE_W, CASE_H, 16); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, x0, y0, CASE_W, CASE_H, 16); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = '#5c3a1e'
      roundRect(g, x0 + 20, y0 + 20, CASE_W - 40, CASE_H - 40, 10); g.fill()
      g.lineWidth = 2.5; g.stroke()

      // the books: top edges, leaning on each other, sliding out when pulled
      for (const b of books) {
        const top = y0 + 34 + b.out
        g.fillStyle = 'rgba(32,26,23,0.2)'
        roundRect(g, b.x + 3, top + 4, b.w, b.depth, 4); g.fill()
        g.fillStyle = b.color
        roundRect(g, b.x, top, b.w, b.depth, 4); g.fill()
        g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
        // pages: a cream strip along the room-side end
        g.fillStyle = '#fefaf0'
        roundRect(g, b.x + 4, top + b.depth - 16, b.w - 8, 12, 3); g.fill()
        g.lineWidth = 1.6; g.stroke()

        // title down the cover, so you can read the shelf at a glance
        g.save()
        g.beginPath(); roundRect(g, b.x, top, b.w, b.depth, 4); g.clip()
        g.translate(b.x + b.w / 2, top + (b.depth - 12) / 2)
        g.rotate(-Math.PI / 2)
        g.fillStyle = '#fefaf0'
        g.font = `700 ${Math.min(15, b.w * 0.32)}px ${theme.fonts.body}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText(fit(g, b.project.title, b.depth - 30), 0, 0)
        g.restore()
      }
    },
  }
}

// truncate text with an ellipsis so a long title never spills past the book
function fit(g: CanvasRenderingContext2D, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s + '…'
}
