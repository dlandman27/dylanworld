# Multiplayer Phase 3 — Host-Authoritative Shared Props

**Date:** 2026-07-26
**Status:** Approved design, ready for planning
**Builds on:** Phase 1 presence (ghost cursors), shipped 2026-07-20

## Goal

Make the free physics props on the table **fully shared** across everyone in a
`?room=XXXX` session. If I fling a marble, my friend sees it fly and collide
with theirs. This is TODO Phase 3 ("shared physics: host-authoritative
simulation, guests send inputs, host broadcasts snapshots ~20/s, guests
interpolate"), scoped to the free props only.

**Critical safety property:** single-player (no room / not connected) must behave
*exactly* as it does today. All multiplayer code paths are inert when
`netConnected()` is false.

## Scope

**In:** the exact set produced by `createProps()` — ~77 objects: marbles
(`pebble`), the one `ball`, `coin`s, and `chip`s. Position, velocity, rotation,
grab state, disc lift, and coin/chip flip state are all synced.

**Out (deferred to later passes):**
- Every game/toy with bespoke state — chess, dice, scrabble, plinko/marble run,
  drone, cards, etc.
- **The name-title letters** — these live in `blocks.ts` (a game), *not* in the
  free-prop set, so they stay local this pass along with the other toys.
- Voice/chat, persistence, server-authoritative simulation.

## Roles & Authority

The Durable Object assigns exactly one **host** per room — the first active
connection. Role is authoritative from the server because a client cannot know
whether it is first.

- **Host:** runs the real `updatePhysics` loop over shared props and broadcasts
  snapshots. Applies everyone's grabs (its own local input plus remote guest
  grabs).
- **Guest:** runs *no* physics on shared props. Interpolates host snapshots and
  sends interaction *intents* (`grab` / `rel`). Predicts only the single prop it
  is currently holding, for zero-latency feel.

Prop `id`s are assigned in deterministic creation order (`nextId++` inside
`createProps`), so ids line up across clients with no id-mapping message. Guests
build props locally for id/kind/count; host snapshots own the positions.

## Network Protocol

All messages are JSON objects keyed by `t`. The relay stamps each with the
sender's connection `id` (existing behavior).

| `t` | Direction | Rate | Payload |
|-----|-----------|------|---------|
| `c` | any → all | ≤20 Hz | cursor: `{x, y, cur, name}` (existing; ghost cursors). **Guests send this; the host does not** — the host folds its cursor into `snap`. |
| `role` | DO → client | on connect + on host change | `{isHost}` |
| `snap` | host → all | ~20 Hz | active/awake props only (delta): `{p:[[id,x,y,rot,tx,ty,fl]...], cx, cy, cur, name}` where `fl` packs grabbed/lift/flip flags; `cx,cy,cur,name` is the host's own cursor. |
| `key` | host → all | ~every 1.5 s | full snapshot of all props (same row format as `snap`), so late joiners and promoted hosts converge within a beat. No per-join handshake. |
| `grab` | guest → host | on grab | `{id}`. Host arbitrates: first grab wins; ignored if already grabbed by someone else. |
| `rel` | guest → host | on release | `{id, vx, vy, tap}`. Host runs the authoritative release. |

`fl` bit-packing (one small integer): `grabbed` (is this prop currently held),
`lift` quantized for discs, `flip` in-progress + fate for coins/chips. Exact bit
layout is an implementation detail for the plan; it must round-trip the visual
state `drawProps` reads (`lift`, `tex.x` flip timer, `tex.y` fate).

## Host Simulation — Multi-Grabber Physics

`updatePhysics(props, input, cam, dt)` today applies a single grabbed prop from
`input`. Generalize the **grab step only** to iterate a list of active grabbers:

- The host's own local `input.grabbed` (unchanged behavior).
- Each remote guest grab: `{propId, x, y}` where `x,y` is that guest's
  last-known cursor (from their `c` messages). The host applies the same
  fling-spring (or disc pickup) it uses for the local grab.

The integrate / friction / rim-bounce / obstacle / collision passes are
**unchanged**. This keeps one physics simulation; only the "who is pulling what"
input widens.

