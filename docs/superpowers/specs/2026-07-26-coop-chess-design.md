# Co-op Chess — Design

**Date:** 2026-07-26
**Status:** Approved design, ready for planning
**Builds on:** Multiplayer Phase 3 (host-authoritative shared props), shipped 2026-07-26

## Goal

Make the chess board a real two-player game across a `?room=XXXX` session: you
play white, a friend plays black, moves sync, and everyone else watches the
board live. This is Multiplayer **Phase 2** ("board games as synced events"),
delivered as the first game on a small, reusable **seat/session** layer.

**Critical safety property:** single-player (no room / not connected) must behave
*exactly* as chess does today — you play both sides locally, no seats, no
gating. Every co-op path is inert when `netConnected()` is false.

## Scope

**In:** co-op chess end-to-end — seat claiming, turn-gated interaction, move
sync, live spectating, drop-in/drop-out, and a "new game" reset. Plus a thin
`coopSession` layer (chess-aware, but written with clean seams so a second game
is a small lift later).

**Out (later passes):**
- Other co-op toys (dice, cards, backgammon). The seat/session layer is built to
  extend to them, but only chess is wired now.
- Check/checkmate/stalemate detection, clocks, move history, castling/en-passant
  (chess stays "casual rules" exactly as it is today).
- Per-toy sync for the 40+ other games.

## Interaction Model

The chess board stays an in-world toy on the table, always rendering its current
state for everyone — so spectating is free. Behavior of a click on the board
depends on the local client's seat:

- **Unseated + a seat is open:** claim the first free seat (white if empty, else
  black). The camera eases once to frame the board; you are now a focused player.
- **Unseated + both seats full:** spectate-focus only — the camera eases in to
  watch; no seat, no interaction.
- **Seated + it is your turn:** a click starts a piece drag (normal chess).
- **Seated + not your turn:** the tap is swallowed (no move, no pan).

Two seats maximum; everyone else watches. Games are **drop-in/drop-out** and the
board is **durable**: a seat holder leaving or disconnecting frees the seat but
the board persists exactly as-is, and anyone can drop into the empty seat and
continue.

## Component 1 — Seat / Session Layer (`coopSession`)

A small helper module (`src/engine/games/coopSession.ts`), chess-aware for now.
It owns the co-op wrapper around a seat-based game and exposes what the input
system and `main.ts` need.

**State:**
- Seat map for the game: `{ w: string | null, b: string | null }` (connection
  ids), mirrored from the authoritative `gstate`.
- Local seat: `'w' | 'b' | null` — derived by matching my own connection id
  against the seat map (my id is the id the relay stamps on my messages; the
  client learns it lazily — see Netcode).

**Responsibilities:**
- **Claim / leave:** clicking the board when unseated sends a `gclaim` intent; a
  "leave seat" chip drawn beside the board (and the `Escape` key) sends `gleave`.
  Panning the table does **not** un-seat you.
- **Camera focus:** on a successful claim (or spectate-focus), ease the camera
  position + zoom once to frame the board, reusing the follow-target pattern
  already in `main.ts` (`driveTarget()/droneTarget()` set a point the camera
  eases toward for a few frames). Focus is a one-shot ease, not a hard lock — the
  camera is free afterward.
- **Input gating:** wrap the board's `onDown` so a drag may start only when the
  local seat's color equals the current `turn`. Otherwise return `true` (swallow
  the tap so the table does not pan) without starting a drag.
- **On-felt UI (drawn in world, house style):** seat labels under each side
  ("you" / the peer's name / "open"), a turn dot, and the leave chip while
  seated.

**Inert offline:** when `netConnected()` is false, `coopSession` reports no
seats, never gates input, and draws no seat UI — chess plays exactly as today.

## Component 2 — Chess Changes (`chess.ts`)

Surgical, preserving all existing rules and rendering:

- **Extract `applyMove(from, to)`** from the inline `onUp` logic: writes the
  destination square (auto-promoting a pawn reaching rank 0/7 to a queen, exactly
  as today), clears the source, and flips `turn`. This is the single move-apply
  path used by both a local optimistic apply and a remote move.
- **`serialize(): ChessState` / `applyState(s: ChessState)`**: `ChessState` is
  `{ board: string; turn: 'w'|'b' }` where `board` is 64 chars (one per square:
  piece letter with case for color, `.` for empty). Used for host snapshots and
  late-joiner catch-up.
- **`onUp` no longer commits directly in co-op:** when connected, a seated
  player's *legal* move applies optimistically to the local board (so it feels
  instant) **and** emits a `gmove {from, to}` intent; the authoritative `gstate`
  that comes back reconciles it (a no-op in practice, since host and client run
  identical deterministic rules). When not connected, `onUp` commits directly as
  today.
