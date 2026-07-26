# Multiplayer Phase 3 — Host-Authoritative Shared Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the free physics props (marbles, ball, coins, chips) across everyone in a `?room=` session so flinging, colliding, coin-flips, and disc stacks are shared, with one host running the authoritative simulation.

**Architecture:** The Cloudflare Durable Object elects one host (first connection) per room. The host runs the existing `updatePhysics` loop and broadcasts prop snapshots ~20 Hz (plus a full keyframe every 1.5 s). Guests run no physics on shared props — they interpolate snapshots and send `grab`/`rel` intents, predicting only the single prop they hold. Prop `id`s are assigned in deterministic creation order so they align across clients with no id-mapping message.

**Tech Stack:** TypeScript, Vite, HTML canvas 2D, `partysocket` (client), `partyserver` on a Cloudflare Durable Object (server), `wrangler` for local dev.

## Global Constraints

- **Single-player must be untouched.** Every multiplayer path is inert when `netConnected()` is false — the frame loop, physics, input, and rendering behave exactly as today with no room in the URL. This is the top safety property; verify it after every task.
- **Message field naming:** the relay in `party/index.ts:59` overwrites `parsed.id` with the sender's connection id. Never put application data in a field named `id` on a wire message. The prop id in `grab`/`rel` messages is `pid`.
- **Synced set = `createProps()` output only:** marbles (`pebble`), the one `ball`, `coin`s, `chip`s. The name-title letters (`blocks.ts`) and every other game stay local this pass.
- **No unit-test harness exists** in this repo (no `test` script in `package.json`; the code is canvas/WebSocket/Durable-Object glue that isn't unit-testable in isolation). The automated gate for every task is `npm run check` (`tsc --noEmit`). Behavioral verification is a scripted **manual two-window test** (a host tab + a `?room=` guest tab), spelled out per task. Follow it exactly; do not invent a test runner.
- **House style / conventions:** match the terse top-of-file comment blocks and the existing code idiom in `net.ts`, `physics.ts`, `input.ts`. No new dependencies.
- **Local dev servers:** `npm run party` (wrangler, port 1999) for the DO, and `npm run dev` (Vite) for the client. `net.ts` already points at `localhost:1999` on localhost.

---

## File Structure

- `party/index.ts` — **modify.** Add host election + migration, `role` messages, raise message-size/rate limits.
- `src/engine/net.ts` — **modify.** New message types; `isHost()`; snapshot encode (host) / decode+buffer (guest); `grab`/`rel` senders; host-side remote-grab tracking + release queue; host cursor folded into snapshots; shared peer-cursor upsert helper.
- `src/engine/physics.ts` — **modify.** Widen `updatePhysics` grab step to apply remote grabbers; extract `applyRelease(...)`; add guest-side `interpolateRemoteProps(...)` and `predictHeld(...)`.
- `src/engine/input.ts` — **modify.** `grabAt` emits `grab` on guests; `releaseGrab` computes a `tap` flag and, on a guest, sends `rel` instead of mutating authoritative state; host/single-player call `applyRelease`.
- `src/main.ts` — **modify.** Branch the frame loop: host/single-player → `updatePhysics` (+ broadcast when connected); guest → interpolate (+ predict held prop).

---

## Task 1: Host election, roles, and abuse limits (Durable Object)

**Files:**
- Modify: `party/index.ts`

**Interfaces:**
- Produces (wire): DO sends `{t:'role', isHost:boolean}` to each client on connect and whenever the host changes. `id` is stamped by the relay as usual on relayed messages, but `role` is sent directly to a single connection via `conn.send(...)` (not broadcast/stamped).
- Produces (behavior): exactly one connection per room is host at any time; on host disconnect the oldest remaining connection is promoted.

- [ ] **Step 1: Add host state and a role-send helper to the `Table` class**

In `party/index.ts`, inside `export class Table extends Server<Env>`, add a `hostId` field and a helper. Place near the existing `buckets` field:

```ts
  private buckets = new Map<string, Bucket>()
  private hostId: string | null = null

  // tell one connection whether it is the authoritative physics host
  private sendRole(conn: Connection): void {
    conn.send(JSON.stringify({ t: 'role', isHost: conn.id === this.hostId }))
  }

  // the oldest still-open connection, used to promote a new host
  private oldestConnection(): Connection | null {
    for (const c of this.getConnections()) return c
    return null
  }
```

- [ ] **Step 2: Assign host on connect and tell the client its role**

Replace the existing `onConnect` with one that elects a host and always reports the role. Keep the connection cap.

```ts
  onConnect(conn: Connection): void {
    let n = 0
    for (const _ of this.getConnections()) n++
    if (n > MAX_CONNECTIONS) {
      conn.close(1013, 'table full') // 1013 = try again later
      return
    }
    if (this.hostId === null) this.hostId = conn.id
    this.sendRole(conn)
  }
```

- [ ] **Step 3: Promote a new host on close**

Replace the existing `onClose` so that when the host leaves, the oldest remaining connection is promoted and told its new role.

```ts
  onClose(conn: Connection): void {
    this.buckets.delete(conn.id)
    this.broadcast(JSON.stringify({ t: 'leave', id: conn.id }))
    if (conn.id === this.hostId) {
      const next = this.oldestConnection()
      this.hostId = next ? next.id : null
      if (next) this.sendRole(next)
    }
  }
```

- [ ] **Step 4: Raise message-size and rate limits for snapshot traffic**

Keyframes of ~77 props exceed 1 KB, and the host emits ~20 snapshots/s. Update the limit constants at the top of `party/index.ts`:

```ts
// abuse limits — sized around the real client: host emits ~20 snapshots/s plus
// a periodic keyframe of all props; guests emit cursor + occasional intents
const MAX_CONNECTIONS = 32     // per table; broadcast fan-out is O(n²)
const MAX_MESSAGE_BYTES = 8192 // a full keyframe of ~77 props fits comfortably
const RATE_WINDOW_MS = 1000
const RATE_LIMIT = 40          // relayed messages per window per connection
const RATE_KILL = 120          // sustained flooding gets the boot
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: PASS (no type errors). Note: `party/index.ts` uses Cloudflare/partyserver types; if `tsc --noEmit` does not include it, also run `npx wrangler deploy --dry-run --outdir /tmp/dw-dryrun` and expect it to bundle without error.

- [ ] **Step 6: Manual verification (two windows)**

Start servers: `npm run party` and `npm run dev`. Open two browser tabs to the dev URL with the same room, e.g. `http://localhost:5173/?room=TEST`. In each tab's devtools console, run:
```js
// paste once per tab to observe role messages
const s = new WebSocket('ws://localhost:1999/parties/table/TEST'); s.onmessage = e => console.log('msg', e.data)
```
Expected: the first socket logs `{"t":"role","isHost":true}`, the second logs `{"t":"role","isHost":false}`. Close the first; the second should NOT crash (host-migration path runs server-side; a fresh third connection becomes non-host while the promoted one is host — full client verification lands in Task 2).

- [ ] **Step 7: Commit**

```bash
git add party/index.ts
git commit -m "feat(mp): host election, role messages, and raised relay limits

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Client role handling (`isHost()`)

**Files:**
- Modify: `src/engine/net.ts`

**Interfaces:**
- Consumes (wire): `{t:'role', isHost:boolean}` from the DO (Task 1).
- Produces: `export function isHost(): boolean` — false until a `role` message arrives; reflects the latest role (updates on host migration).

- [ ] **Step 1: Add the host flag and accessor**

In `src/engine/net.ts`, add module state near `let room: string | null = null`:

```ts
let host = false
```

Add the accessor near `netConnected()`:

```ts
export function isHost(): boolean {
  return host
}
```

- [ ] **Step 2: Handle the `role` message**

In `connect()`, inside the `socket.addEventListener('message', ...)` handler, add a branch at the top of the parsed-message handling (right after the `if (!m.id) return` guard is the wrong place — `role` has no `id`; put this branch BEFORE that guard). Update the handler's opening so `role` is handled first:

```ts
  socket.addEventListener('message', (e: MessageEvent) => {
    let m: { t?: string; id?: string; x?: number; y?: number; cur?: string; name?: string; isHost?: boolean }
    try { m = JSON.parse(e.data as string) } catch { return }
    if (m.t === 'role') { host = !!m.isHost; return }
    if (!m.id) return
    // ...existing 'leave' and 'c' handling unchanged...
```

- [ ] **Step 3: Reset host flag on (re)connect**

At the top of `connect(code)`, before creating the socket, reset the flag so a reconnect starts unknown:

```ts
function connect(code: string): void {
  room = code
  host = false
  // party: 'table' = the kebab-cased Durable Object binding name ("Table")
  socket = new PartySocket({ host: HOST, room: code, party: 'table' })
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Manual verification (two windows)**

With both servers running, open `http://localhost:5173/?room=TEST` in tab A, then tab B. In each tab's console run `__net_isHost = () => { /* temp */ }` — simpler: temporarily add `;(window as any).isHost = isHost` at the end of `initNet()` is NOT needed; instead verify via the host chip which already shows "N at the table". Confirm both tabs connect and show the headcount growing to 2. Then in tab A console, evaluate the imported module is not directly reachable — so verify roles by adding a one-line temporary log in Step 2 (`console.log('role', host)`) if needed, then REMOVE it before commit. Expected: tab A logs `role true`, tab B logs `role false`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/net.ts
git commit -m "feat(mp): client role handling and isHost() accessor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Snapshots — host broadcasts, guests interpolate (spectating)

This is the milestone task: after it, a guest tab passively **sees** the host's props move (the host flings a marble with its own mouse, the guest watches it fly and collide). Guest interaction comes in Task 5.

**Files:**
- Modify: `src/engine/net.ts`
- Modify: `src/engine/physics.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces (`net.ts`):
  - `export interface SnapTarget { x: number; y: number; rot: number; texx: number; texy: number; grabbed: boolean }`
  - `export function broadcastProps(props: Prop[], cx: number, cy: number): void` — host-only (no-op unless `socket && host`); self-throttles to 20 Hz; sends a `key` (all props) every 1.5 s, otherwise a `snap` (awake or grabbed props only). Folds the host cursor `(cx,cy)` + equipped skin + name into the message.
  - `export function remoteTargets(): Map<number, SnapTarget>` — latest decoded per-prop targets (guest side).
- Produces (`physics.ts`):
  - `export function interpolateRemoteProps(props: Prop[], dt: number, skip: Prop | null): void` — eases each prop toward its `remoteTargets()` entry; skips `skip` (the prop this client predicts); derives disc `lift` from `grabbed`.
- Wire messages: `{t:'snap'|'key', p:number[][], cx:number, cy:number, cur:string, name:string}` where each row is `[id, x, y, rot, texx, texy, grabbed]` (`grabbed` is `0|1`).

- [ ] **Step 1: Add snapshot types and host cursor imports in `net.ts`**

At the top of `src/engine/net.ts`, add the `Prop` type import and `isDisc` is not needed here. Add:

```ts
import type { Prop } from '../types'
```

Add the exported target type near the `Peer` interface:

```ts
export interface SnapTarget {
  x: number; y: number; rot: number
  texx: number; texy: number
  grabbed: boolean
}
```

Add module state near `let lastSend = 0`:

```ts
let lastSnap = 0
let lastKey = 0
const remoteMap = new Map<number, SnapTarget>()
```

- [ ] **Step 2: Extract a peer-cursor upsert helper in `net.ts`**

The host will stop sending standalone `c` messages (its cursor rides snapshots), so both the `c` handler and the snapshot handler must be able to upsert a peer's ghost cursor. Extract the existing upsert logic from the `c` branch into a helper:

```ts
function upsertPeerCursor(id: string, x: number, y: number, cur?: string, name?: string): void {
  const existing = peerMap.get(id)
  if (existing) {
    existing.tx = x
    existing.ty = y
    existing.cur = cur ?? existing.cur
    existing.name = name ?? existing.name
    existing.lastSeen = performance.now()
  } else {
    peerMap.set(id, {
      id, name: name ?? 'someone', cur: cur ?? 'arrow-ink',
      x, y, tx: x, ty: y, lastSeen: performance.now(),
    })
  }
}
```

Then replace the body of the `c` branch in the message handler with:

```ts
    if (m.t === 'c' && typeof m.x === 'number' && typeof m.y === 'number') {
      upsertPeerCursor(m.id, m.x, m.y, m.cur, m.name)
      return
    }
```

- [ ] **Step 3: Decode snapshots on the guest side**

In the message handler in `connect()`, extend the parsed type and add a `snap`/`key` branch. The message row array is `p`. Add to the type annotation: `p?: number[][]; cx?: number; cy?: number`. Add this branch (after the `role` branch, before or after `c` — but note snapshots carry the host cursor and are stamped with the host's `id`):

```ts
    if ((m.t === 'snap' || m.t === 'key') && Array.isArray(m.p)) {
      for (const row of m.p) {
        remoteMap.set(row[0], {
          x: row[1], y: row[2], rot: row[3],
          texx: row[4], texy: row[5], grabbed: row[6] === 1,
        })
      }
      // the host's own cursor rides the snapshot → keep its ghost cursor alive
      if (typeof m.cx === 'number' && typeof m.cy === 'number') {
        upsertPeerCursor(m.id, m.cx, m.cy, m.cur, m.name)
      }
      return
    }
```

- [ ] **Step 4: Add `remoteTargets()` accessor**

```ts
/** Latest decoded per-prop network targets (guest side). */
export function remoteTargets(): Map<number, SnapTarget> {
  return remoteMap
}
```

- [ ] **Step 5: Add `broadcastProps` (host send) and stop the host sending `c`**

Add the broadcaster (uses the existing module `name` and imported `equippedId`):

```ts
/** Host-only: broadcast prop state. 20 Hz delta of awake/grabbed props, with a
 *  full keyframe of every prop every 1.5s so late joiners converge. The host's
 *  own cursor rides along, so the host does not also send a 'c' message. */
export function broadcastProps(props: Prop[], cx: number, cy: number): void {
  if (!socket || !host) return
  const now = performance.now()
  if (now - lastSnap < 50) return
  lastSnap = now
  const full = now - lastKey > 1500
  if (full) lastKey = now
  const rows: number[][] = []
  for (const p of props) {
    if (!full && p.sleeping && !p.grabbed) continue
    rows.push([
      p.id,
      Math.round(p.pos.x), Math.round(p.pos.y),
      Math.round(p.rotation * 100) / 100,
      Math.round(p.tex.x * 10) / 10, Math.round(p.tex.y * 10) / 10,
      p.grabbed ? 1 : 0,
    ])
  }
  socket.send(JSON.stringify({
    t: full ? 'key' : 'snap', p: rows,
    cx: Math.round(cx), cy: Math.round(cy), cur: equippedId(), name,
  }))
}
```

Then make the host skip standalone cursor sends — update `sendCursor`'s guard:

```ts
export function sendCursor(x: number, y: number): void {
  if (!socket || host) return   // host cursor rides prop snapshots instead
  // ...rest unchanged...
```

- [ ] **Step 6: Add `interpolateRemoteProps` in `physics.ts`**

At the top of `src/engine/physics.ts`, add the import:

```ts
import { remoteTargets } from './net'
```

Add the guest-side interpolation function (place near `updatePhysics`):

```ts
/** Guest side: ease shared props toward the host's latest snapshot targets.
 *  `skip` is the one prop this client is predicting locally (its held prop) and
 *  is left alone. Disc lift is derived from the grabbed flag. */
export function interpolateRemoteProps(props: Prop[], dt: number, skip: Prop | null): void {
  const targets = remoteTargets()
  const ease = Math.min(1, dt * 14)
  for (const p of props) {
    if (p === skip) continue
    const t = targets.get(p.id)
    if (!t) continue
    p.pos.x += (t.x - p.pos.x) * ease
    p.pos.y += (t.y - p.pos.y) * ease
    p.rotation += (t.rot - p.rotation) * ease
    p.tex.x = t.texx
    p.tex.y = t.texy
    p.grabbed = t.grabbed
    if (isDisc(p.kind)) p.lift += ((p.grabbed ? 1 : 0) - p.lift) * ease
    p.vel.x = 0
    p.vel.y = 0
    p.sleeping = false
  }
}
```

- [ ] **Step 7: Branch the frame loop in `main.ts`**

Update the imports in `src/main.ts`:

```ts
import { initNet, sendCursor, netConnected, isHost, broadcastProps } from './engine/net'
import { createProps, updatePhysics, drawProps, drawImpacts, interpolateRemoteProps } from './engine/physics'
```

Replace the single `updatePhysics(props, input, camera, dt)` call in `frame()` with the branch (keep the surrounding lines):

```ts
  setPointer(input.world.x, input.world.y)    // publish cursor pos for ambient critters
  sendCursor(input.world.x, input.world.y)
  if (netConnected() && !isHost()) {
    interpolateRemoteProps(props, dt, null)   // guest: watch the host's table
  } else {
    updatePhysics(props, input, camera, dt)
    if (netConnected()) broadcastProps(props, input.world.x, input.world.y)
  }
  updateDayNight(dt)
```

- [ ] **Step 8: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 9: Manual verification (two windows) — spectating works**

Servers running. Tab A: `http://localhost:5173/?room=TEST` (becomes host). Tab B: same URL (guest). In **tab A**, grab a marble and fling it across the table. Expected: in **tab B**, the same marble flies along the same path and collides with others, arriving smoothly (interpolated). Tap a coin in tab A → in tab B the coin flip animation plays and it lands on the same face. Confirm tab A's ghost cursor still appears in tab B (host cursor riding snapshots). Confirm a NON-room tab (`http://localhost:5173/`) still behaves exactly as single-player.

- [ ] **Step 10: Commit**

```bash
git add src/engine/net.ts src/engine/physics.ts src/main.ts
git commit -m "feat(mp): host prop snapshots + guest interpolation (spectating)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Extract `applyRelease` and widen `updatePhysics` for remote grabbers

No behavior change yet — this refactors the release logic out of `input.ts` into a host-authoritative helper and teaches `updatePhysics` to apply extra grabbers. Single-player and Task-3 spectating must still work identically.

**Files:**
- Modify: `src/engine/physics.ts`
- Modify: `src/engine/input.ts`

**Interfaces:**
- Produces (`physics.ts`):
  - `export interface RemoteGrabber { prop: Prop; x: number; y: number }`
  - `export function applyRelease(props: Prop[], g: Prop, tap: boolean, vx: number, vy: number): void` — authoritative release: for discs, `tap` flips (heads/tails fate) and non-tap sets the disc down onto a stack; for other props, sets `vel = (vx,vy)`. Always clears `g.grabbed`.
  - `updatePhysics(props, input, cam, dt, remoteGrabbers?: RemoteGrabber[])` — new optional 5th param; each remote grabber drives its prop toward `(x,y)` exactly like the local grab (disc = ride cursor, else fling spring). The local `input.grabbed` wins if both target the same prop.

- [ ] **Step 1: Add `applyRelease` to `physics.ts`**

Add near `updatePhysics` (it mirrors the current `releaseGrab` disc logic from `input.ts:64-96`, minus the screen/tap detection which the caller now precomputes):

```ts
export interface RemoteGrabber { prop: Prop; x: number; y: number }

/** Authoritative release, shared by the local host input and remote `rel`
 *  intents. `tap` (discs only) means a clean tap with no drag → flip. */
export function applyRelease(props: Prop[], g: Prop, tap: boolean, vx: number, vy: number): void {
  if (isDisc(g.kind)) {
    if (tap && g.tex.x === 0) {
      // a clean TAP flips it — coins land on fate, chips just tumble
      g.tex.x = 0.0001                       // flip timer starts
      g.tex.y = Math.random() < 0.5 ? 0 : 1  // heads/tails (or chip front/back)
      g.vel.x = 0
      g.vel.y = 0
    } else if (!tap) {
      // a carried disc sets down gently — onto a STACK when over another disc.
      // Align to the column's BOTTOM disc, one sliver (3.2px) higher per disc.
      g.vel.x = 0
      g.vel.y = 0
      const column = props.filter(p =>
        p !== g && isDisc(p.kind) &&
        Math.abs(p.pos.x - g.pos.x) < g.radius &&
        Math.abs(p.pos.y - g.pos.y) < g.radius + 50)
      if (column.length > 0) {
        const bottom = column.reduce((a, b) => (b.pos.y > a.pos.y ? b : a))
        g.pos.x = bottom.pos.x
        g.pos.y = bottom.pos.y - 3.2 * column.length
      }
    }
  } else {
    g.vel.x = vx
    g.vel.y = vy
  }
  g.grabbed = false
}
```

- [ ] **Step 2: Apply remote grabbers inside `updatePhysics`**

Change the signature and add remote-grab handling right after the existing local `input.grabbed` block (top of `updatePhysics`, after the closing brace of `if (input.grabbed) { ... }`):

```ts
export function updatePhysics(props: Prop[], input: InputState, cam: CameraState, dt: number, remoteGrabbers?: RemoteGrabber[]): void {
  // grabbed prop: coins are PICKED UP (ride the cursor exactly, airborne);
  // everything else chases the cursor on the fling spring
  if (input.grabbed) {
    // ...existing local grab block unchanged...
  }

  // remote grabbers: guests holding a prop, driven toward their cursor. Same
  // spring as the local grab; the local grab wins a contested prop.
  if (remoteGrabbers) {
    for (const rg of remoteGrabbers) {
      const g = rg.prop
      if (g === input.grabbed) continue
      if (isDisc(g.kind)) {
        g.pos.x = rg.x
        g.pos.y = rg.y
        g.vel.x = 0
        g.vel.y = 0
      } else {
        g.vel.x = (rg.x - g.pos.x) * tuning.flingPower
        g.vel.y = (rg.y - g.pos.y) * tuning.flingPower
      }
      g.grabbed = true
      g.restTime = 0
      g.sleeping = false
    }
  }

  const camDist = tuning.sleepDistance
  // ...rest of updatePhysics unchanged...
```

- [ ] **Step 3: Refactor `releaseGrab` in `input.ts` to compute `tap` and call `applyRelease`**

Add the import at the top of `src/engine/input.ts`:

```ts
import { applyRelease } from './physics'
```

Replace the whole `releaseGrab` function (`input.ts:64-96`) with a version that precomputes `tap` and delegates to `applyRelease` (this is the host/single-player path; the guest send path is added in Task 5):

```ts
  const releaseGrab = (): void => {
    const g = input.grabbed
    if (!g) return
    const disc = g.kind === 'coin' || g.kind === 'chip'
    let tap = false
    if (disc && grabStart) {
      const moved = Math.hypot(input.screen.x - grabStart.x, input.screen.y - grabStart.y)
      tap = moved < 8 && performance.now() - grabStart.t < 350
    }
    grabStart = null
    applyRelease(props, g, tap, g.vel.x, g.vel.y)
    input.grabbed = null
  }
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Manual verification — single-player unchanged**

Open `http://localhost:5173/` (no room). Confirm: flinging marbles, carrying and stacking coins/chips, tap-to-flip a coin (lands heads/tails), tap-to-tumble a chip — all behave exactly as before. Then repeat the Task 3 two-window spectating check to confirm no regression.

- [ ] **Step 6: Commit**

```bash
git add src/engine/physics.ts src/engine/input.ts
git commit -m "refactor(mp): extract applyRelease + accept remote grabbers in updatePhysics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Guest grab/release intents + host applies them

After this task a guest can grab and fling a prop, the host simulates it authoritatively, and every window sees the result.

**Files:**
- Modify: `src/engine/net.ts`
- Modify: `src/engine/input.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Wire messages (guest → host, relayed & stamped with sender `id`):
  - `{t:'grab', pid:number}` — request to hold prop `pid`. **Uses `pid`, never `id`** (the relay overwrites `id`).
  - `{t:'rel', pid:number, vx:number, vy:number, tap:0|1}` — release prop `pid`.
- Produces (`net.ts`):
  - `export function sendGrab(pid: number): void`
  - `export function sendRelease(pid: number, vx: number, vy: number, tap: boolean): void`
  - `export function remoteGrabbers(propById: Map<number, Prop>): RemoteGrabber[]` — host side: joins the live remote-grab map with each grabber's latest cursor (from `peerMap`), skipping ids not in `propById`.
  - `export function drainReleases(): Array<{ pid: number; tap: boolean; vx: number; vy: number }>` — host side: returns and clears queued releases (including synthetic zero-velocity releases for peers that left mid-grab).
- Consumes: `RemoteGrabber` and `applyRelease` from `physics.ts` (Task 4).

- [ ] **Step 1: Add intent senders in `net.ts`**

```ts
export function sendGrab(pid: number): void {
  socket?.send(JSON.stringify({ t: 'grab', pid }))
}

export function sendRelease(pid: number, vx: number, vy: number, tap: boolean): void {
  socket?.send(JSON.stringify({
    t: 'rel', pid, vx: Math.round(vx), vy: Math.round(vy), tap: tap ? 1 : 0,
  }))
}
```

- [ ] **Step 2: Track remote grabs + release queue on the host in `net.ts`**

Add the import (already added in Task 3) and module state near `remoteMap`:

```ts
import type { Prop } from '../types'
import type { RemoteGrabber } from './physics'
// ...
const remoteGrabMap = new Map<string, number>() // connId -> prop id it holds
const releaseQueue: Array<{ pid: number; tap: boolean; vx: number; vy: number }> = []
```

Extend the parsed-message type annotation with `pid?: number; vx?: number; vy?: number; tap?: number`. Add these branches in the message handler (after the `c` branch; these are host-relevant but harmless on guests, which never call `remoteGrabbers`/`drainReleases`):

```ts
    if (m.t === 'grab' && typeof m.pid === 'number') {
      // first-grab-wins: ignore if another connection already holds this prop
      let taken = false
      for (const held of remoteGrabMap.values()) if (held === m.pid) { taken = true; break }
      if (!taken) remoteGrabMap.set(m.id, m.pid)
      return
    }
    if (m.t === 'rel' && typeof m.pid === 'number') {
      releaseQueue.push({ pid: m.pid, tap: m.tap === 1, vx: m.vx ?? 0, vy: m.vy ?? 0 })
      remoteGrabMap.delete(m.id)
      return
    }
```

In the existing `leave` branch, release any prop the departing peer was holding, then delete the peer:

```ts
    if (m.t === 'leave') {
      const held = remoteGrabMap.get(m.id)
      if (held !== undefined) {
        releaseQueue.push({ pid: held, tap: false, vx: 0, vy: 0 })
        remoteGrabMap.delete(m.id)
      }
      peerMap.delete(m.id)
      return
    }
```

- [ ] **Step 3: Add host-side `remoteGrabbers` and `drainReleases` in `net.ts`**

```ts
/** Host side: current remote grabs joined with each grabber's latest cursor. */
export function remoteGrabbers(propById: Map<number, Prop>): RemoteGrabber[] {
  const out: RemoteGrabber[] = []
  for (const [connId, pid] of remoteGrabMap) {
    const prop = propById.get(pid)
    const peer = peerMap.get(connId)
    if (prop && peer) out.push({ prop, x: peer.tx, y: peer.ty })
  }
  return out
}

/** Host side: dequeue releases to apply this frame. */
export function drainReleases(): Array<{ pid: number; tap: boolean; vx: number; vy: number }> {
  const out = releaseQueue.splice(0, releaseQueue.length)
  return out
}
```

- [ ] **Step 4: Emit intents from `input.ts`**

Add the net imports at the top of `src/engine/input.ts`:

```ts
import { netConnected, isHost, sendGrab, sendRelease } from './net'
```

In `grabAt`, after the prop is grabbed and reordered (inside `if (hit) { ... }`, just before `return true`), emit a grab when a connected guest:

```ts
      if (netConnected() && !isHost()) sendGrab(hit.id)
      return true
```

In `releaseGrab` (from Task 4), branch so a connected guest sends its intent instead of mutating authoritative state:

```ts
    grabStart = null
    if (netConnected() && !isHost()) {
      // guest: the host owns the outcome — send the intent, stop predicting
      sendRelease(g.id, g.vel.x, g.vel.y, tap)
      g.grabbed = false
      input.grabbed = null
      return
    }
    applyRelease(props, g, tap, g.vel.x, g.vel.y)
    input.grabbed = null
```

- [ ] **Step 5: Apply remote grabs/releases on the host in `main.ts`**

Set the net and physics import lines in `main.ts` to exactly:

```ts
import { initNet, sendCursor, netConnected, isHost, broadcastProps, remoteGrabbers, drainReleases } from './engine/net'
import { createProps, updatePhysics, drawProps, drawImpacts, interpolateRemoteProps, applyRelease } from './engine/physics'
```

After `const props = createProps()`, build a stable id index (ids never change; the same object stays mapped even when `input.ts` reorders the array):

```ts
const props = createProps()
const propById = new Map(props.map(p => [p.id, p]))
```

Replace the host branch of the frame loop (from Task 3) so it drains releases and passes remote grabbers:

```ts
  if (netConnected() && !isHost()) {
    interpolateRemoteProps(props, dt, input.grabbed)   // guest: watch + predict our held prop
  } else {
    if (netConnected()) {
      for (const r of drainReleases()) {
        const p = propById.get(r.pid)
        if (p) applyRelease(props, p, r.tap, r.vx, r.vy)
      }
    }
    updatePhysics(props, input, camera, dt, netConnected() ? remoteGrabbers(propById) : undefined)
    if (netConnected()) broadcastProps(props, input.world.x, input.world.y)
  }
```

Note: the guest branch now passes `input.grabbed` as the skip arg — the held-prop prediction itself is added in Task 6; passing the skip now is harmless (the held prop simply won't be interpolated while held, and Task 4's guest `releaseGrab` already clears `grabbed`).

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Manual verification — guest can play**

Two windows on `?room=TEST` (A host, B guest). In **tab B (guest)**, grab a marble and fling it. Expected: in BOTH tabs the marble flies and collides consistently (host-authoritative). In tab B, tap a coin → both tabs show the flip landing on the same face. Grab the SAME prop in both tabs at once → only the first grabber controls it (host arbitration); the loser's grab has no authoritative effect. Close tab A (host) → tab B is promoted (host chip still shows), and B can now fling props locally; open a tab C guest and confirm C sees B's simulation.

- [ ] **Step 8: Commit**

```bash
git add src/engine/net.ts src/engine/input.ts src/main.ts
git commit -m "feat(mp): guest grab/release intents applied host-authoritatively

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Guest local prediction on the held prop

Removes the round-trip lag on the prop a guest is holding: it rides the guest's cursor locally, then snaps back to host authority on release.

**Files:**
- Modify: `src/engine/physics.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces (`physics.ts`): `export function predictHeld(g: Prop, input: InputState, dt: number): void` — locally advances the guest's held prop: discs ride the cursor exactly; other props chase it on the fling spring and integrate, so `g.vel` holds a real fling velocity at release time (which `input.ts` sends in the `rel` message).

- [ ] **Step 1: Add `predictHeld` to `physics.ts`**

```ts
/** Guest side: locally simulate the one prop this client is holding so it feels
 *  instant. Mirrors the local-grab branch of updatePhysics; the resulting g.vel
 *  is the fling velocity sent to the host on release. */
export function predictHeld(g: Prop, input: InputState, dt: number): void {
  if (isDisc(g.kind)) {
    g.pos.x = input.world.x
    g.pos.y = input.world.y
    g.vel.x = 0
    g.vel.y = 0
  } else {
    g.vel.x = (input.world.x - g.pos.x) * tuning.flingPower
    g.vel.y = (input.world.y - g.pos.y) * tuning.flingPower
    g.pos.x += g.vel.x * dt
    g.pos.y += g.vel.y * dt
  }
  g.grabbed = true
  g.restTime = 0
}
```

- [ ] **Step 2: Call it from the guest branch in `main.ts`**

Add `predictHeld` to the physics import in `main.ts`:

```ts
import { createProps, updatePhysics, drawProps, drawImpacts, interpolateRemoteProps, applyRelease, predictHeld } from './engine/physics'
```

Update the guest branch of the frame loop:

```ts
  if (netConnected() && !isHost()) {
    interpolateRemoteProps(props, dt, input.grabbed)   // watch the host's table
    if (input.grabbed) predictHeld(input.grabbed, input, dt)  // predict our held prop
  } else {
    // ...host/single-player branch unchanged...
  }
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Manual verification — held prop feels instant**

Two windows on `?room=TEST` (A host, B guest). In **tab B (guest)**, grab and drag a marble around. Expected: it tracks B's cursor with no perceptible lag (local prediction), while in tab A it follows smoothly (interpolated). Release with a flick in B → the marble keeps its fling velocity in both tabs and collides consistently. Carry a coin in B and set it down on a stack → the stack forms correctly (host applies the set-down; B snaps to the host result). Confirm no "rubber-banding" of the held prop in B during the hold.

- [ ] **Step 5: Update `TODO.md`**

Mark Phase 3 done and note the deferred per-toy sync. Edit the `## Multiplayer — PartyKit` section: change the Phase 3 line to `[x]` with a short "SHIPPED" note mirroring the Phase 1 entry's style, and add a follow-up line for per-game/toy sync.

- [ ] **Step 6: Commit**

```bash
git add src/engine/physics.ts src/main.ts TODO.md
git commit -m "feat(mp): guest-side prediction on the held prop; mark Phase 3 shipped

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes (spec coverage)

- **Roles & authority (spec §Roles):** Tasks 1–2 (election + `isHost`), Task 3 (host sims/broadcasts, guest interpolates), Task 5 (host applies guest intents). ✓
- **Synced set = `createProps()` only (spec §Scope):** enforced — only the shared `props` array is snapshotted; games/letters untouched. ✓
- **Protocol (spec §Network Protocol):** `role` (T1/T2), `snap`/`key` with host cursor folded in (T3), `grab`/`rel` using `pid` to dodge the `id` stamp (T5). `fl` bit-packing was simplified to explicit row fields incl. an explicit `grabbed` flag with `lift` derived guest-side — a documented refinement of the spec's "implementation detail." ✓
- **Multi-grabber physics + `applyRelease` (spec §Host Simulation):** Task 4. ✓
- **Guest interpolation + prediction (spec §Guest Rendering):** Task 3 (interpolate) + Task 6 (predict). ✓
- **Host election & migration (spec §Host Election):** Task 1 (DO promote-oldest) verified in Tasks 2/5 manual checks. ✓
- **Abuse limits (spec §Abuse Limits):** Task 1. ✓
- **Error handling / single-player-inert (spec §Error Handling):** the `netConnected()` guards in Tasks 3–6 keep every path inert offline; verified in Task 4 Step 5. Orphaned-grab-on-disconnect handled by the synthetic release in Task 5 Step 2. ✓
- **Testing (spec §Testing):** no unit harness; `npm run check` + scripted two-window manual test per task. ✓
