---
name: map-object-craft
description: Use when adding, building, drawing, restyling, or polishing ANY object on the Dylan's World map — a game, toy, prop, shelf/dresser, wall fixture, sign, globe, or decor. Defines the house bar of care and detail every object must clear before it is "done". Load alongside new-game, table-art-style, and wall-3d-depth.
---

# Dylan's World — The Craft Bar

Every object on the map is held to the SAME bar as the globe: reference-accurate,
built with real technique, alive with micro-interactions, matched to the house
style, and verified by eye. **"It works" is half-done.** If it wouldn't survive
Dylan zooming in, dragging it, and watching it from every angle, it isn't finished.

This is the *definition of done* that sits ON TOP of the how-to skills:
- **REQUIRED:** `table-art-style` (every drawn object) and `wall-3d-depth` (anything on a wall).
- **REQUIRED for games/toys:** `new-game` (file format + physical feel).

Those tell you *how* to draw. This tells you *how good* it has to be.

## Rule 0 — your first pass is the FLOOR, not the deliverable

The #1 failure: shipping the first plausible version and making Dylan ask for
more. It happens every single time — the globe's blob continents, "the bowl is
boring", "make the fish smaller", "fill the bowl more", the flat lava blobs. Each
was a reasonable first pass. None cleared the bar. **Overshoot BEFORE you show it.**

Before presenting anything, run it through these — and fix what they catch yourself,
don't wait to be told:

- **Ship your 3rd idea, not your 1st.** The obvious version is generic. Push past
  it to real technique + real reference + real density.
- **Fill the space.** One plant + gravel reads empty. A real fishbowl has kelp,
  an ornament, pebbles, a starfish, caustics, and a full water line. Populate it.
- **Sweat the numbers.** Count, size, fill level, and speed are almost always wrong
  on pass 1. Tune them toward the real thing *before* showing, not after.
- **Critique against the real thing first.** Hold your version next to a photo of
  the real object in your head. What's missing / flat / toy-ish? Fix that, then show.

Recurring first-pass misses — fix them proactively:

| First pass | Almost always needs |
|---|---|
| One or two decorations | A populated scene — layers of decor, ornaments, life |
| Big hero elements | Smaller, and MORE of them (a school, not 3 giants) |
| Half-filled container | Filled to a believable real level |
| Flat / independent parts | Real coupled behaviour (metaballs merge, fish undulate) |
| The first speed you picked | Slower — real-world languor |

## How to actually clear it — build with an adversarial checker loop

You are invested in your first pass; a fresh reviewer is not. For any NEW object
or substantial restyle (or anything Dylan called "boring / flat / not enough"),
run a subagent loop BEFORE Dylan ever sees it — don't build-and-ship in one head:

1. **Builder subagent** — implements the object to this bar + `table-art-style` /
   `wall-3d-depth` / `new-game`. Returns the diff and which bar items it addressed.
2. **Checker subagent — adversarial.** Hand it THIS skill as the rubric and tell it
   its job is to FAIL the work. It reads the diff and hunts for:
   - **Rule 0 misses:** too plain / too few / too big / half-filled / too fast / one lonely decoration.
   - **Dead object:** no idle life, a dead click, no momentum verb, no reward.
   - **Fake technique:** flat independent parts where real coupled behaviour belongs;
     eyeballed magic numbers where real data/reference exists; `sin`/`cos` on raw `t`
     (milliseconds) instead of `t * 0.001`.
   - **Latent artifacts:** negative radii, unclipped/see-through spheres, NaN,
     fold-through — read the draw code and flag them.
   - Runs `npx tsc --noEmit`.
   Returns **PASS** or a numbered, specific, actionable **FAIL** list.
