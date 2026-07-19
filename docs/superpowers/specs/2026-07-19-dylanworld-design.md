# dylanworld — Design Spec

**Date:** 2026-07-19
**Repo:** `dylanworld` (new repo, this one)
**Replaces:** `digitalportfolio` as the site served at **dylanlandman.com**
**Old site:** stays in its own repo, moves to **2020.dylanlandman.com** at cutover

## Overview

Dylan's portfolio rebuilt as an explorable game world in the style of randomsitesontheweb (rsotw): a top-down "paper" world you wander with a pixel-art Dylan character who chases your cursor. Everything in the world is interactive — loose props have fling physics, landmarks wobble and react, and the portfolio content (projects, story, contact) lives inside the world as places you discover.

Tone: fun-first, full rsotw energy. Recruiters get a small "just the resume" escape-hatch link.

## The World

- One fixed-size top-down map, roughly **3000×2000 world units**.
- Background is the rsotw paper color **`#f5ecd6`**, with the rsotw art language throughout: ink outlines (`#201a17`), hard offset shadows, warm palette (orange `#f47b28`, coral `#f0563e`, sky `#5aa0db`, purple `#a98fd0`, lime `#b7ce3c`, pink `#ff7fa5`, teal `#2fb0a3`), Fredoka/Nunito/Space Mono type.
- World art (buildings, trees, paths, signs) is drawn in code — canvas vector shapes in the paper/ink style. No image assets except the character spritesheet data.

## Opening Scene

- Visitor spawns dead-center of the world. **DYLAN LANDMAN** surrounds the spawn point in huge letters.
- Every letter is a physics body: running through them shoves, tumbles, and scatters them in any direction. This is the first lesson: *everything here moves.*
- Letters slowly drift back to their home positions after a few seconds idle, so the name re-forms.

## Character & Controls

- **Movement model:** Dylan chases the cursor (puppy-on-a-leash), with springy overshoot — leans into turns, skids on stops, occasional excited hop. On touch devices he follows the finger while pressed.
- **Camera** follows Dylan (not the cursor) with soft lag.
- **Character:** full-body pixel Dylan. Head derived from rsotw's `dylan.png` (goggles, brown hair, beard); new body: green jacket, jeans, shoes. Roughly **16×24 logical pixels**, rendered crisp (`image-rendering: pixelated` equivalent via scaled canvas draws with smoothing off).
- **9 views total**, Paper Mario-style flat sprite: 8 compass directions (author **5** — S, SW, W, NW, N — and mirror horizontally for SE, E, NE) plus a front-facing idle stance used when he's standing still.
- **Actions per direction:**
  - Idle — 2 frames (breathing bob; blink on front view)
  - Walk/Run — 4 frames (cycle plays faster at higher speed)
  - Jump — 3 frames (crouch, air, land-squash)
  - Skid/Turn — 1 frame (Paper Mario flip when reversing)
- ≈**50 hand-authored pixel frames** total, stored as compact pixel-data arrays in `js/sprites.js` (palette-indexed strings or arrays), drawn to canvas. No PNG files, so colors/pixels are instantly tweakable.
- **Build order (risk control):** ship-worthy first pass is S/W/N idle+walk; diagonals, jump, and skid layer in afterward. Pixel authoring is the riskiest workstream — iterate on the arrays.

## Physics & Interaction

- Hand-rolled physics: velocity, friction, restitution; circle and AABB collisions. No physics engine dependency.
- **Loose props** (name letters, pebbles, ducks, leaves, cones, soccer ball, coffee cups…) are physics bodies. Two fling paths:
  1. Dylan plows through them — scatter scales with his speed.
  2. Cursor grab-fling — click/touch-drag any loose prop and throw it.
- **Fixed landmarks** don't move but react on contact: wobble, squash-and-stretch, ring, light up.
- Ducks actively flee from Dylan.

## Destinations (Content)

Scattered across the map; findable by wandering. A small hand-drawn compass/legend sits in a screen corner for the impatient.

- **Project District** — each project is a building/contraption. Approach → it wobbles → interact (click or bump) → DOM paper card pops open with screenshot, blurb, links. Project list migrated from `digitalportfolio/portfolio/index.html`.
- **Story Trail** — winding ink path; stops (UMass, Hoboken, jobs…) are signposts that open short story cards. Content migrated from the old resume/story page.
- **Contact Cove** — mailbox opens a mini contact form reusing the existing **EmailJS** wiring; GitHub/LinkedIn as physical signposts.
- **Fun props everywhere** and hidden jokes in map corners as exploration rewards.
- **Dropped:** newsletter section.
- **Recruiter escape hatch:** tiny "just the resume" ink link pinned in a corner, opening a plain readable resume page.

## Architecture

- **No build step, no framework.** Static files served by GitHub Pages.
- **Rendering split:** one `<canvas>` renders world + character + physics props (60fps target with hundreds of bodies). DOM overlays render only the popup paper cards, so text is selectable and the contact form is a real form.
- **Files:**
  - `index.html` — shell, canvas, card containers
  - `js/world.js` — map layout, landmarks, camera
  - `js/sprites.js` — pixel-data spritesheets + sprite renderer
  - `js/physics.js` — bodies, collisions, fling logic
  - `js/cards.js` — DOM card open/close, content data
  - `styles/` — card + UI styles (rsotw tokens)
- **Mobile:** touch-drag leads Dylan; tap landmark to open; props fling by finger. No thumbstick.
- **Deploy:** GitHub Pages on this repo with CNAME `dylanlandman.com` at cutover. Until cutover, preview via the repo's default Pages URL. Old repo's CNAME changes to `2020.dylanlandman.com` at the same time.

## Error Handling & Edge Cases

- **No JS / tiny screens:** `<noscript>` shows name + resume link + contact links.
- **Reduced motion:** respect `prefers-reduced-motion` — camera snaps instead of springs, props still draggable but ambient wobble off.
- **Performance floor:** if frame time degrades (older phones), cap active physics bodies by sleeping distant props.
- **Content migration happens before any cutover** — old site stays live at dylanlandman.com until dylanworld is done and reviewed.

## Testing

- Manual playtest checklist per feature (movement feel, fling in both paths, every card opens/closes, EmailJS send works, mobile touch path, reduced-motion mode).
- Devtools throttled-CPU pass for the performance floor.
- No test framework — matches the no-build vanilla setup.

## Success Criteria

- Feels like an rsotw site that happens to be a portfolio: a visitor's first 10 seconds are scattering the name letters and chasing ducks.
- All old portfolio content (projects, story, contact) reachable inside the world.
- 60fps on a mid-range laptop; playable on a phone.
- dylanlandman.com serves dylanworld; 2020.dylanlandman.com serves the old site.
