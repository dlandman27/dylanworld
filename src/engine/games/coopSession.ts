import type { Ctx } from './shared'
import { INK } from './shared'
import { createChess, chessStartState } from './chess'
import type { ChessGame, ChessCoop, ChessColor } from './chess'
import {
  netConnected, isHost, myId, peers, drainGameMessages,
  sendGameClaim, sendGameLeave, sendGameMove, sendGameReset, broadcastGameState,
} from '../net'
import type { GameMsg } from '../net'

// Co-op wrapper for the chess board. The room host holds authoritative state in
// its own chess instance; guests send intents and render the host's gstate.
// Chess-aware for now (one board); written to generalise to other seat games.

const GAME_ID = 'chess'
const SQ = 60
const HALF = (SQ * 8) / 2        // matches chess.ts geometry (240)

let game: ChessGame | null = null
let cx = 0
let cy = 0
let seats: { w: string | null; b: string | null } = { w: null, b: null }
let lastKey = 0
let focusUntil = 0

// ---- seat helpers ----
function mySeat(): ChessColor | null {
  const id = myId()
  if (id && seats.w === id) return 'w'
  if (id && seats.b === id) return 'b'
  return null
}

// ---- host-authoritative ops ----
function broadcastState(): void {
  if (!game) return
  const s = game.state()
  broadcastGameState(GAME_ID, s.board, s.turn, seats)
}
function assignSeat(id: string): void {
  if (seats.w === id || seats.b === id) return
  if (!seats.w) seats.w = id
  else if (!seats.b) seats.b = id
  else return
  broadcastState()
}
function freeSeat(id: string): void {
  let changed = false
  if (seats.w === id) { seats.w = null; changed = true }
  if (seats.b === id) { seats.b = null; changed = true }
  if (changed) broadcastState()
}

// ---- geometry ----
function insideBoard(x: number, y: number): boolean {
  return x >= cx - HALF && x <= cx + HALF && y >= cy - HALF && y <= cy + HALF
}
const LEAVE = { w: 88, h: 26 }
function leaveRect(): { x: number; y: number; w: number; h: number } {
  return { x: cx - HALF, y: cy + HALF + 16, w: LEAVE.w, h: LEAVE.h }
}
const NEWGAME = { w: 96, h: 26 }
function newGameRect(): { x: number; y: number; w: number; h: number } {
  return { x: cx + HALF - NEWGAME.w, y: cy + HALF + 16, w: NEWGAME.w, h: NEWGAME.h }
}
function hit(r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

// ---- camera focus ----
function focusOnBoard(): void {
  focusUntil = performance.now() + 700
}
export function coopFocus(): { x: number; y: number; zoom: number } | null {
  if (performance.now() > focusUntil) return null
  return { x: cx, y: cy, zoom: 1.1 }
}

// ---- claim / leave / move (branch on host vs guest) ----
function claimOrFocus(): void {
  focusOnBoard()
  if (isHost()) assignSeat(myId())
  else sendGameClaim(GAME_ID)
}
function leave(): void {
  if (isHost()) freeSeat(myId())
  else sendGameLeave(GAME_ID)
}
function resetGame(): void {
  if (isHost()) { game?.setState(chessStartState()); broadcastState() }
  else sendGameReset(GAME_ID)
}

// ---- the adapter chess.ts talks to ----
const adapter: ChessCoop = {
  enabled: () => netConnected(),
  seated: () => mySeat() !== null,
  controls: (t) => mySeat() === t,
  onBoardDown(x, y) {
    if (mySeat() === null) {
      if (insideBoard(x, y)) { claimOrFocus(); return true }
      return false                                  // off-board while unseated → allow pan
    }
    if (hit(leaveRect(), x, y)) { leave(); return true }
    if (hit(newGameRect(), x, y)) { resetGame(); return true }
    return false                                    // let chess handle the piece drag
  },
  sendMove(from, to) {
    if (isHost()) broadcastState()                  // host already applied in onUp
    else sendGameMove(GAME_ID, from, to)            // guest: optimistic apply done, host reconciles
  },
  drawOverlay(g, gcx, gcy, half) {
    if (!netConnected() || !game) return
    drawSeatUI(g, gcx, gcy, half)
  },
}

// ---- per-frame step (called from main.ts) ----
export function stepCoop(dt: number): void {
  void dt
  if (!netConnected()) { seats = { w: null, b: null }; return }
  for (const m of drainGameMessages()) handleMsg(m)
  if (isHost() && game) {
    const now = performance.now()
    if (now - lastKey > 2000) { lastKey = now; broadcastState() }  // keyframe for late joiners
  }
}

function handleMsg(m: GameMsg): void {
  if (isHost()) {
    if (m.t === 'gclaim') assignSeat(m.id)
    else if (m.t === 'gleave') freeSeat(m.id)
    else if (m.t === 'greset') { if ((seats.w === m.id || seats.b === m.id) && game) { game.setState(chessStartState()); broadcastState() } }
    else if (m.t === 'gmove' && game && typeof m.from === 'number' && typeof m.to === 'number') {
      const color: ChessColor | null = seats.w === m.id ? 'w' : seats.b === m.id ? 'b' : null
      if (color && game.isLegalMove(m.from, m.to, color)) { game.applyMove(m.from, m.to); broadcastState() }
    }
  } else if (m.t === 'gstate' && game && typeof m.board === 'string' && (m.turn === 'w' || m.turn === 'b')) {
    game.setState({ board: m.board, turn: m.turn })
    if (m.seats) seats = { w: m.seats.w ?? null, b: m.seats.b ?? null }
  }
}

// ---- seat/turn overlay (minimal here; refined in Task 5) ----
function seatName(id: string | null): string {
  if (!id) return 'open'
  if (id === myId()) return 'you'
  return peers().get(id)?.name ?? 'player'
}
function drawSeatUI(g: Ctx, gcx: number, gcy: number, half: number): void {
  const turn = game!.state().turn
  g.font = "700 15px ui-monospace, monospace"
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillStyle = INK
  g.fillText(`white: ${seatName(seats.w)}`, gcx - half, gcy - half - 22)
  g.fillText(`black: ${seatName(seats.b)}`, gcx - half, gcy - half - 4)
  // turn dot
  g.fillStyle = turn === 'w' ? '#fbfaf4' : INK
  g.strokeStyle = INK
  g.lineWidth = 2
  g.beginPath(); g.arc(gcx + half - 8, gcy - half - 13, 8, 0, Math.PI * 2); g.fill(); g.stroke()
}

// ---- factory: build chess wired to this session ----
export function createCoopChess(gcx: number, gcy: number): ChessGame {
  cx = gcx
  cy = gcy
  game = createChess(gcx, gcy, adapter)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mySeat() !== null) leave()
  })
  return game
}

