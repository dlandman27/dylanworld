# PartyKit Presence (Multiplayer Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Host a table" → share a `?room=XXXX` link → everyone at that table sees everyone else's cursors moving live, each rendered as that player's equipped cursor-arcade skin with a playful name tag.

**Architecture:** A tiny PartyKit room server relays presence messages (it holds no game state). The client connects only when a room is in the URL, broadcasts its cursor's world position at ≤20 Hz, and keeps a peer map. Remote cursors render in a screen-space pass above everything, interpolated toward their latest target. Phase 1 is presence-only: peers are ghosts — their physics don't affect your table.

**Tech Stack:** PartyKit (server, dev CLI, hosting), partysocket (client WebSocket), existing Vite + TS app. No test framework exists in this repo — every task gates on `npx tsc --noEmit && npx vite build` plus a stated manual check (two browser tabs).

## Global Constraints

- One file per concern; NO game/net logic in `physics.ts`/`input.ts` beyond the calls specified here.
- House style for any UI: ink `#201a17` borders, hard offset shadows (no blur), `--card`/`--paper` palette vars, fonts via `--font-display`/`--font-body`/`--font-mono`. NO emoji.
- Remote cursors draw at constant SCREEN size (like real pointers), anchored to world positions.
- Wire format is JSON text; every message has a `t` discriminator field.
- Verification commands run from repo root `C:\Users\dylan\Documents\projects\dylanworld`.

---

### Task 1: PartyKit server + scripts

**Files:**
- Create: `party/index.ts`
- Create: `partykit.json`
- Modify: `package.json` (deps + scripts)

**Interfaces:**
- Produces: a room server at `/party/:room` that (a) stamps every client message with the sender's connection id and rebroadcasts it to everyone else, (b) broadcasts `{t:'leave', id}` when someone disconnects.
- Wire messages (Task 2 depends on these exact shapes):
  - client → server: `{t:'c', x:number, y:number, cur:string, name:string}`
  - server → others: same object plus `id:string`
  - server → all on disconnect: `{t:'leave', id:string}`

- [ ] **Step 1: Install dependencies**

Run: `npm install partysocket && npm install -D partykit`
Expected: both appear in `package.json` (`partysocket` in dependencies, `partykit` in devDependencies).

- [ ] **Step 2: Write the room server**

Create `party/index.ts`:

```ts
import type * as Party from 'partykit/server'

// Presence relay for a table. Holds no state: stamps each message with the
// sender's id and fans it out to everyone else in the room. Disconnects are
// announced so clients can drop the peer immediately.
export default class Table implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onMessage(message: string, sender: Party.Connection): void {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(message) as Record<string, unknown>
    } catch {
      return // garbage in, nothing out
    }
    parsed.id = sender.id
    this.room.broadcast(JSON.stringify(parsed), [sender.id])
  }

  onClose(conn: Party.Connection): void {
    this.room.broadcast(JSON.stringify({ t: 'leave', id: conn.id }))
  }
}

Table satisfies Party.Worker
```

- [ ] **Step 3: PartyKit config**

Create `partykit.json`:

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "dylanworld",
  "main": "party/index.ts",
  "compatibilityDate": "2026-07-20"
}
```

- [ ] **Step 4: npm script for the party dev server**

In `package.json` `"scripts"`, add:

```json
"party": "partykit dev"
```

- [ ] **Step 5: Keep the app typecheck clean**

Check `tsconfig.json`: if it has an `"include"` limited to `src`, `party/` is already excluded — done. If it typechecks the whole repo, add `"party"` to an `"exclude"` array (PartyKit's CLI typechecks the server itself with its own types).
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Smoke-run the party server**

Run: `npx partykit dev` (background or second terminal)
Expected: banner with `Ready on http://127.0.0.1:1999`. Stop it (or leave running for Task 5's check).

- [ ] **Step 7: Commit**

```bash
git add party partykit.json package.json package-lock.json tsconfig.json
git commit -m "feat: partykit presence relay server"
```

---

### Task 2: Client net module

**Files:**
- Create: `src/engine/net.ts`

