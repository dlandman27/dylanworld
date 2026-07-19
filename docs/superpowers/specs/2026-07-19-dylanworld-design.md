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
- ≈**50 hand-authored pixel frames** total, stored as compact pixel-data arrays (palette-indexed strings) in typed sprite data under `src/config/sprites/`, drawn to canvas by `src/engine/sprites.ts`. No PNG files, so colors/pixels are instantly tweakable.
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

- **TypeScript + Vite.** No framework — the engine is hand-written TS compiled by Vite to a static bundle. `npm run dev` for local play, `npm run build` for the deployable output.
- **Config-driven world:** all content and world layout live in typed config, never in engine code. Adding a project, moving a building, recoloring the palette, or adding a duck is a config edit.
  - `src/config/world.ts` — map size, districts, landmark placements, prop spawns
  - `src/config/projects.ts` — project cards (title, blurb, image, links)
  - `src/config/story.ts` — story-trail stops
  - `src/config/theme.ts` — palette, fonts, shadow/outline tokens (rsotw values as defaults)
  - `src/config/tuning.ts` — game-feel constants (chase spring, friction, camera lag, scatter force)
  - All config typed via interfaces in `src/config/types.ts`, so bad config fails at compile time.
- **Rendering split:** one `<canvas>` renders world + character + physics props (60fps target with hundreds of bodies). DOM overlays render only the popup paper cards, so text is selectable and the contact form is a real form.
- **Engine modules (`src/engine/`):** `world.ts` (map + camera), `sprites.ts` (pixel-data spritesheets + renderer), `physics.ts` (bodies, collisions, fling), `cards.ts` (DOM card open/close), `input.ts` (mouse/touch).
- **Mobile:** touch-drag leads Dylan; tap landmark to open; props fling by finger. No thumbstick.

## Hosting & Analytics

- **Vercel** hosts the site (same model as rsotw production): deploy = git push, Vite build runs on Vercel, static output served on its CDN. Serverless functions are available later if an API is ever wanted (e.g. visitor guestbook) — none needed at launch.
- **Google Analytics (GA4)** via the client gtag script, loaded from config (`src/config/analytics.ts` holds the measurement ID; empty ID = analytics off, so dev/preview stays clean). Track page view plus a few world events: name-letters scattered, project card opened (which one), contact sent.
- **Domains at cutover:** `dylanlandman.com` points to the Vercel project. Old `digitalportfolio` repo (GitHub Pages) gets its CNAME changed to `2020.dylanlandman.com`. Until cutover, preview on the default `*.vercel.app` URL.

## Error Handling & Edge Cases

- **No JS / tiny screens:** `<noscript>` shows name + resume link + contact links.
- **Reduced motion:** respect `prefers-reduced-motion` — camera snaps instead of springs, props still draggable but ambient wobble off.
- **Performance floor:** if frame time degrades (older phones), cap active physics bodies by sleeping distant props.
- **Content migration happens before any cutover** — old site stays live at dylanlandman.com until dylanworld is done and reviewed.

## Testing

- Manual playtest checklist per feature (movement feel, fling in both paths, every card opens/closes, EmailJS send works, mobile touch path, reduced-motion mode).
- Devtools throttled-CPU pass for the performance floor.
- `tsc --noEmit` type-checking is the automated safety net (typed config catches content mistakes at compile time). No unit-test framework at launch; can add Vitest later if engine logic grows.

## Success Criteria

- Feels like an rsotw site that happens to be a portfolio: a visitor's first 10 seconds are scattering the name letters and chasing ducks.
- All old portfolio content (projects, story, contact) reachable inside the world.
- 60fps on a mid-range laptop; playable on a phone.
- dylanlandman.com serves dylanworld; 2020.dylanlandman.com serves the old site.