`releaseGrab`'s tap-flip + disc set-down/stacking logic (currently inline in
`input.ts`) is **extracted into a host-side helper**
`applyRelease(props, prop, tap, vx, vy)` so a local release and a remote `rel`
message hit exactly one code path.

## Guest Rendering — Interpolation + Prediction

Guests replace `updatePhysics` with `applySnapshots` + ease:

- Each incoming `snap`/`key` sets a per-prop **network target** (tx, ty, trot,
  and target flip/lift state). Props not present in a delta keep their last
  target (they've settled).
- Each frame, props ease toward their target using the same lerp approach
  `peerCursors.ts` uses (`ease = min(1, dt*14)`). `drawProps` is untouched — it
  reads `p.pos`/`p.rotation`/`p.tex`/`p.lift` as today.
- **Local prediction for the held prop:** while a guest holds a prop, it
  simulates that one prop locally (rides cursor / fling spring) so it feels
  instant. On release it stops predicting and snaps to host authority. If the
  host rejected the grab (already taken), the guest drops the prediction on the
  next snapshot that shows the prop grabbed by someone else.

## Host Election & Migration (`party/index.ts`)

The DO tracks `hostId`.

- `onConnect`: if there is no current host, this connection becomes host. Send
  `role` to the connecting client (and, on change, broadcast the new roles).
- `onClose`: if the leaving connection was the host, promote the oldest
  remaining connection and send it `role:{isHost:true}`. If the room empties,
  the next joiner becomes host.

A promoted guest flips `isHost=true` and begins simulating from its current
interpolated prop positions. Velocities start near zero, so props settle; a
brief, acceptable discontinuity at the moment of promotion.

## Abuse Limits (`party/index.ts`)

Keyframes of 77 props exceed the current 1 KB `MAX_MESSAGE_BYTES`, so:

- Raise `MAX_MESSAGE_BYTES` to ~8 KB (our own server; still bounded).
- Give `RATE_LIMIT` headroom for the host's ~22 msg/s (20 `snap` + occasional
  `key`). Keep `RATE_KILL` as the flood backstop.

Delta snapshots keep the common case far under budget: most props sleep, so a
typical `snap` carries only the handful currently moving.

## Files Touched

- `party/index.ts` — host election/migration, `role` messages, raised limits.
- `src/engine/net.ts` — new message types; `isHost()`; snapshot encode/decode
  (send on host, buffer on guest); `grab`/`rel` senders; per-peer remote-grab
  cursor tracking.
- `src/engine/physics.ts` — multi-grabber grab step; extract
  `applyRelease(...)`; add guest-side `applySnapshots(props, ...)` +
  per-frame interpolation.
- `src/engine/input.ts` — `grabAt` emits `grab`; `releaseGrab` emits `rel` with
  a `tap` flag and, on a guest, defers the authoritative outcome to the host.
- `src/main.ts` — branch the frame loop: host → `updatePhysics`; guest →
  interpolate + predict held prop.

## Error Handling & Edge Cases

- **Not connected / no room:** all multiplayer paths inert; behaves exactly as
  today (the safety property above).
- **Host leaves:** DO promotes the oldest remaining connection.
- **Empty room:** next joiner is host.
- **Grab race:** host wins; the losing guest reconciles on the next snapshot.
- **Stale peers:** existing 30 s prune in `net.ts` continues to apply to ghost
  cursors.
- **Reload/rejoin:** you may return as a guest if others are present. Fine.

## Testing

- **Primary:** manual two-window test — a host tab and a `?room=` guest tab.
  Fling a marble in one window, confirm it flies and collides in the other; grab
  a prop from the guest and confirm the host is authoritative; tap-flip a coin
  from each side; close the host tab and confirm a guest is promoted and the
  table keeps simulating.
- **Types:** `npm run check` (`tsc --noEmit`) must pass.
- No unit-test harness exists in the repo. If desired, a small deterministic
  `updatePhysics` step test could be added, but it is not required for this pass.

## Out of Scope (Next Passes)

Per-game/toy sync (chess, dice, scrabble, plinko/marble run, drone, cards, and
the letter blocks), voice/chat, and persistence.