**Interfaces:**
- Consumes: wire shapes from Task 1; `equippedId()` from `./cursor` (already exported).
- Produces (Tasks 3–5 rely on these exact signatures):
  - `interface Peer { id: string; name: string; cur: string; x: number; y: number; tx: number; ty: number; lastSeen: number }`
    (`x,y` = rendered/interpolated position; `tx,ty` = latest network target, both world coords)
  - `initNet(): void` — reads `?room=` from URL; connects if present, else no-ops
  - `netConnected(): boolean`
  - `roomCode(): string | null`
  - `hostRoom(): string` — generates a 4-char code, pushes `?room=` into the URL, connects, returns the code
  - `sendCursor(x: number, y: number): void` — throttled internally; safe to call every frame
  - `peers(): Map<string, Peer>`
  - `myName(): string`

- [ ] **Step 1: Write the module**

Create `src/engine/net.ts`:

```ts
import PartySocket from 'partysocket'
import { equippedId } from './cursor'

// Phase-1 presence networking. Connects only when a room code is in the URL,
// broadcasts this cursor at <=20Hz, and keeps an interpolation-ready peer map.
// Peers are ghosts: nothing here touches physics or games.

export interface Peer {
  id: string
  name: string
  cur: string
  x: number      // rendered (interpolated) world position
  y: number
  tx: number     // latest network target
  ty: number
  lastSeen: number
}

const HOST =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'localhost:1999'
    : 'dylanworld.dlandman27.partykit.dev' // confirmed/updated at deploy (Task 6)

const ADJ = ['lucky', 'coral', 'wobbly', 'shiny', 'sneaky', 'golden', 'dizzy', 'tiny', 'brave', 'noisy']
const NOUN = ['marble', 'die', 'pawn', 'domino', 'top', 'coin', 'chip', 'block', 'duck', 'card']

const name = `${ADJ[(Math.random() * ADJ.length) | 0]} ${NOUN[(Math.random() * NOUN.length) | 0]}`
const peerMap = new Map<string, Peer>()
let socket: PartySocket | null = null
let room: string | null = null
let lastSend = 0
let lastX = 0
let lastY = 0

function connect(code: string): void {
  room = code
  socket = new PartySocket({ host: HOST, room: code })
  socket.addEventListener('message', (e: MessageEvent) => {
    let m: { t?: string; id?: string; x?: number; y?: number; cur?: string; name?: string }
    try { m = JSON.parse(e.data as string) } catch { return }
    if (!m.id) return
    if (m.t === 'leave') { peerMap.delete(m.id); return }
    if (m.t === 'c' && typeof m.x === 'number' && typeof m.y === 'number') {
      const existing = peerMap.get(m.id)
      if (existing) {
        existing.tx = m.x
        existing.ty = m.y
        existing.cur = m.cur ?? existing.cur
        existing.name = m.name ?? existing.name
        existing.lastSeen = performance.now()
      } else {
        peerMap.set(m.id, {
          id: m.id, name: m.name ?? 'someone', cur: m.cur ?? 'arrow-ink',
          x: m.x, y: m.y, tx: m.x, ty: m.y, lastSeen: performance.now(),
        })
      }
    }
  })
}

export function initNet(): void {
  const code = new URLSearchParams(location.search).get('room')
  if (code) connect(code.toUpperCase().slice(0, 8))
}

export function netConnected(): boolean {
  return socket !== null
}

export function roomCode(): string | null {
  return room
}

export function myName(): string {
  return name
}

export function hostRoom(): string {
  const code = Array.from({ length: 4 }, () =>
    'ABCDEFGHJKMNPQRSTVWXYZ23456789'[(Math.random() * 30) | 0]).join('')
  const url = new URL(location.href)
  url.searchParams.set('room', code)
  history.pushState(null, '', url)
  connect(code)
  return code
}

/** Call every frame with the cursor's world position; throttles itself. */
export function sendCursor(x: number, y: number): void {
  if (!socket) return
  const now = performance.now()
  if (now - lastSend < 50) return
  if (Math.hypot(x - lastX, y - lastY) < 2 && now - lastSend < 500) return
  lastSend = now
  lastX = x
  lastY = y
  socket.send(JSON.stringify({ t: 'c', x, y, cur: equippedId(), name }))
}

/** Live peer map; prune anyone silent for 30s before returning. */
export function peers(): Map<string, Peer> {
  const now = performance.now()
  for (const [id, p] of peerMap) {
    if (now - p.lastSeen > 30_000) peerMap.delete(id)
  }
  return peerMap
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: both exit 0. (Nothing imports the module yet — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add src/engine/net.ts
git commit -m "feat: presence net client (room connect, throttled cursor broadcast, peer map)"
```

---

### Task 3: Remote cursor rendering

**Files:**
- Create: `src/ui/peerCursors.ts`

