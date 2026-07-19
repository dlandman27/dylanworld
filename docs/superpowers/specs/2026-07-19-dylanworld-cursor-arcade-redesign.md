# Dylan's World — cursor-arcade redesign

**Date:** 2026-07-19
**Status:** approved (brainstorm), pending plan

## The problem

The current build shares rsotw's *skin* (paper palette, ink borders, chunky
offset shadows, playful fonts, pixel Dylan) but not its *soul*. Playing both
back to back, the gap is structural, not cosmetic:

- **rsotw's home page** runs on **surprise, density, and instant delight** —
  every inch of the page does something distinct, the cursor itself is the star,
  and you're rewarded for poking everywhere.
- **dylanworld** runs on **traversal and information** — you steer pixel Dylan
  across a mostly-empty 3000×2000 field to reach a landmark, which opens a card
  of résumé text. Once you learn "Dylan chases the cursor, fling the ducks,"
  the surprise is over, and most of the screen is paper you walk across.

Same clothes, different animal. No amount of recoloring closes it.

## The goal

Keep **the content of dylanworld** (projects, story, contact) and give it **the
soul of the rsotw home page**: cursor-driven, dense, instantly delightful, full
of hidden gags — with the steerable character removed.

## The metaphor: a paper map on a desk

Everything hangs off one frame — **a physical paper sheet you slide around with
your hand.** It justifies every mechanic (drag to slide it, grab things off it,
everything's a paper toy), and it's dead-on with the existing paper/ink look.

## Core interaction model

- **Cursor = your hand. No steerable avatar.** The pixel-Dylan-chases-cursor
  loop is exactly what makes this a walking-sim instead of an arcade; it is
  removed. Dylan is demoted to a reactive mascot that lives *on* the sheet.
- **Drag empty paper → pan the map. Drag a prop → grab & fling it. Hover near
  anything → it reacts (no click needed).** One rule: is there a grabbable thing
  under the hand? grab it; otherwise slide the sheet.
- **Momentum on both** — the sheet glides and settles on release (paper has
  weight); flung props keep the existing physics.
- **The recruiter escape hatch stays** — the `just the resume →` link and
  `/resume.html` remain, so a serious visitor can bail to plain text in one click.

## The map gets dense and small

The current empty gaps between clusters *are* the traversal problem. New target:
**roughly 1.5–2 screens wide**, everything packed so that from any resting spot
you can see three or four things worth touching. No pan longer than a short
flick should land on blank paper. **Density is the single biggest lever on the
rsotw feel** — the home page rewards poking everywhere, so something must always
be within reach.

## Content becomes toys, not cards

**Governing rule:** a landmark is not a button that opens a card of text — it's a
paper object whose *behavior teases the thing it represents*, and touching it is
what reveals the content. The real info still exists, delivered as the *reward*
for poking: a small sticker-card with a one-line pitch and a `visit →`, never a
wall of text. Each toy echoes its own project:

| Content | The paper toy | Playing does |
|---|---|---|
| Random Sites Arcade | a tiny slot-machine / die | poke → spits a random weird site name (mirrors Surprise Me) → `visit →` |
| Colorle | a blank paper swatch | drag across → it stains through colors → reveals the game |
| Fractal Garden | a single small shape | tug → it recursively buds into a fractal |
| Photo River | a thin strip | a parade of photos flows past; grab one to peek |
| The Toolbox (skills) | a paper toolbox | tip it → labeled tools spill out (TypeScript, React, Node…) |
| Hoboken | ducks + coffee cup *(already props)* | ducks flee your hand; the scene *is* the story |
| Mailbox (contact) | a real mailbox | drag a letter in → it actually sends (EmailJS) |

- **Hero title:** *Dylan's World*, rendered large and bold — the biggest thing on
  the sheet, the first thing you see — then it breaks into grabbable letters you
  can fling and **post in the mailbox** (the intro gag becomes the contact
  mechanic).
- **Ambient props** (ducks, pebbles, cones, leaves, cups) all stay — connective
  tissue that makes every inch grabbable.
- **Scope honesty:** the *pattern* + a toy *framework* is the deliverable; the
  ~16 individual toy behaviors are iterative visual work (like the `/sprites.html`
  flow) — build the framework and a first pass, then tune each by feel.

## The delight & surprise layer

**1. The Cursor Shop — a destination, not a menu.** The rsotw cursor customizer
is ported *whole* (the `CURSORS` array, the hand-drawn sticker draws — arrow,
paintball, crate, slot, bomb, lens, die, `dylan` face… — and the particle-overlay
fx engine of trails + click bursts), but the UI is no longer a floating panel.
Instead it's a **shop landmark on the sheet**: pan to it, click it, and a
shopfront opens showing the cursors as wares you *buy*.

- **Light economy.** Each cursor has a **price in a currency** (coins), and you
  spend to equip it — purchased cursors stay owned. Prices live in
  `src/config/` alongside a wallet balance.
- **All prices are 0 for now.** The shop, wallet counter, and buy flow are fully
  built, but every cursor costs 0, so nothing is gated yet. Tuning prices (and
  wiring where coins are *earned* — likely from achievements/secrets) is a later
  pass; the scaffolding lands now.
- The fx overlay itself is a fixed layer independent of the game canvas, so it
  rides over the world regardless of where the shop sits.

**Persistent artifacts stay persistent and live in world-space** — paint splats,
stamps, and dropped crates pan *with* the sheet, so the paper accumulates evidence
you were here.

**2. Dylan the mascot** (personal signature, kept). Lives on the sheet, reacts,
never steers: eyes track the cursor, blinks, flinches/ducks when a prop is flung
near him, waves at the bio spot, falls asleep with Zzz when idle (rsotw's
`spawnZzz` is liftable).

**3. The "basement" equivalent — the underside of the sheet.** Pan far past the
edges and fall off the paper onto the dark desk / back of the page, where scrapped
stuff lives — `old ideas`, `2019`, a `DO NOT OPEN` box (rsotw's basement,
reskinned). *"you dragged too far."*

**4. Sticker-album achievements** (rsotw's system, ported): quiet, collectible
rewards for finding secrets — flinging Dylan, posting the whole name, finding the
underside, spilling the toolbox.

## What we reuse vs. cut

- **Cut:** the steerable character (sprite, cursor-chase, plow-through-props),
  and the sprite-art tasks tied to it.
- **Keep from the existing engine:** physics props + flinging, the camera (now
  eased toward a pan target instead of the character), the scattering name
  letters, ducks/props, config-driven `src/config/` structure.
- **Port from rsotw:** the entire cursor customizer + fx particle engine, the
  sticker-album achievements, `spawnZzz`, the basement gags.

## Non-goals

- Not a scrolling page and not a single fixed screen — it stays a pannable world.
- Not rebuilding rsotw's site catalog; this is a portfolio, the arcade energy is
  the delivery mechanism.
- No emoji in UI/effects — hand-drawn canvas stickers only (matches house style).

## One-line summary

Your résumé as a paper map on a desk — drag it around with your bare cursor, and
everything on it is a toy that teases a piece of who you are, with a full cursor
arcade of hand-drawn pointers layered over the top.
