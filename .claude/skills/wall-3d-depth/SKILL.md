---
name: wall-3d-depth
description: How to draw ANYTHING on the room's walls so it reads as real 3D architecture (windows, doors, moldings, wainscot, shelves, wall fixtures) instead of a flat sticker. Load this BEFORE drawing or editing any built element on a wall in src/engine/walls.ts. If a wall element "looks like a flat piece of paper," this is why — it's missing reveal faces, a projecting/receding plane, or a cast shadow.
---

# Wall 3D Depth — Dylan's World

The table is flat top-down (see `table-art-style`). The **walls are different**: they
fold up from the floor edges and everything on them must read as **built 3D
architecture** — depth into/out of the wall, not shapes painted on a plane.

The #1 failure mode: drawing a flat rectangle and faking depth with a few thin
bevel *lines*. That always looks like a sticker. Depth comes from **filled faces
at different shades**, a **projecting or receding plane**, and a **cast shadow**.

## The wall coordinate system (`src/engine/walls.ts`)

Every wall is drawn by `drawWall`, which gives you:

- **`P(t, s)`** — maps wall space to the screen. `t` = fraction ALONG the wall
  (0→1 end to end); `s` = fraction UP the wall (`0` = floor seam, `1` = ceiling).
  `P` already bakes in the fold/perspective. Draw everything through it.
- **inward direction** `inx = -dy/len, iny = dx/len` — the unit vector pointing
  OFF the wall surface toward the room (the viewer). This is how things project
  out of the wall. (`dx,dy` = the floor edge `p1-p0`; `len` its length.)

Two helpers you'll reuse: `fillQ(t0,t1,s0,s1,col)` (fill a wall-space rect) and
`quad(ctx,a,b,c,d)` (fill/stroke an arbitrary 4-point world polygon).

## ORIENTATION: art follows the fold — the BOTTOM wall is INVERTED on screen

Every wall's content orients **up-the-wall** (increasing `s`), exactly like the
clouds. On the **bottom wall, up-the-wall points DOWN-SCREEN**, so anything
representational there — the door, picture frames, taped drawings, fixtures —
must be drawn **inverted relative to the screen**. Do NOT "helpfully" flip art
screen-upright on the bottom wall: it breaks the fold and reads pasted-on
(this failed in practice with taped kid-drawings drawn screen-upright — Dylan
flagged them immediately; same lesson as the door's lock, which had to be
rotated into the door's leaning frame instead of standing screen-vertical).
Practical rules:

- Build fixtures in a local wall frame (`fixtureFrame` / `wpt` in walls.ts) so
  they lean and flip WITH the wall — never in raw screen coordinates.
- Side walls render their art sideways (up-the-wall = left/right). That's
  correct; leave it.
- Details INSIDE an element follow the element's own frame (a lock follows its
  door), including which end is its "floor" end.

## THE SCALE TRAP (read this first)

`t` maps to the wall's *length* (thousands of world units); `s` maps to its
*depth* `D` (~900). **They are not the same world scale.** So a shape with equal
`t` and `s` fractions comes out badly **stretched** (very wide, short). Two fixes:

1. **Small fixtures / repeated motifs** (switches, outlets, pennants): build them
   in **world units** around a center. Get local axes from `P` and offset in
   world space — see `wpt()` and `drawBunting`'s tangent-frame flags.
2. **Molding overhangs**: make offsets **proportional to the element's own
   width** (`(t1-t0)*k`), never a fixed `t` constant, so they scale with it.

## The three depth moves

### 1. PROJECT — a molding that stands OFF the wall toward the room

Chair rail, baseboard, crown, window sill, door casing. Push the front edge out
along inward: `push(p,d) = p + inward*d`. Then paint the visible faces:

- a **lit top face** (the ledge you'd see) — bright (`#f6f7f8`/white),
- a **shaded fascia / outer side** (the thickness) — mid grey (`#b7bdc3`),
- a **cast shadow** on the wall/wainscot below it,
- a thin **highlight line** along the front lip.

The whole protruding *slab* trick (wainscot): offset the entire panel by
inward*WD with `Pw(t,s)`, then its **top face recedes back** to the recessed wall
above — `quad(Pw(0,sW),Pw(1,sW),P(1,sW),P(0,sW))`. That step IS the depth.

### 2. RECESS — a panel or opening sunk INTO the wall

Door panels, jambs, outlet sockets. NEVER just draw 4 bevel lines. Draw the
**four reveal faces** as filled quads between the outer rect and an inset inner
rect, plus a **sunken center face**:

```
top reveal    → shadow (#ccd1d6)     left reveal  → shadow (#d2d7dc)
bottom reveal → light  (#fbfcfd)     right reveal → light  (#f3f5f7)
center face   → mid    (#e3e6e9)     then ink the inner + outer rects
```

Light is upper-left, so faces pointing up/left fall in shadow, down/right catch
light. (See the door panels in `drawDoor`.)

### 3. VANISHING POINT — a DEEP recess (the window)

For a real "hole in a thick wall," use **one shared vanishing point** so every
depth edge converges. Critical rule learned the hard way:

> The VP must live **HIGH INSIDE the opening** (`lp(midBottom, midTop, ~0.82)`),
> never outside/above it. If the VP is outside the opening, the back plane
> (glass) scales *past* the opening and pokes out above the frame.

- Recessed back plane = the opening corners scaled toward the VP:
  `G = lp(frontCorner, VP, rec)`.
- The four reveal faces connect front opening corners → back plane corners; they
  auto-converge because they aim at the VP. Bottom becomes a deep lit **sill
  well**, top a short **head**, sides rake in.
- Elements that project toward the viewer (sill, crown) sit on the *near* side of
  the VP: move their front edge with `away(p) = p + normalize(p-VP)*dist`, or
  toward it if they're above the VP.

## Always add

- **Cast shadow**: a dark quad (`rgba(32,26,23,0.12–0.18)`) offset down-right
  (`+~10x, +~11y`), drawn BEFORE the element. This is what lifts it off the wall.
- **Ambient occlusion**: a darker ink/stroke in the deep inner corners (where a
  reveal meets the glass/panel floor).
- **Ink outlines** on every face edge (house style), `lineWidth` 1.5–4.

## Never

- Fake a recess/projection with only thin lines. Use **filled shaded faces**.
- Use gradients. Flat fills only (`table-art-style` rule).
- Use raw `t`/`s` fractions for something meant to look square — it WILL stretch.
- Put the window's VP outside the opening.

## Smell test before shipping a wall element

1. Is there at least one face that is a **different shade** implying a plane
   turned away from the light? If every face is the same white → flat.
2. Does it cast a **shadow** on the wall? If not → it's floating/pasted.
3. For a recess: can I see the **reveal faces** (the inside walls of the hole),
   or did I only outline it?
4. Screenshot it next to the window. If the window reads 3D and this doesn't,
   it's missing one of the three moves above.

## Reference implementations (read one before you draw)

- Deep recess + VP + blinds + molded sill/crown: **`drawWindow`**
- Protruding slab + top-face-as-chair-rail: the wainscot block in **`drawWall`**
- Projecting molding (ledge + fascia + shadow): the chair rail & baseboard in **`drawWall`**
- Recessed panels + projecting casing + jamb returns: **`drawDoor`**
- World-unit fixtures (no stretch): **`wpt`, `drawSwitch`, `drawOutlet`, `drawBunting`**
