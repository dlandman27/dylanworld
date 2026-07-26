# Co-op Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the chess board into a real two-player co-op game in a `?room=` session — claim a seat, moves sync host-authoritatively, everyone else watches live.

**Architecture:** A thin `coopSession` layer bridges `chess.ts` (rules + rendering, transport-free) and `net.ts` (transport). The room host holds authoritative game state in its own local `chess.ts` instance; guests send `gclaim`/`gmove`/`gleave`/`greset` intents and apply the host's `gstate` snapshots. Chess gets small seams (`applyMove`, `state`/`setState`, `isLegalMove`, a `ChessCoop` adapter) so co-op is layered on without touching its rules.

**Tech Stack:** TypeScript, Vite, HTML canvas 2D, `partysocket` (client), `partyserver` on a Cloudflare Durable Object, `wrangler`.

## Global Constraints

- **Single-player must be completely untouched.** With no room / `netConnected()` false, chess plays both sides locally exactly as today: no seats, no gating, no seat UI. Every co-op path is inert offline. Top safety property — verify after every task.
- **Message-field discipline:** the relay (`party/index.ts`) overwrites a message's `id` field with the sender's connection id. Application data never uses `id` — game id is `g`, squares are `from`/`to`, board is `board`, etc.
- **A client learns its own connection id** from the `role` message (extended to include `id`), so it can match itself against the seat map. Do not derive identity any other way.
- **Host-authoritative game state:** only the host mutates authoritative chess state (board, turn, seats); guests send intents and render the host's `gstate`. Reuse the existing `isHost()` role.
- **Synced game = chess only.** The `coopSession` layer is chess-aware for now (written with clean seams). Other games are untouched.
- **Casual rules unchanged:** no check/checkmate/castling/en-passant; pawn auto-promotes to queen exactly as today.
- **No new dependencies.** Repo has **no unit-test harness** (no `test` script). The automated gate for every task is `npm run check` (`tsc --noEmit`). Behavioral verification is a scripted **manual two-window test** (host tab + `?room=` guest tab), spelled out per task — run it exactly; do not invent a test runner.
- **Local dev:** `npm run party` (wrangler, :1999) + `npm run dev` (Vite). Two tabs to the same `?room=` URL to test.
- Match the terse top-of-file comment style and existing idioms of each file.

---

## File Structure

- `party/index.ts` — **modify.** Include the connection's own id in the `role` message.
- `src/engine/net.ts` — **modify.** Store/expose `myId()`; game-message transport (queue, drain, typed senders, `gstate` broadcaster); surface peer `leave` as a seat-free; reset on connect.
- `src/engine/games/chess.ts` — **modify.** Add co-op seams (`applyMove`, `state`/`setState`, `isLegalMove`, `turn`, `chessStartState`, a `ChessCoop` adapter param) without changing rules/rendering.
- `src/engine/games/coopSession.ts` — **create.** The bridge: seat map, host/guest authority step, claim/leave/move/reset, camera focus, seat/turn overlay. Exposes `createCoopChess(cx,cy)`, `stepCoop(dt)`, `coopFocus()`.
- `src/engine/games/index.ts` — **modify.** Register `createCoopChess` in place of `createChess`.
- `src/main.ts` — **modify.** Call `stepCoop(dt)` each frame and feed `coopFocus()` into the camera.

---

## Task 1: Client learns its own connection id

**Files:**
- Modify: `party/index.ts`
- Modify: `src/engine/net.ts`

**Interfaces:**
- Produces (wire): the DO's `role` message becomes `{t:'role', isHost, id}` where `id` is the recipient's own connection id.
- Produces (`net.ts`): `export function myId(): string` — the client's own connection id, `''` until the first `role` arrives.

- [ ] **Step 1: Include the connection id in `sendRole`**

In `party/index.ts`, update `sendRole`:

```ts
  // tell one connection whether it is the authoritative physics host, and its own id
  private sendRole(conn: Connection): void {
    conn.send(JSON.stringify({ t: 'role', isHost: conn.id === this.hostId, id: conn.id }))
  }
```

- [ ] **Step 2: Store and expose the id in `net.ts`**

Add module state near `let host = false` in `src/engine/net.ts`:

```ts
let selfId = ''
```

Update the `role` branch in the message handler to capture it (the handler already runs `role` before the `!m.id` guard):

```ts
    if (m.t === 'role') { host = !!m.isHost; if (typeof m.id === 'string') selfId = m.id; return }
```