**Interfaces:**
- Consumes: `peers()` + `Peer` from `../engine/net`; `CURSORS` from `../config/cursors` (array of `{id, draw(ctx), hot}`); `worldToScreen` from `../engine/world`; `CameraState` from `../types`.
- Produces: `drawPeerCursors(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void` — call once per frame AFTER everything else (screen-space pass; Task 5 wires it into `main.ts`).

- [ ] **Step 1: Write the renderer**

Create `src/ui/peerCursors.ts`:

```ts
import type { CameraState } from '../types'
import { peers } from '../engine/net'
import { CURSORS } from '../config/cursors'
import { theme } from '../config/theme'
import { worldToScreen } from '../engine/world'

// Ghost cursors of everyone else at the table: their equipped cursor sticker at
// constant screen size, a name tag underneath, eased toward the network target.
// Fades out when idle, gone after 30s (net.ts prunes).

const byId = new Map(CURSORS.map(c => [c.id, c]))
let lastFrame = performance.now()

export function drawPeerCursors(
  ctx: CanvasRenderingContext2D,
  cam: CameraState,
  canvas: HTMLCanvasElement,
): void {
  const now = performance.now()
  const dt = Math.min((now - lastFrame) / 1000, 0.1)
  lastFrame = now
  const ease = Math.min(1, dt * 14)

  for (const p of peers().values()) {
    p.x += (p.tx - p.x) * ease
    p.y += (p.ty - p.y) * ease
    const s = worldToScreen(cam, canvas, { x: p.x, y: p.y })
    if (s.x < -80 || s.y < -80 || s.x > canvas.width + 80 || s.y > canvas.height + 80) continue
    const idle = (now - p.lastSeen) / 1000
    const alpha = idle < 4 ? 1 : Math.max(0.25, 1 - (idle - 4) / 10)

    ctx.save()
    ctx.globalAlpha = alpha
    // the cursor sticker, ~40px on screen regardless of zoom
    const cur = byId.get(p.cur) ?? CURSORS[0]
    ctx.save()
    ctx.translate(s.x - cur.hot[0] * 1.25, s.y - cur.hot[1] * 1.25)
    ctx.scale(1.25, 1.25)
    cur.draw(ctx)
    ctx.restore()
    // name tag
    ctx.font = '700 11px ui-monospace, monospace'
    const w = ctx.measureText(p.name).width + 12
    const tx = s.x - w / 2
    const ty = s.y + 30
    ctx.fillStyle = theme.colors.card
    ctx.strokeStyle = theme.colors.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(tx, ty, w, 17, 5)
    else ctx.rect(tx, ty, w, 17)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = theme.colors.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.name, s.x, ty + 9)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/peerCursors.ts
git commit -m "feat: ghost cursor rendering for table peers"
```

---

### Task 4: "Host a table" UI

**Files:**
- Create: `src/ui/tableHost.ts`

**Interfaces:**
- Consumes: `hostRoom()`, `netConnected()`, `roomCode()`, `peers()`, `myName()` from `../engine/net`.
- Produces: `initTableHost(): void` — mounts a fixed chip, top-right. Task 5 calls it once at boot.

- [ ] **Step 1: Write the UI**

Create `src/ui/tableHost.ts`:

