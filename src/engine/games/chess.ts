import { theme } from '../../config/theme'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A chess board you can actually play: drag pieces, legal-move hints, captures,
// alternating turns, pawn promotion. Casual rules — no castling/en-passant/check
// (it's a toy on a table, not a tournament).

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
interface Piece { t: PieceType; w: boolean }

const GLYPH: Record<PieceType, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
const SQ = 60
const N8 = 8
const HALF = (N8 * SQ) / 2

function startBoard(): (Piece | null)[] {
  const b: (Piece | null)[] = Array(64).fill(null)
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  back.forEach((t, c) => {
    b[c] = { t, w: false }
    b[56 + c] = { t, w: true }
  })
  for (let c = 0; c < 8; c++) {
    b[8 + c] = { t: 'P', w: false }
    b[48 + c] = { t: 'P', w: true }
  }
  return b
}

export function createChess(cx: number, cy: number): TableGame {
  let board = startBoard()
  let turn: 'w' | 'b' = 'w'
  let drag: { from: number; piece: Piece; x: number; y: number; legal: Set<number> } | null = null

  const cellAt = (x: number, y: number): number | null => {
    const c = Math.floor((x - (cx - HALF)) / SQ)
    const r = Math.floor((y - (cy - HALF)) / SQ)
    return c >= 0 && c < 8 && r >= 0 && r < 8 ? r * 8 + c : null
  }

  function legalMoves(i: number): Set<number> {
    const p = board[i]!
    const out = new Set<number>()
    const r = Math.floor(i / 8), c = i % 8
    const push = (rr: number, cc: number): boolean => {
      // returns true if the ray may continue past this square
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false
      const q = board[rr * 8 + cc]
      if (!q) { out.add(rr * 8 + cc); return true }
      if (q.w !== p.w) out.add(rr * 8 + cc)
      return false
    }
    const ray = (dr: number, dc: number): void => {
      let rr = r + dr, cc = c + dc
      while (push(rr, cc)) { rr += dr; cc += dc }
    }
    switch (p.t) {
      case 'P': {
        const dir = p.w ? -1 : 1
        const home = p.w ? 6 : 1
        if (r + dir >= 0 && r + dir <= 7 && !board[(r + dir) * 8 + c]) {
          out.add((r + dir) * 8 + c)
          if (r === home && !board[(r + 2 * dir) * 8 + c]) out.add((r + 2 * dir) * 8 + c)
        }
        for (const dc of [-1, 1]) {
          const rr = r + dir, cc = c + dc
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue
          const q = board[rr * 8 + cc]
          if (q && q.w !== p.w) out.add(rr * 8 + cc)
        }
        break
      }
      case 'N':
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) push(r + dr, c + dc)
        break
      case 'B': ray(-1, -1); ray(-1, 1); ray(1, -1); ray(1, 1); break
      case 'R': ray(-1, 0); ray(1, 0); ray(0, -1); ray(0, 1); break
      case 'Q': ray(-1, -1); ray(-1, 1); ray(1, -1); ray(1, 1); ray(-1, 0); ray(1, 0); ray(0, -1); ray(0, 1); break
      case 'K':
        for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) push(r + dr, c + dc)
        break
    }
    return out
  }

  function drawPiece(g: Ctx, p: Piece, x: number, y: number, size: number): void {
    g.font = `${size}px serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    if (p.w) {
      g.fillStyle = '#fbfaf4'
      g.strokeStyle = INK
      g.lineWidth = 2.5
      g.strokeText(GLYPH[p.t], x, y)
      g.fillText(GLYPH[p.t], x, y)
    } else {
      g.fillStyle = INK
      g.strokeStyle = '#fbfaf4'
      g.lineWidth = 1.4
      g.fillText(GLYPH[p.t], x, y)
      g.strokeText(GLYPH[p.t], x, y)
    }
  }

  return {
    id: 'chess',
    onDown(x, y) {
      const i = cellAt(x, y)
      if (i === null) return false
      const p = board[i]
      if (!p || p.w !== (turn === 'w')) return true // on the board: capture the tap, no pan
      drag = { from: i, piece: p, x, y, legal: legalMoves(i) }
      board[i] = null
      return true
    },
    onMove(x, y) {
      if (drag) { drag.x = x; drag.y = y }
    },
    onUp(x, y) {
      if (!drag) return
      const to = cellAt(x, y)
      if (to !== null && drag.legal.has(to)) {
        const r = Math.floor(to / 8)
        const promoted = drag.piece.t === 'P' && (r === 0 || r === 7)
        board[to] = promoted ? { t: 'Q', w: drag.piece.w } : drag.piece
        turn = turn === 'w' ? 'b' : 'w'
      } else {
        board[drag.from] = drag.piece // illegal → snap home
      }
      drag = null
    },
    update() { /* chess doesn't tick */ },
    draw(g) {
      // frame
      g.fillStyle = 'rgba(32,26,23,0.18)'
      roundRect(g, cx - HALF - 14 + 8, cy - HALF - 14 + 12, N8 * SQ + 28, N8 * SQ + 28, 10); g.fill()
      g.fillStyle = '#7a4e28'
      roundRect(g, cx - HALF - 14, cy - HALF - 14, N8 * SQ + 28, N8 * SQ + 28, 10); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // squares
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        g.fillStyle = (r + c) % 2 ? '#a9713f' : '#efdcb4'
        g.fillRect(cx - HALF + c * SQ, cy - HALF + r * SQ, SQ, SQ)
      }
      // legal-move hints while dragging
      if (drag) {
        const fc = drag.from % 8, fr = Math.floor(drag.from / 8)
        g.fillStyle = 'rgba(247, 201, 72, 0.45)'
        g.fillRect(cx - HALF + fc * SQ, cy - HALF + fr * SQ, SQ, SQ)
        for (const i of drag.legal) {
          const c2 = i % 8, r2 = Math.floor(i / 8)
          g.fillStyle = board[i] ? 'rgba(240,86,62,0.55)' : 'rgba(32,26,23,0.28)'
          g.beginPath()
          g.arc(cx - HALF + c2 * SQ + SQ / 2, cy - HALF + r2 * SQ + SQ / 2, board[i] ? SQ * 0.34 : SQ * 0.14, 0, Math.PI * 2)
          g.fill()
        }
      }
      // pieces
      for (let i = 0; i < 64; i++) {
        const p = board[i]
        if (!p) continue
        drawPiece(g, p, cx - HALF + (i % 8) * SQ + SQ / 2, cy - HALF + Math.floor(i / 8) * SQ + SQ / 2 + 2, SQ * 0.78)
      }
      // turn marker: a little pawn beside the board
      const mp: Piece = { t: 'P', w: turn === 'w' }
      drawPiece(g, mp, cx + HALF + 40, cy + (turn === 'w' ? HALF - 20 : -HALF + 20), 40)
      // dragged piece rides the cursor
      if (drag) drawPiece(g, drag.piece, drag.x, drag.y - 10, SQ * 0.9)
    },
  }
}

export { theme }