Reset it in `connect()`, alongside the existing resets:

```ts
  host = false
  selfId = ''
  remoteMap.clear()
```

Add the accessor near `isHost()`:

```ts
export function myId(): string {
  return selfId
}
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Manual verification (two windows)**

`npm run party` + `npm run dev`. Open two tabs to `http://localhost:5173/?room=TEST`. In each tab's devtools, temporarily add nothing — instead confirm via the existing host chip that both connect (headcount reaches 2). The `id` propagation is exercised by Task 4; here just confirm `npm run check` passes and connecting still works (host chip shows "2 at the table"). Then confirm `http://localhost:5173/` (no room) is unaffected.

- [ ] **Step 5: Commit**

```bash
git add party/index.ts src/engine/net.ts
git commit -m "feat(coop): client learns its own connection id via role message

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Chess co-op seams (offline, no networking)

Pure refactor + new seams. With no adapter passed, chess plays exactly as today. This task adds no networking.

**Files:**
- Modify: `src/engine/games/chess.ts`

**Interfaces:**
- Produces (`chess.ts`):
  - `export type ChessColor = 'w' | 'b'`
  - `export interface ChessState { board: string; turn: ChessColor }` — `board` is 64 chars, one per square: piece letter (`KQRBNP`) upper-case for white, lower-case for black, `.` for empty; index 0 = top-left (rank shown at top), matching the existing `r*8+c` layout.
  - `export interface ChessCoop { enabled(): boolean; seated(): boolean; controls(t: ChessColor): boolean; onBoardDown(x: number, y: number): boolean; sendMove(from: number, to: number): void; drawOverlay(g: Ctx, cx: number, cy: number, half: number): void }`
  - `export interface ChessGame extends TableGame { state(): ChessState; setState(s: ChessState): void; applyMove(from: number, to: number): void; isLegalMove(from: number, to: number, color: ChessColor): boolean; turn(): ChessColor }`
  - `export function chessStartState(): ChessState`
  - `export function createChess(cx: number, cy: number, coop?: ChessCoop): ChessGame`

- [ ] **Step 1: Add types and the exported constants at the top of `chess.ts`**

Below the existing `interface Piece` line, add:

```ts
export type ChessColor = 'w' | 'b'
export interface ChessState { board: string; turn: ChessColor }

export interface ChessCoop {
  /** co-op is active (connected & in a room) */
  enabled(): boolean
  /** this client holds a seat */
  seated(): boolean
  /** this client holds the seat whose colour is to move */
  controls(t: ChessColor): boolean
  /** claim/spectate-focus/leave consumed this press — chess should not drag */
  onBoardDown(x: number, y: number): boolean
  /** this client just applied a legal move locally */
  sendMove(from: number, to: number): void
  /** draw the seat/turn/leave UI over the board (world coords) */
  drawOverlay(g: Ctx, cx: number, cy: number, half: number): void
}

export interface ChessGame extends TableGame {
  state(): ChessState
  setState(s: ChessState): void
  applyMove(from: number, to: number): void
  isLegalMove(from: number, to: number, color: ChessColor): boolean
  turn(): ChessColor
}
```

Add the `Ctx` import (chess.ts already imports from `./shared`): ensure the import line reads

```ts
import type { Ctx, TableGame } from './shared'
```

(It already imports `TableGame`; add `Ctx` if missing.)

- [ ] **Step 2: Add board (de)serialization helpers and `chessStartState`**

Below `startBoard()` in `chess.ts`, add:

```ts
const PIECE_LETTERS: PieceType[] = ['K', 'Q', 'R', 'B', 'N', 'P']

function serializeBoard(board: (Piece | null)[]): string {
  return board.map(p => (p ? (p.w ? p.t : p.t.toLowerCase()) : '.')).join('')
}

function parseBoard(s: string): (Piece | null)[] {
  return Array.from(s, ch => {
    if (ch === '.') return null
    const up = ch.toUpperCase() as PieceType
    return PIECE_LETTERS.includes(up) ? { t: up, w: ch === ch.toUpperCase() } : null
  })
}