- **New-game reset:** a seated player can trigger a reset (a small affordance by
  the board) that, when connected, sends `greset`; offline it resets locally.
- The move-intent / state-apply wiring is provided to `chess.ts` by the
  `coopSession` layer via a small callback interface, so `chess.ts` does not
  import `net.ts` directly (keeps rules/rendering separate from transport).

## Component 3 — Netcode: Host-Authoritative Game State (`net.ts`)

Reuses the host role from the props work. New `game`-namespaced messages travel
through the same relay. **Message-field discipline:** the relay overwrites the
`id` field with the sender's connection id, so application data never uses `id`
(game id is `g`, squares are `from`/`to`, etc.).

**Client learns its own id:** the relay stamps `id` on relayed messages but a
client does not see its own relayed messages. The DO already sends each client a
`role` message on connect; extend that message to include the connection's own
id (`{t:'role', isHost, id}`) so a client can match itself against the seat map.

**Messages:**
- `gclaim {g}` (guest→host): request a seat. Host assigns the first open seat to
  the sender (`m.id`); ignored if both seats are taken. Broadcasts new `gstate`.
- `gleave {g}` (seated→host): free the sender's seat. Also triggered host-side
  when a `leave` arrives for a connection that holds a seat. Broadcasts `gstate`.
- `gmove {g, from, to}` (seated→host): host validates the sender holds the seat
  whose color equals `turn` and the move is legal, applies via the game's
  authoritative logic, and broadcasts `gstate`. Invalid intents are dropped (the
  sender self-corrects on the next `gstate`).
- `greset {g}` (seated→host): host resets the board to the start position,
  keeps seats, broadcasts `gstate`.
- `gstate {g, board, turn, seats}` (host→all): authoritative snapshot. Broadcast
  on every change **and** as a keyframe every ~2 s so late joiners and spectators
  converge. Payload is tiny (~70 bytes) — far under the relay's 8 KB / 40-msg-per-
  second limits.

**Authority & storage:** the host holds the authoritative game state (board,
turn, seats) in `net.ts` alongside the prop state. Guests hold a received copy
applied to their local `chess.ts` via `applyState`. Only the host mutates
authoritative state; guests send intents.

**Host migration:** the promoted peer adopts the last `gstate` it received (it
was applying them as a guest) and becomes the authority from there. Seat ids in
that state remain valid for still-connected holders.

**Reset on (re)connect:** the game-state store (and any local seat) resets in
`connect()`, matching the prop-state reset already there.

## Component 4 — Spectators & Ambient Board

No special mode: the board already draws in world, and `gstate` keeps every
client's board current, so anyone who pans over watches the game live. A click on
a full board eases the camera in to watch (spectate-focus) without claiming;
leaving returns to free-roam.

## Error Handling & Edge Cases

- **Not connected / single-player:** all co-op paths inert; chess plays both
  sides locally exactly as today (the top safety property).
- **Both seats full:** click = spectate-focus only.
- **Seat holder disconnects:** the relay broadcasts `leave` (existing behavior);
  the host frees that seat and broadcasts `gstate`. Board persists.
- **Move race / illegal or out-of-turn intent:** host drops it; the sender
  reconciles on the next `gstate`.
- **Host migration mid-game:** promoted peer continues from its last `gstate`.
- **Claim race (two clients claim white at once):** host assigns in arrival order;
  the loser gets the next `gstate` showing white taken and (if it clicked) lands
  in the other seat or spectates.

## Testing

- **Primary — manual two-window:** seat white in tab A and black in tab B; play a
  full exchange including a capture and a pawn promotion; confirm turn-gating
  (you cannot move on the other's turn) and that a third tab cannot touch pieces;
  disconnect a seated tab and drop into the freed seat from a new tab; trigger
  "new game" and confirm both boards reset; confirm host migration by closing the
  host tab mid-game. Confirm single-player (no `?room=`) still plays both sides
  with no seat UI.
- **Types:** `npm run check` (`tsc --noEmit`) must pass.
- No unit-test harness exists in the repo; behavioral verification is the scripted
  two-window manual test above.

## Out of Scope (Next Passes)

Dice/cards/backgammon on the same seat layer; check/checkmate/clocks/history;
per-toy sync for the remaining games.
