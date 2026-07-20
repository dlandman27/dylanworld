---
name: new-game
description: Add a new interactive game/toy to the toy-box table. Use whenever Dylan asks to add, build, or prototype any game, toy, or plaything on the table (e.g. "add a jenga tower", "let's put connect four on the table"). Encodes the one-file-per-game format, the house art style, and the physical-feel rules the existing games follow.
---

# New Table Game

Dylan's World is a giant wooden table covered in playable games. Every game is
ONE self-contained file. This skill is the recipe for adding one.

## Hard rules (non-negotiable)

1. **One file per game**: `src/engine/games/<name>.ts` exporting `create<Name>(cx, cy): TableGame`.
   ALL of the game's state, input, physics, and drawing live in that file.
   Never add game-specific logic to `physics.ts`, `input.ts`, `main.ts`, or `table.ts`.
2. **Register it** in `src/engine/games/index.ts` — one import + one line in `createGames()`.
   Draw order = array order; hit-testing runs in reverse (topmost first).
   `createBlocks()` (the hero title) stays LAST so it draws on top.
3. **World coordinates everywhere.** The camera transform is applied by the caller
   before `draw(g)` runs; never touch screen space or the camera.
4. **Typecheck + build before claiming done**: `npx tsc --noEmit && npx vite build`.

## The TableGame contract (`src/engine/games/shared.ts`)

```ts
interface TableGame {
  id: string
  onDown(x, y): boolean   // return true to CAPTURE the pointer (no pan, no prop-grab)
  onMove(x, y): void      // while captured
  onUp(x, y, vx, vy): void // release; (vx, vy) = cursor velocity for flicks
  update(dt, t): void
  draw(g, t): void
}
```

Capture rules learned the hard way:
- Return `true` from `onDown` for ANY press on your game's board/footprint, even
  if it hits nothing interactive — otherwise the table pans mid-play.
- Return `false` for presses outside your footprint so panning still works.
- Generous hit targets: pieces get `size/2 + 6..8` px of slack.
- Bring the pressed piece to the END of your array so it draws on top while held.

## Shared plumbing (import, don't reinvent)

- `shared.ts`: `INK`, `TILE`, `roundRect(g,x,y,w,h,r)`, `pips(g,x,y,s,face)`.
- `spark(x, y, strength)` from `../physics` — comic impact flash + wooden clunk
  sound. Fire it on any solid hit (threshold ~impact speed 130+; strength ≈ speed/900).
- `registerObstacleProvider(fn)` from `../physics` — register solid squares that
  marbles/props bounce off (see `blocks.ts`). Only for grounded, chunky things.
- Colors/fonts from `theme` (`src/config/theme.ts`). Never hardcode new hues
  without checking the palette first: coral/sky/lime/purple/orange/pink/teal +
  gold `#f7c948`, wood tones in `table.ts`/`blocks.ts`.

## House art style (must match or it looks pasted-on)

- Hand-drawn canvas art only. **No emoji, no images, no external assets.**
- Ink outlines (`INK`, lineWidth 2–3.5, `lineJoin 'round'`) on every shape.
- **Hard offset shadows, never blur**: dark shape at `+3..8px x, +5..12px y`,
  `rgba(32,26,23,0.18..0.3)`.
- Chunky rounded corners (`roundRect`, r 6–14).
- Boards get a wooden frame (`#7a4e28`) with the shadow behind it.
- Cream tile/wood faces: `#f0e2be`, `#ecd9ae`, `#e8dfc8`.

## Physical feel (what makes it feel real — Dylan cares about this MOST)

- **Wood bites**: grounded friction high (`exp(-12..24*dt)`). Nothing ice-skates.
  Marbles/pucks are the exception (low friction, they roll/glide).
- **Landings thud**: on any fall/land, kill most horizontal velocity (`*= 0.3`),
  squash-and-stretch (`1+s*0.12, 1-s*0.16`, decay ~6/s), spark + clunk if hard.
- **Lift = airborne**: a held piece rises (scale up ~12%), its shadow drops
  down-right, widens and fades; it passes OVER other pieces without shoving.
- **Flicks use onUp velocity** (spinner/shuffleboard pattern), springs use
  `vel = (target - pos) * 14` while held.
- **Z-height** if pieces can stack/fall: see `blocks.ts` (z, vz, gravity ~4400,
  landing surfaces, edge glance-off, shadow separation, draw sorted by z).
- **Moving textures** must be big-featured and tileable so they don't strobe
  (see marble textures in `physics.ts`).
- Settled pieces sit slightly askew (small random home offsets + resting tilts),
  never machine-gridded.

## Placement on the table (world 5200×3600)

Currently occupied (centers): chess (1000,1050), scrabble (1450,2650),
shuffleboard (3400,1800), cards (4300,1100), dice (2650,2700), spinner
(4300,2750), title blocks (~2600,1240 zone — keep clear), marbles scattered.
Parked: dominoes (module exists, unregistered). Pick an open spot, mention it,
and keep ~150px breathing room from neighbours.

## Process

1. Ask only what's genuinely unclear about the requested game's mechanic (one
   question max — bias to building a playable first pass).
2. Write the one file. Small games ~100 lines (dice), rich games ~200 (chess).
3. Register in `index.ts`, note the chosen table position.
4. `npx tsc --noEmit && npx vite build` — both must pass.
5. Tell Dylan what to try — he tunes by feel and will iterate; expect 2–4
   rounds of "more friction / bigger / bouncier" and treat them as normal.
6. Commit when Dylan confirms the feel (he says when).
