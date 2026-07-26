import type { Ctx } from './shared'
import { INK, roundRect } from './shared'

// Shared 3D bookcase drawn against the wall (front elevation with a perspective
// top): a thick overhanging LEDGE (lit top face + shaded front thickness), a
// framed open SHELF (side posts + dark back panel + standing books, with the
// ledge casting shadow over them), and little LEGS. The aquarium + curio shelves
// both draw this, then stand their own items on top at `itemBaseY`.

const FRAME = '#7a4e28', WOOD_FACE = '#ad7a41', LEDGE_TOP = '#cf9856', LEDGE_FRONT = '#9c6b34', BACK = '#4a2f16', LEG = '#6e4522'

export interface CabinetBook { col: string; hh: number; lean: number; tip: number }
export interface CabinetLayout {
  cx: number; cy: number; w: number
  caseL: number; caseR: number; caseTop: number; caseBot: number
  ledgeL: number; ledgeR: number; ledgeTopY: number; ledgeBackY: number; ledgeTh: number; inset: number
  post: number; legH: number
  itemBaseY: number; itemLeft: number; itemRight: number; topY: number; footHalf: number
}

const POST = 30, LEG_H = 32, LEDGE_TH = 26, LEDGE_DEPTH = 78, OVH = 16, INSET = 26, CASE_H = 188

export function cabinetLayout(cx: number, cy: number, w: number): CabinetLayout {
  const halfW = w / 2
  const caseBot = cy - LEG_H
  const caseTop = caseBot - CASE_H
  const ledgeTopY = caseTop - LEDGE_TH
  const ledgeBackY = ledgeTopY - LEDGE_DEPTH
  const ledgeL = cx - halfW - OVH, ledgeR = cx + halfW + OVH
  return {
    cx, cy, w, caseL: cx - halfW, caseR: cx + halfW, caseTop, caseBot,
    ledgeL, ledgeR, ledgeTopY, ledgeBackY, ledgeTh: LEDGE_TH, inset: INSET, post: POST, legH: LEG_H,
    itemBaseY: ledgeBackY + 20, itemLeft: ledgeL + INSET + 26, itemRight: ledgeR - INSET - 26,
    topY: ledgeBackY, footHalf: halfW + OVH,
  }
}

export function drawCabinet(g: Ctx, L: CabinetLayout, books: CabinetBook[]): void {
  const caseW = L.caseR - L.caseL, caseTall = L.caseBot - L.caseTop
  // cast shadow of the whole piece
  g.fillStyle = 'rgba(32,26,23,0.22)'
  roundRect(g, L.ledgeL + 12, L.ledgeBackY + 16, L.ledgeR - L.ledgeL, L.cy - L.ledgeBackY, 14); g.fill()

  // ---- legs ----
  g.fillStyle = LEG; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  for (const lx of [L.caseL + 34, L.caseR - 34 - 30]) { roundRect(g, lx, L.caseBot - 4, 30, L.legH + 6, 5); g.fill(); g.stroke() }

  // ---- open shelf: dark back panel, books, framing posts, ledge shadow ----
  g.fillStyle = BACK; roundRect(g, L.caseL, L.caseTop, caseW, caseTall, 6); g.fill()
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
  // books standing on the shelf floor, inside the posts
  const innerL = L.caseL + L.post + 8, innerR = L.caseR - L.post - 8, n = books.length
  let bx = innerL
  const bw = (innerR - innerL) / n - 4
  for (const b of books) {
    g.save(); g.translate(bx + bw / 2, L.caseBot - 12); g.rotate(b.lean + b.tip * 0.4)
    g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, -bw / 2 + 3, -b.hh, bw, b.hh, 4); g.fill()
    g.fillStyle = b.col; roundRect(g, -bw / 2, -b.hh, bw, b.hh, 4); g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-bw / 2 + 4, -b.hh + 12); g.lineTo(-bw / 2 + 4, -10); g.stroke()
    g.fillStyle = '#fefaf0'; roundRect(g, -bw / 2 + 3, -b.hh, bw - 6, 7, 2); g.fill()
    g.restore(); bx += bw + 4
  }
  // ledge underside casts shadow over the top of the books
  g.fillStyle = 'rgba(0,0,0,0.34)'; g.fillRect(L.caseL, L.caseTop, caseW, 20)
  // framing side posts (in front of the books)
  g.fillStyle = WOOD_FACE; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  roundRect(g, L.caseL, L.caseTop, L.post, caseTall, 4); g.fill(); g.stroke()
  roundRect(g, L.caseR - L.post, L.caseTop, L.post, caseTall, 4); g.fill(); g.stroke()
  g.fillStyle = 'rgba(32,26,23,0.14)'; g.fillRect(L.caseR - L.post, L.caseTop, L.post, caseTall)   // right post in shade
  for (const px of [L.caseL + L.post * 0.5, L.caseR - L.post * 0.5]) { g.strokeStyle = 'rgba(74,48,22,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, L.caseTop + 10); g.lineTo(px, L.caseBot - 10); g.stroke() }
  // bottom rail
  g.fillStyle = FRAME; roundRect(g, L.caseL, L.caseBot - 16, caseW, 20, 4); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()

  // ---- the projecting ledge ----
  // front face (the plank's thickness)
  g.fillStyle = LEDGE_FRONT; roundRect(g, L.ledgeL, L.ledgeTopY, L.ledgeR - L.ledgeL, L.ledgeTh + 6, 6); g.fill()
  g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
  // lit top face, receding to the wall
  g.fillStyle = LEDGE_TOP
  g.beginPath(); g.moveTo(L.ledgeL, L.ledgeTopY); g.lineTo(L.ledgeR, L.ledgeTopY); g.lineTo(L.ledgeR - L.inset, L.ledgeBackY); g.lineTo(L.ledgeL + L.inset, L.ledgeBackY); g.closePath(); g.fill()
  g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
  // grain lines running front→back across the top
  g.strokeStyle = 'rgba(74,48,22,0.26)'; g.lineWidth = 2
  for (const k of [0.28, 0.5, 0.72]) {
    const fxF = L.ledgeL + (L.ledgeR - L.ledgeL) * k, fxB = L.ledgeL + L.inset + (L.ledgeR - L.ledgeL - 2 * L.inset) * k
    g.beginPath(); g.moveTo(fxF, L.ledgeTopY - 3); g.lineTo(fxB, L.ledgeBackY + 3); g.stroke()
  }
}
