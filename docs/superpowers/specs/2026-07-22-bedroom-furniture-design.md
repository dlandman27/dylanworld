# Bedroom furniture — the room stops feeling empty

**Problem.** The playroom reads as lifeless/sparse: bare wall bands, wide plank-only
gaps, and no furniture — "no cabinets, no desk, no bed." It's a floor with toys,
not anyone's room.

**Decision (brainstormed with Dylan, 2026-07-22).** Approach A: perimeter
furniture, mostly scenery with a functional trio. Layout B variant chosen via
visual companion: bed head on the EAST wall (version 1), door moved to the
BOTTOM-LEFT wall, rug stays the exact center of the room.

## Room

- World grows 5200×3600 → **6600×4600**. Every existing coordinate shifts
  **+700 x, +940 y** so the rug (keyed to spawn) sits at the new center
  (3300, 2300) and nothing moves relative to anything else.
- Door leaves the west wall; it re-hangs on the **bottom wall near the left
  corner** (t ≈ 0.74–0.828 along C→E, ~580 world units wide) with the light
  switch beside it and the outlet mid-wall.

## Furniture (one file per piece, TableGame contract, house art style)

| Piece | File | Pos (center) | Function |
|---|---|---|---|
| Bed + nightstand | `games/bed.ts` | (6050, 2350) head on E wall | press → quilt squash, teddy hop; lamp on nightstand toggles a warm pool |
| Desk + chair | `games/desk.ts` | (2900, 4350) on S wall | laptop press → opens `/resume.html`; mug steams |
| Bookshelf | `games/bookshelf.ts` | (4700, 210) on N wall | books slide out/in on press |
| Dresser | `games/dresser.ts` | (250, 1500) on W wall | drawer slides open → opens the cursor shop |
| Toy chest | `games/toychest.ts` | (800, 4260) by the door | lid opens, toys pop out with z-physics; press again to pack up |
| Potted plant | `games/plant.ts` | (6330, 320) NE corner | leaves rustle on press |

- Furniture registers obstacle squares (marbles bounce off it).
- Furniture draws FIRST in `createGames()` (under game pieces); hit-testing is
  reverse order so games/props still win contested presses.
- All art follows `table-art-style` (flat fills, ink outlines, hard offset
  shadows, top-down); wall changes follow `wall-3d-depth`.

## Out of scope (later)

Wall posters/frames, second window, ambient-life pass, guestbook/traces,
progression/collectibles — those were the other "empty" axes Dylan named;
this slice is the "fuller room."
