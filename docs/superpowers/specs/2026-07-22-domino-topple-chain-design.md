# Domino Topple Chain — design

**Date:** 2026-07-22
**Status:** Approved, ready to build

## Summary

A new table toy: a pre-laid winding path of ~20 standing dominoes on an open
stretch of felt. Tap any domino and the fall ripples *outward from the tap point
in both directions*, each domino knocking the next with a wooden clack. Once the
whole line is down and settles, the dominoes rise back up in a reverse ripple —
always ready to replay. No build step, no mess, endlessly re-tappable.

This is a distinct toy from the existing (parked) `dominoes.ts`, which is a
"slide tiles around with momentum" toy. The topple chain is a scripted cascade.

## The top-down rendering (the crux)

The table is a flat overhead view, so a *standing* domino and a *fallen* one look
completely different from above. Each domino has a base point (its pivot) and a
fall direction (toward its neighbor down the line). A per-domino `fall` value
0→1 drives the whole look:

- **`fall = 0` (standing):** drawn in `drawAbove` so it floats over the shadow
  layer like the spinning tops. A short `TILE` rounded-rect (the thin top edge)
  with a hard offset ink shadow underneath → reads as "domino standing on its
  end, seen from above."
- **`0 < fall < 1` (toppling):** the drawn face *grows* from that thin edge out
  to the full 46×92 face along the fall direction, pivoting from the base — it
  visibly lays down onto where the next one stands. Pips fade in near the end.
- **`fall = 1` (down):** full face flat with pips, drawn in the normal `draw`
  pass (below standing pieces) with a soft contact shadow.

## Path

A smooth hand-laid S-curve (sine-based control points), ~20 dominoes spaced
evenly along it. Exposed as `createTopple(cx, cy)` like every other game, so it
can be repositioned by changing one argument. Initial placement: open
upper-middle felt around `2000, 750`.

## Cascade logic

Scripted, not physics — more reliable and reads better top-down.

- Tapping domino *i* sets a wave front advancing to `i+1, i+2…` and `i−1, i−2…`
  at ~1 domino per 60ms (tap-anywhere, propagates both directions).
- Each domino eases its `fall` 0→1 over ~180ms when the front reaches it, firing
  `clunk()` on landing with strength scaled so it's a satisfying patter, not a
  machine-gun (the clunk helper already rate-limits at 30ms).
- After the last lands + a settle beat (~1.2s), a reverse ripple eases the
  dominoes back to standing (`fall` 1→0) so the toy resets itself.

## Interaction decisions

- **Tap anywhere** starts the cascade from that domino (forgiving).
- **Auto stand-up** after settle, no click required to reset.
- While a cascade is in progress, a new tap is ignored (or restarts) — pick
  ignore for simplicity.

## Scope / footprint

- One new file `src/engine/games/topple.ts` implementing the `TableGame`
  interface (`onDown/onMove/onUp/update/draw/drawAbove`).
- Registered in `src/engine/games/index.ts`.
- No new dependencies, no image/sound assets. Reuses `clunk()` from
  `engine/audio.ts` and `roundRect`/`pips`/`TILE`/`INK` from `games/shared.ts`.

## House-style constraints

Follows the table-art-style rules: flat top-down, bold ink outlines, hard offset
shadows, no gradients. `drawAbove` for the standing (tall) pieces so shadows and
the overhead cloud pass fall correctly.

## Verification

- `npm run check` (tsc `--noEmit`) must pass.
- Manual: run the app, tap the chain, confirm the cascade ripples both ways,
  clacks fire, and the line stands itself back up.