```ts
import { hostRoom, netConnected, roomCode, peers, myName } from '../engine/net'

// The "host a table" chip (top-right). Not connected: click hosts a room and
// copies the invite link. Connected: shows the room code + live headcount;
// click re-copies the link.

const STYLE = `
.dw-host {
  position: fixed; top: 0.85rem; right: 0.85rem; z-index: 30;
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); box-shadow: 4px 4px 0 var(--ink, #201a17);
  border-radius: 12px; padding: 0.45rem 0.75rem; cursor: pointer;
  font-family: var(--font-display, 'Fredoka', sans-serif); font-weight: 800; font-size: 0.9rem;
}
.dw-host:hover { transform: translate(1px, 1px); box-shadow: 3px 3px 0 var(--ink, #201a17); }
.dw-host .code { font-family: var(--font-mono, monospace); background: var(--paper, #f5ecd6);
  border: 2px solid var(--ink, #201a17); border-radius: 6px; padding: 0.05rem 0.4rem; }
.dw-host .flash { color: var(--teal, #2fb0a3); }
`

export function initTableHost(): void {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.className = 'dw-host'
  document.body.appendChild(btn)

  let flashUntil = 0

  const copyInvite = (): void => {
    navigator.clipboard?.writeText(location.href).catch(() => { /* http fallback: none */ })
    flashUntil = performance.now() + 1500
  }

  btn.addEventListener('click', () => {
    if (!netConnected()) hostRoom()
    copyInvite()
  })

  const render = (): void => {
    if (!netConnected()) {
      btn.innerHTML = 'host a table'
    } else {
      const n = peers().size + 1
      const label = performance.now() < flashUntil
        ? '<span class="flash">link copied</span>'
        : `${n} at the table`
      btn.innerHTML = `<span class="code">${roomCode() ?? ''}</span> ${label}`
      btn.title = `you are "${myName()}" — click to copy the invite link`
    }
    setTimeout(render, 500)
  }
  render()
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/tableHost.ts
git commit -m "feat: host-a-table chip (room code, headcount, invite copy)"
```

---

### Task 5: Wire into main + local two-tab verification

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `initNet`, `sendCursor` (net), `drawPeerCursors` (peerCursors), `initTableHost` (tableHost), existing `input.world`.

- [ ] **Step 1: Imports**

In `src/main.ts`, after the existing imports add:

```ts
import { initNet, sendCursor } from './engine/net'
import { drawPeerCursors } from './ui/peerCursors'
import { initTableHost } from './ui/tableHost'
```

- [ ] **Step 2: Boot calls**

After `initAudio()` add:

```ts
initNet()          // joins ?room=XXXX if present
initTableHost()    // "host a table" chip
```

- [ ] **Step 3: Per-frame calls**

In `frame()`, after `updateInputWorld(input, camera, canvas)` add:

```ts
sendCursor(input.world.x, input.world.y)
```

and after `drawImpacts(ctx, camera, canvas)` add:

```ts
drawPeerCursors(ctx, camera, canvas)
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: both exit 0.

- [ ] **Step 5: Manual two-tab check (the actual gate)**

Run both dev servers: `npx partykit dev` and `npm run dev`.
1. Open `http://localhost:5173`, click **host a table** → chip shows a code, URL gains `?room=`.
2. Open the full URL (with `?room=`) in a second window.
3. Expected in each window: the OTHER window's cursor glides on the table with a name tag; chip reads "2 at the table"; closing one window drops the count and the ghost within a second; equipping a different cursor in the shop changes your ghost in the other window.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire presence into the frame loop"
```

---

### Task 6: Deploy the party server + point production at it

**Files:**
- Modify: `src/engine/net.ts` (HOST constant, only if the deployed host differs)

- [ ] **Step 1: PartyKit login (INTERACTIVE — Dylan runs this)**

Dylan runs: `npx partykit login` (GitHub device flow, as dlandman27).

- [ ] **Step 2: Deploy**

Run: `npx partykit deploy`
Expected: output ends with a live host like `dylanworld.dlandman27.partykit.dev`.

- [ ] **Step 3: Confirm the HOST constant**

If the printed host differs from `dylanworld.dlandman27.partykit.dev` in `src/engine/net.ts`, update the constant to match exactly.
Run: `npx tsc --noEmit && npx vite build`
Expected: exit 0.

- [ ] **Step 4: Ship the site**

```bash
git add -A
git commit -m "feat: multiplayer presence — host a table, share the link, see everyone's cursors"
git push origin main
```
Vercel auto-deploys.

- [ ] **Step 5: Production verification**

On `https://dylanworld-alpha.vercel.app`: host a table, open the invite link on a second device (this doubles as the first real phone test). Expected: both cursors visible, headcount 2.

- [ ] **Step 6: Tick the TODO**

Mark the Phase-1 presence box in `TODO.md`, commit with the push above or separately.

---

## Self-review notes

- **Spec coverage:** room create/join via URL ✓, throttled cursor broadcast ✓, ghost rendering with equipped skin + name ✓, host UI + invite link ✓, leave/idle handling ✓, deploy ✓. Phase 2/3 (synced games, shared physics) intentionally out of scope.
- **Type consistency:** `Peer` fields (`tx/ty` targets vs `x/y` rendered) used identically in Tasks 2–3; `sendCursor(x, y)` matches Task 5's call; `hot` tuple and `draw(ctx)` exist on `CURSORS` entries (verified in `src/config/cursors.ts`).
- **Known risk:** `PartySocket` default export typing under Vite's TS settings — if the import errors, use `import { PartySocket } from 'partysocket'` per the installed version's types. Noted here so the implementer isn't surprised.
