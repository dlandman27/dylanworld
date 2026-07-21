---
name: table-art-style
description: The house rendering style for Dylan's World — the visual rules EVERY drawn object on the table must follow (flat top-down, bold ink outlines, hard offset shadows, no gradients). Load this BEFORE drawing or restyling any canvas art (a game, prop, toy, cursor, UI piece). If a new object "looks nothing like the other assets," this is why — follow it.
---

# Dylan's World — Table Art Style

Every object on the table is a hand-drawn sticker seen from **top-down**. They
all share one look. New art that ignores this reads as pasted-in and gets
rejected. Match this exactly.

## The five non-negotiables

1. **Flat fills — NO gradients.** `fillStyle` is a solid color. Never
   `createLinearGradient` / `createRadialGradient` for a body or face. (The
   machined-metal pieces — tops, magnifier rim — are the ONE sanctioned
   exception, and even they stay subtle. A red button, a ball, a card, a
   token: flat.)
2. **Bold ink outlines.** Stroke every shape with `INK` (`#201a17`),
   `lineWidth` 2–3.5, `lineJoin: 'round'`. No outline = doesn't belong.
3. **Hard offset shadow, never blur.** A dark shape (`rgba(32,26,23,0.18..0.26)`)
   offset `+4..8px x, +6..12px y` behind the object. Never `shadowBlur`.
4. **Top-down, not side-view 3D.** Objects lie flat on the table. Depth is
   faked with a thin side band + the offset shadow (see blocks.ts, tops), NOT
   with perspective domes or vanishing points. A round button is a **disc**
   seen from above, not a photographed dome.
5. **Chunky + slightly askew.** Rounded corners (`roundRect`, r 6–14). Settled
   objects sit at a small random tilt, never perfectly axis-aligned.

## Palette (from src/config/theme.ts — never invent hues without checking)

- Ink `#201a17`; paper/card creams `#f5ecd6` / `#fefaf0` / `#f0e2be` / `#ecd9ae`
- coral `#f0563e`, sky `#5aa0db`, lime `#b7ce3c`, purple `#a98fd0`,
  orange `#f47b28`, pink `#ff7fa5`, teal `#2fb0a3`, gold `#f7c948`
- wood `#d3a163` / `#b5915a`; steel `#cfd3d6` / `#9aa0a5`; felt-green `#79ad4a`
- **No emoji, no images, no external assets.** Canvas paths only.

## Highlights & sheen (how to look glossy without a gradient)

- A **flat translucent white blob** for a glint:
  `ellipse(-r*0.35, -r*0.4, r*0.2, r*0.11, -0.6, ...)` filled
  `rgba(255,255,255,0.28..0.9)`. Clip to the shape first.
- A **crescent shadow** for curvature (spheres): fill the shape, then an
  even-odd `arc(0,0,r)` + offset `arc(-r*0.18,-r*0.22,r*0.92,...,true)` in
  `rgba(32,26,23,0.14)`. See `rollingBall.ts`.
- Rolling spheres: use `drawRollingBall()` from `engine/rollingBall.ts` — do
  NOT hand-roll scroll/fisheye/tiling. Supply body color + a `paint` cell.

## Text on objects

- Display font for big labels: `900 …px "Arial Black", <theme.fonts.display>`.
- White fill + ink `strokeText` underneath (outline first, fill on top),
  `lineJoin: 'round'`. Same recipe the blocks and coins use.

## Reference implementations (read one before you draw)

- Flat disc + label + press: **easybutton.ts** (the corrected version)
- Flat top-down wheel: **spinner.ts**; discs: coin/chip draws in **physics.ts**
- Faked depth done right: **blocks.ts** (side band + bevel), **top.ts**
- Sphere with rolling texture: **rollingBall.ts** + marble/soccer cells

## The smell test before you commit a drawing

- Did I use a gradient for a body/face? → replace with a flat fill.
- Does every shape have an ink outline? → add it.
- Is there a hard offset shadow (not blur)? → add it.
- Is it top-down, or did I draw a 3D side view? → flatten it.
- Screenshot it next to a coin and the spinner. If it looks like a different
  art pack, it is — fix it before shipping.