3. **FAIL → builder revises every item → re-check.** Loop until PASS or 3 rounds
   (then surface the remaining items to Dylan — don't hide them).
4. **PASS is necessary, not sufficient** — the checker can't see the canvas. Only
   then do the visual pass below yourself / with Dylan.

Keep it proportional: a one-line tweak doesn't need the loop; a new toy, a restyle,
or a "make it better" does.

## The bar — all of it, every object, every time

### 1. Reference-accurate — use real data, never eyeball it
If the thing exists in the real world, reproduce it from a REAL source.
- Get the actual asset — an SVG / vector / real spec / the real value — not a
  screenshot to trace by hand. Ask Dylan for it if you don't have it.
- Extract it into a committed data file; don't inline hand-guessed magic numbers.
- *Globe:* the hand-drawn continent blobs looked like a kid's doodle; parsing the
  world-map SVG into real lon/lat (`src/config/worldMap.ts`) made it look like Earth.
- Authentic specifics are the whole payoff — the real clock time, real battery,
  real map (see `table-art-style`, "Real details over fake ones").

### 2. Real technique — no fake shortcut that glitches
Use the correct math/rendering. A cheat that looks fine head-on but breaks at an
angle is NOT done.
- *Globe:* orthographic lat/lon projection + front-hemisphere **clipping** (cut
  each coastline at the horizon, rejoin along the limb). The shortcut — clamp
  back-facing points to the rim — smeared coloured wedges across the sphere and
  was rejected.
- If it flickers, folds, sees through itself, jitters, or throws (negative radius,
  NaN) at ANY rotation / zoom / state → that's a bug, not a style choice. Find the
  root cause (`superpowers:systematic-debugging`), don't paper over it.

### 3. On-style — obey the house skills and match its siblings
Flat top-down, bold ink outline, hard offset shadow, flat fills (`table-art-style`).
Wall pieces get filled reveal faces + a projecting/receding plane + a cast shadow
(`wall-3d-depth`). And match neighbours: the globe borrowed the marbles' curvature
crescent + glint so every sphere on the table reads the same way.

### 4. Alive — micro-interactions are mandatory
A static object is half-built. Every object earns at least:
- **Idle life** — a bob, blink, sway, drift, lazy spin. Never dead-still.
- **Press feedback** — depress / shrink / spark on tap. Never a dead click.
- **A manipulable verb** where it fits — drag / spin / fling with **momentum** and
  a lazy return, not a one-shot nudge. (*Globe:* click-drag to spin, flick releases
  velocity, eases back to an idle spin.)
- **Reward** — `spark()` / `clunk()` on impact, a settle-bounce, a callout.
- **Nothing teleports** — ease toward targets (`v += (target - v) * min(1, dt*k)`);
  every state change animates.

### 5. Right feel — units and speed
- `t` from the loop is **milliseconds**. Convert once: `const ts = t * 0.001`
  before any `sin`/`cos`. Skipping this makes everything strobe ("spassing").
- `dt` is **seconds** — integrate motion with it.
- Tune to real-world languor: lava blobs on ~30s cycles, fish glide, a globe idles
  slow. Fast reads cheap and wrong. The first speed you pick is always too fast.

### 6. Verify by EYE, not just typecheck
- `npx tsc --noEmit` (and `npx vite build` for a new game file) must pass —
  necessary, not sufficient.
- Then actually LOOK at it on the running server and drive EVERY state: rotate it,
  drag it, zoom in, let it idle, press each part. Artifacts (see-through, folds,
  wedges, jitter) only appear in motion.
- Not done until it survives that.

## The smell test before you call it done
- Did I use the REAL reference/data, or eyeball it?
- Does it glitch at any angle / zoom / state?
- Does it obey `table-art-style` / `wall-3d-depth` and match its siblings?
- Idle life + press feedback + (where it fits) a momentum verb + a reward?
- Trig in seconds (`t * 0.001`)? Speeds languid?
- Did I watch it run and exercise every state?

## Red flags — "good enough" thoughts that mean STOP
| Thought | Reality |
|---|---|
| "The rough shape reads fine" | The globe's blobs read "fine" too — until the real coastlines shipped. Get the data. |
| "It looks right head-on" | Rotate / drag / zoom it. Craft lives at the edges. |
| "It's just decor, static is fine" | Nothing on this map is dead. Give it idle life + press feedback. |
| "Typecheck passes, done" | Typecheck can't see a see-through globe. Look at it. |
| "A nudge is enough interaction" | Dylan wants to grab and spin it — momentum + return. |
| "Close enough on speed" | The first pass is always too fast. Slow it to real. |
| "It's a solid first version" | First versions are the FLOOR. Dylan will always ask for more — add it now (Rule 0). |
| "That's probably enough detail" | It's probably half. Fill the space; add the ornaments; sweat the count/size/fill. |

Expect **3–10 iterations** per object. The globe took ~10. That's not overkill —
that IS the bar.