export function chessStartState(): ChessState {
  return { board: serializeBoard(startBoard()), turn: 'w' }
}
```

- [ ] **Step 3: Add the `coop` param and the co-op seam methods inside `createChess`**

Change the signature:

```ts
export function createChess(cx: number, cy: number, coop?: ChessCoop): ChessGame {
```

Add a shared settle helper inside `createChess` (near `legalMoves`), used by both the local drag commit and remote `applyMove` so promotion/turn-flip live in one place:

```ts
  // place a piece on `to` (auto-queening a promoting pawn) and flip the turn
  function settle(piece: Piece, to: number): void {
    const r = Math.floor(to / 8)
    board[to] = piece.t === 'P' && (r === 0 || r === 7) ? { t: 'Q', w: piece.w } : piece
    turn = turn === 'w' ? 'b' : 'w'
  }
```

- [ ] **Step 4: Gate `onDown` through the coop adapter**

Replace the existing `onDown` in the returned object with:

```ts
    onDown(x, y) {
      if (coop?.enabled()) {
        if (coop.onBoardDown(x, y)) return true          // claim / spectate-focus / leave consumed it
        if (coop.seated() && !coop.controls(turn)) {
          return cellAt(x, y) !== null                    // not your turn: swallow board taps, allow off-board pan
        }
        if (!coop.seated()) return false                  // unseated + off-board: let the table pan
      }
      const i = cellAt(x, y)
      if (i === null) return false
      const p = board[i]
      if (!p || p.w !== (turn === 'w')) return true        // on the board: capture the tap, no pan
      drag = { from: i, piece: p, x, y, legal: legalMoves(i) }
      board[i] = null
      return true
    },
```

- [ ] **Step 5: Route `onUp` through `settle` and notify the adapter**

Replace the existing `onUp` with:

```ts
    onUp(x, y) {
      if (!drag) return
      const to = cellAt(x, y)
      const from = drag.from
      if (to !== null && drag.legal.has(to)) {
        settle(drag.piece, to)                             // board[from] already null from onDown
        drag = null
        if (coop?.enabled()) coop.sendMove(from, to)       // optimistic: state already applied locally
      } else {
        board[drag.from] = drag.piece                      // illegal → snap home
        drag = null
      }
    },
```

- [ ] **Step 6: Add the seam methods and the overlay hook to the returned object**

Add these properties to the returned object (e.g. after `onUp`, before `update`):

```ts
    state() {
      return { board: serializeBoard(board), turn }
    },
    setState(s) {
      board = parseBoard(s.board)
      turn = s.turn
      drag = null
    },
    applyMove(from, to) {
      const p = board[from]
      if (!p) return
      board[from] = null
      settle(p, to)
    },
    isLegalMove(from, to, color) {
      const p = board[from]
      if (!p || p.w !== (color === 'w') || turn !== color) return false
      return legalMoves(from).has(to)
    },
    turn() {
      return turn
    },
```

At the very end of `draw`, after the dragged-piece line, add the overlay hook:

```ts
      if (drag) drawPiece(g, drag.piece, drag.x, drag.y - 10, SQ * 0.9)
      coop?.drawOverlay(g, cx, cy, HALF)
```

(`board` and `turn` are `let` bindings already; `setState` reassigns them — confirm they are declared with `let`, which they are.)

- [ ] **Step 7: Type-check**

Run: `npm run check`
Expected: PASS. Note: `createChess` now returns `ChessGame` (a superset of `TableGame`), so `games/index.ts` still type-checks where it stores it as a `TableGame`.

- [ ] **Step 8: Manual verification — single-player chess unchanged**

`npm run dev`, open `http://localhost:5173/` (no room). Play several moves: drag a pawn two squares, capture a piece, promote a pawn to queen, drop a piece on an illegal square (it snaps home), confirm the turn marker alternates. Everything must behave exactly as before (no adapter is passed, so `coop` is `undefined`).

- [ ] **Step 9: Commit**

```bash
git add src/engine/games/chess.ts
git commit -m "refactor(coop): add chess co-op seams (state/applyMove/isLegalMove/adapter)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Game-message transport in `net.ts`

Adds the wire plumbing only — nothing calls it yet, so behavior is unchanged.

**Files:**
- Modify: `src/engine/net.ts`

**Interfaces:**
- Produces (`net.ts`):
  - `export interface GameMsg { t: string; id: string; g?: string; from?: number; to?: number; board?: string; turn?: 'w' | 'b'; seats?: { w: string | null; b: string | null } }`
  - `export function drainGameMessages(): GameMsg[]` — returns and clears received game messages (host receives intents; guests receive `gstate`; a peer `leave` surfaces as a synthetic `{t:'gleave', id}`).
  - `export function sendGameClaim(g: string): void`
  - `export function sendGameLeave(g: string): void`
  - `export function sendGameMove(g: string, from: number, to: number): void`
  - `export function sendGameReset(g: string): void`
  - `export function broadcastGameState(g: string, board: string, turn: 'w' | 'b', seats: { w: string | null; b: string | null }): void`
- Wire messages: `gclaim {g}`, `gleave {g}`, `gmove {g, from, to}`, `greset {g}` (relay stamps `id`); `gstate {g, board, turn, seats}` (host→all).

- [ ] **Step 1: Add the `GameMsg` type and the queue**

In `src/engine/net.ts`, add near the `SnapTarget` interface:

```ts
export interface GameMsg {
  t: string
  id: string
  g?: string
  from?: number
  to?: number
  board?: string
  turn?: 'w' | 'b'
  seats?: { w: string | null; b: string | null }
}
```

Add module state near `remoteGrabMap`:

```ts
const gameMsgQueue: GameMsg[] = []
```

Reset it in `connect()`, alongside the other resets:

```ts
  remoteGrabMap.clear()
  releaseQueue.length = 0
  gameMsgQueue.length = 0
```

- [ ] **Step 2: Extend the parsed-message type annotation**

In the message handler in `connect()`, extend the inline type of `m` to carry the game fields (append to the existing union):

```ts
    let m: { t?: string; id?: string; x?: number; y?: number; cur?: string; name?: string; isHost?: boolean; p?: number[][]; cx?: number; cy?: number; pid?: number; vx?: number; vy?: number; tap?: number; g?: string; from?: number; to?: number; board?: string; turn?: 'w' | 'b'; seats?: { w: string | null; b: string | null } }
```

- [ ] **Step 3: Queue game messages, and free seats on peer leave**

Add a branch in the handler (after the `snap`/`key` branch, before the handler closes):

```ts
    if (m.t === 'gclaim' || m.t === 'gleave' || m.t === 'gmove' || m.t === 'greset' || m.t === 'gstate') {
      gameMsgQueue.push(m as GameMsg)
      return
    }
```

Extend the existing `leave` branch so a departing peer's seat is freed by the game layer (add the push; keep the existing prop cleanup and `peerMap.delete`):

```ts
    if (m.t === 'leave') {
      const held = remoteGrabMap.get(m.id)
      if (held !== undefined) {
        releaseQueue.push({ pid: held, tap: false, vx: 0, vy: 0 })
        remoteGrabMap.delete(m.id)
      }
      gameMsgQueue.push({ t: 'gleave', id: m.id })   // free any seat this peer held
      peerMap.delete(m.id)
      return
    }
```

- [ ] **Step 4: Add drain + senders**

Add near `drainReleases()`:

```ts
/** Received game messages (host: intents; guest: gstate; plus peer-leave seat frees). */
export function drainGameMessages(): GameMsg[] {
  return gameMsgQueue.splice(0, gameMsgQueue.length)
}

export function sendGameClaim(g: string): void {
  socket?.send(JSON.stringify({ t: 'gclaim', g }))
}
export function sendGameLeave(g: string): void {
  socket?.send(JSON.stringify({ t: 'gleave', g }))
}
export function sendGameMove(g: string, from: number, to: number): void {
  socket?.send(JSON.stringify({ t: 'gmove', g, from, to }))
}
export function sendGameReset(g: string): void {
  socket?.send(JSON.stringify({ t: 'greset', g }))
}
export function broadcastGameState(g: string, board: string, turn: 'w' | 'b', seats: { w: string | null; b: string | null }): void {
  socket?.send(JSON.stringify({ t: 'gstate', g, board, turn, seats }))
}
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/net.ts
git commit -m "feat(coop): game-message transport (intents + gstate) in net.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `coopSession` — seats, authority, move sync (core play)

The bridge that makes co-op chess actually work. After this task, two windows can claim seats, play with turn-gating, and spectators see the game live. Full seat/turn overlay + leave/new-game/host-migration polish is Task 5; this task includes a **minimal** seat/turn overlay so the two-window test is observable.

**Files:**
- Create: `src/engine/games/coopSession.ts`
- Modify: `src/engine/games/index.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `net.ts` — `netConnected`, `isHost`, `myId`, `peers`, `drainGameMessages`, `sendGameClaim`, `sendGameLeave`, `sendGameMove`, `sendGameReset`, `broadcastGameState`, `GameMsg`. `chess.ts` — `createChess`, `chessStartState`, `ChessGame`, `ChessCoop`, `ChessColor`.
- Produces (`coopSession.ts`):
  - `export function createCoopChess(cx: number, cy: number): ChessGame`
  - `export function stepCoop(dt: number): void`
  - `export function coopFocus(): { x: number; y: number; zoom: number } | null`

- [ ] **Step 1: Create `src/engine/games/coopSession.ts`**

```ts
import type { Ctx } from './shared'
import { INK } from './shared'
import { theme } from '../../config/theme'
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
```

- [ ] **Step 2: Register the co-op board in `games/index.ts`**

In `src/engine/games/index.ts`, replace the chess import and its registration.

Change the import line:

```ts
import { createCoopChess } from './coopSession'
```

(remove the old `import { createChess } from './chess'` if it is only used for this registration; if `createChess` is used elsewhere in the file, keep it.)

Change the registration (currently `createChess(750, 2680)`):

```ts
    createCoopChess(750, 2680),
```

- [ ] **Step 3: Wire `stepCoop` and `coopFocus` into the frame loop in `main.ts`**

Add the import near the other game imports in `src/main.ts`:

```ts
import { stepCoop, coopFocus } from './engine/games/coopSession'
```

In `frame()`, feed co-op focus into the existing camera-follow block. Replace the `const drive = driveTarget() || droneTarget()` line and its follow block with:

```ts
  const coopF = coopFocus()
  const drive = driveTarget() || droneTarget() || (coopF ? { x: coopF.x, y: coopF.y } : null)
  if (drive && !input.panning) {
    const follow = 1 - Math.exp(-4 * dt)
    camera.pos.x += (drive.x - camera.pos.x) * follow
    camera.pos.y += (drive.y - camera.pos.y) * follow
    camera.vel.x = 0
    camera.vel.y = 0
  }
  if (coopF) camera.zoomTarget = coopF.zoom
```

Add the `stepCoop(dt)` call after the props net branch, just before `updateDayNight(dt)`:

```ts
  stepCoop(dt)
  updateDayNight(dt)
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Manual verification (two windows) — core co-op play**

`npm run party` + `npm run dev`. Tab A → `http://localhost:5173/?room=TEST` (host). Tab B → same URL (guest). Pan both to the chess board (bottom-left area). In **tab A**, click the board → you claim **white** ("white: you" shows, camera frames the board). In **tab B**, click the board → you claim **black**. Now: white moves in A → the move appears in B; black moves in B → appears in A. Confirm **turn-gating**: on white's turn, clicking pieces in B (black) does nothing; vice-versa. Open a **third** tab on the same room → it can watch pieces move but clicking the board neither claims (both seats full) nor moves anything. Confirm single-player (`http://localhost:5173/`, no room) still plays both sides with no seat text.

- [ ] **Step 6: Commit**

```bash
git add src/engine/games/coopSession.ts src/engine/games/index.ts src/main.ts
git commit -m "feat(coop): coopSession — seats, host authority, move sync

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Lifecycle & UI — leave, drop-in, new game, host migration, overlay

Completes the drop-in/drop-out lifecycle and the on-felt UI. Most wiring exists from Task 4 (Escape/leave chip, new-game chip, `gleave`-on-disconnect); this task verifies each end-to-end and refines the overlay into house style with the leave/new-game chips actually drawn.

**Files:**
- Modify: `src/engine/games/coopSession.ts`

**Interfaces:**
- Consumes: everything from Task 4 (same module).
- Produces: a finished `drawSeatUI` that draws the leave + new-game chips (whose hit-rects already exist) and clearer seat/turn labels.

- [ ] **Step 1: Draw the leave + new-game chips and refine labels**

Replace `drawSeatUI` in `coopSession.ts` with a version that renders the chips (only while seated) in house style — bold ink outline, card fill, hard offset shadow — using the existing `leaveRect()` / `newGameRect()` geometry so clicks line up:

```ts
function chip(g: Ctx, r: { x: number; y: number; w: number; h: number }, label: string): void {
  g.fillStyle = INK
  g.fillRect(r.x + 3, r.y + 3, r.w, r.h)                 // hard offset shadow
  g.fillStyle = theme.colors.card
  g.strokeStyle = INK
  g.lineWidth = 2.5
  g.fillRect(r.x, r.y, r.w, r.h)
  g.strokeRect(r.x, r.y, r.w, r.h)
  g.fillStyle = INK
  g.font = "800 13px ui-monospace, monospace"
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1)
}

function drawSeatUI(g: Ctx, gcx: number, gcy: number, half: number): void {
  const turn = game!.state().turn
  const mine = mySeat()
  // seat labels above the board, with the side-to-move highlighted
  g.font = "700 15px ui-monospace, monospace"
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillStyle = turn === 'w' ? theme.colors.coral : INK
  g.fillText(`white: ${seatName(seats.w)}${mine === 'w' ? '  ◀ you' : ''}`, gcx - half, gcy - half - 24)
  g.fillStyle = turn === 'b' ? theme.colors.coral : INK
  g.fillText(`black: ${seatName(seats.b)}${mine === 'b' ? '  ◀ you' : ''}`, gcx - half, gcy - half - 6)
  // turn dot, top-right of the board
  g.fillStyle = turn === 'w' ? '#fbfaf4' : INK
  g.strokeStyle = INK
  g.lineWidth = 2
  g.beginPath(); g.arc(gcx + half - 8, gcy - half - 15, 8, 0, Math.PI * 2); g.fill(); g.stroke()
  // seated players get leave + new-game chips below the board
  if (mine !== null) {
    chip(g, leaveRect(), 'leave')
    chip(g, newGameRect(), 'new game')
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Manual verification (two windows) — full lifecycle**

`npm run party` + `npm run dev`, tabs A (host) and B (guest) on `?room=TEST`, both seated (A white, B black).
- **Leave chip:** click "leave" in B → B's seat frees ("black: open" in both tabs), B returns to free-roam; B clicks the board again → re-claims black.
- **Escape:** in A, press `Esc` while seated → A's white seat frees.
- **Disconnect drop-in:** re-seat both, then close tab B → in A "black: open" appears within a moment (seat freed on `leave`); open a fresh tab C on the room, click the board → C drops into black and the game continues from the current position (board did not reset).
- **New game:** with both seated, click "new game" in either → both boards reset to the start position, white to move.
- **Host migration:** re-seat both; close tab A (the host). Tab B is promoted; confirm B can still move on its turn and a new guest tab sees B's authoritative board (the game continues from where it was).
- **Offline:** `http://localhost:5173/` (no room) → chess plays both sides, no seat labels or chips.

- [ ] **Step 4: Update `TODO.md`**

Under `## Multiplayer — PartyKit`, mark Phase 2 shipped in the Phase 1 style and note remaining co-op toys. Change the Phase 2 line to `[x]` with a "SHIPPED" note (co-op chess: 2 seats, host-authoritative moves, live spectating, drop-in/out) and add a follow-up bullet for extending the seat layer to dice/cards/backgammon.

- [ ] **Step 5: Commit**

```bash
git add src/engine/games/coopSession.ts TODO.md
git commit -m "feat(coop): seat/turn overlay, leave/new-game chips; mark Phase 2 shipped

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes (spec coverage)

- **Interaction model — click behaviour by seat (spec §Interaction Model):** Task 2 `onDown` gating + Task 4 `adapter.onBoardDown`/`claimOrFocus`. ✓
- **Seat/session layer (spec §Component 1):** Task 4 `coopSession` (seat map, claim/leave, camera focus, input gating), Task 5 overlay + Esc. ✓
- **Chess changes (spec §Component 2):** Task 2 (`applyMove`, `state`/`setState`, `isLegalMove`, `turn`, `chessStartState`, `ChessCoop` param, `drawOverlay` hook). ✓
- **Netcode host-authoritative game state (spec §Component 3):** Task 1 (`role` id), Task 3 (transport), Task 4 (host authority in `handleMsg`, `gstate` keyframe, guest apply). ✓
- **Client learns its id (spec §Component 3):** Task 1. ✓
- **Spectators / ambient board (spec §Component 4):** free via `gstate` apply on guests (Task 4); full-board click = spectate-focus (`claimOrFocus` when seats full still focuses, no seat assigned). ✓
- **Edge cases (spec §Error Handling):** single-player inert (`enabled()` guard, Tasks 2/4), both seats full (assignSeat no-op), disconnect frees seat (Task 3 `leave`→`gleave` + Task 4 `freeSeat`), illegal/out-of-turn dropped (`isLegalMove` in host `handleMsg`), host migration (guest holds last `gstate`, becomes authority), claim race (host assigns in arrival order). ✓
- **Testing (spec §Testing):** `npm run check` + scripted two-window manual test per task. ✓
- **Reset on (re)connect (spec §Component 3):** Task 1 `selfId`, Task 3 `gameMsgQueue`, Task 4 `stepCoop` clears seats offline. ✓
