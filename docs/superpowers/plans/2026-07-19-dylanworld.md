# dylanworld Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild dylanlandman.com as an explorable top-down "paper" game world (rsotw style) where a pixel Dylan chases the cursor and every prop has fling physics.

**Architecture:** Vanilla TypeScript engine (no framework) built by Vite. One `<canvas>` renders world/character/physics at 60fps; DOM overlays render popup paper cards. All content and layout live in typed config under `src/config/`; a single `src/types.ts` types everything. Hosted on Vercel, GA4 via gtag.

**Tech Stack:** TypeScript 5, Vite 5, EmailJS browser SDK (CDN), GA4 gtag, Vercel static hosting. No other runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-19-dylanworld-design.md` — read it first.

## Global Constraints

- Background paper color exactly `#f5ecd6`; ink `#201a17`; card `#fefaf0`; accents orange `#f47b28`, coral `#f0563e`, sky `#5aa0db`, purple `#a98fd0`, lime `#b7ce3c`, pink `#ff7fa5`, teal `#2fb0a3`.
- Fonts: Fredoka 500/600/700 (display), Nunito 400/700/800 (body), Space Mono 400/700 (mono accents), via Google Fonts.
- Borders `3px solid` ink; shadows hard offset `6px 6px 0` ink (small: `4px 4px 0`).
- World is 3000×2000 world units. Character sprite is 16×24 logical pixels drawn crisp (no smoothing).
- All object shapes come from `src/types.ts` — no ad-hoc inline object types in engine code.
- Engine code never hardcodes content: anything a visitor reads comes from `src/config/`.
- No test framework: every task verifies with `npx tsc --noEmit` plus a specific manual browser check listed in the task.
- Node 20+. Verification dev server: `npm run dev` → http://localhost:5173.
- Commit after every task (messages given per task).

## File Structure

```
dylanworld/
  index.html                  — shell: canvas, card root, fonts, noscript
  package.json / tsconfig.json / vite.config.ts / .gitignore
  public/resume.html          — recruiter escape hatch (plain page)
  styles/theme.css            — CSS tokens + card/UI styles
  src/
    main.ts                   — boot + game loop
    types.ts                  — ALL interfaces/types
    config/
      theme.ts                — palette + fonts (mirrors theme.css)
      tuning.ts               — game-feel constants
      world.ts                — map size, landmarks, prop spawns
      projects.ts             — project card content
      story.ts                — story trail content
      contact.ts              — contact info + EmailJS keys
      analytics.ts            — GA4 measurement ID ('' = off)
      sprites/dylan.ts        — palette + pixel frames (all directions)
    engine/
      input.ts                — pointer state (mouse+touch), world coords
      physics.ts              — bodies, integration, collisions, fling
      sprites.ts              — pixel-frame renderer
      character.ts            — chase-the-cursor controller + animation
      world.ts                — world drawing + camera
      cards.ts                — DOM card open/close
      analytics.ts            — track() helper (gtag wrapper)
  docs/superpowers/…          — spec + this plan
```

Sprite-authoring note: Tasks 5 and 12 are **art tasks**. The plan supplies the exact data format, complete South-direction frames, one complete example frame per other direction, and a sprite debug viewer. Remaining frames are authored by visual iteration in the viewer — the acceptance check is visual, listed per step.

---

### Task 1: Scaffold — Vite + TS + shell + theme.css

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `styles/theme.css`, `src/main.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: running dev server; `#game` canvas element; `#cards-root` div; CSS tokens all later tasks use.

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "dylanworld",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
export default defineConfig({})
```

`.gitignore`:
```
node_modules/
dist/
.vercel/
```

- [ ] **Step 2: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Dylan Landman — a small world</title>
  <meta name="description" content="Dylan Landman's portfolio: a tiny explorable world. Walk around, fling things, find my projects.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles/theme.css">
</head>
<body>
  <noscript>
    <div class="noscript-card">
      <h1>Dylan Landman</h1>
      <p>Software developer in Hoboken, NJ. This site is a little game world and needs JavaScript.</p>
      <p><a href="/resume.html">Plain resume</a> · <a href="mailto:dylandman287@gmail.com">dylandman287@gmail.com</a></p>
    </div>
  </noscript>
  <canvas id="game"></canvas>
  <div id="cards-root"></div>
  <a id="recruiter-link" href="/resume.html">just the resume →</a>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Write `styles/theme.css`**

```css
:root {
  --ink: #201a17;
  --paper: #f5ecd6;
  --card: #fefaf0;
  --orange: #f47b28;
  --coral: #f0563e;
  --sky: #5aa0db;
  --purple: #a98fd0;
  --lime: #b7ce3c;
  --pink: #ff7fa5;
  --teal: #2fb0a3;
  --border: 3px solid var(--ink);
  --shadow: 6px 6px 0 var(--ink);
  --shadow-sm: 4px 4px 0 var(--ink);
  --font-display: 'Fredoka', 'Segoe UI', sans-serif;
  --font-body: 'Nunito', 'Segoe UI', sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; overflow: hidden; }

body {
  font-family: var(--font-body);
  color: var(--ink);
  background: var(--paper);
}

#game {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
  cursor: crosshair;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

#cards-root { position: fixed; inset: 0; pointer-events: none; z-index: 10; }

#recruiter-link {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 20;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--ink);
  background: var(--card);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm);
  padding: 0.25rem 0.6rem;
  text-decoration: none;
}
#recruiter-link:hover { transform: translate(1px, 1px); box-shadow: 3px 3px 0 var(--ink); }

.noscript-card {
  max-width: 32rem;
  margin: 4rem auto;
  background: var(--card);
  border: var(--border);
  box-shadow: var(--shadow);
  padding: 2rem;
  font-family: var(--font-body);
}
.noscript-card h1 { font-family: var(--font-display); margin-bottom: 0.5rem; }
```

- [ ] **Step 4: Write placeholder `src/main.ts`** (proves the pipeline; replaced in Task 4)

```ts
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = window.innerWidth
canvas.height = window.innerHeight
ctx.fillStyle = '#f5ecd6'
ctx.fillRect(0, 0, canvas.width, canvas.height)
console.log('dylanworld boot ok')
```

- [ ] **Step 5: Install and verify**

Run: `npm install` then `npm run check` — expected: exits 0.
Run: `npm run dev`, open http://localhost:5173 — expected: paper-colored full-screen page, "just the resume →" chip bottom-right, console logs `dylanworld boot ok`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+TS shell with rsotw theme tokens"
```

---

### Task 2: `src/types.ts` — types for everything

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type below, imported by all later tasks. Copy signatures exactly.

- [ ] **Step 1: Write `src/types.ts`**

```ts
// ---------- primitives ----------
export interface Vec2 { x: number; y: number }

// ---------- sprites ----------
/** 8 compass directions; E-side directions render by mirroring W-side art. */
export type Direction = 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE' | 'E' | 'SE'
/** Directions that have authored art (the rest mirror). */
export type AuthoredDirection = 'S' | 'SW' | 'W' | 'NW' | 'N'
export type ActionName = 'idle' | 'walk' | 'jump' | 'skid'

/** One frame: rows of palette keys; '.' = transparent. All rows same length. */
export type PixelFrame = string[]

export interface SpriteSet {
  idle: PixelFrame[]
  walk: PixelFrame[]
  jump: PixelFrame[]
  skid: PixelFrame[]
}

export interface CharacterSprites {
  /** palette key (single char) -> css hex color */
  palette: Record<string, string>
  frameWidth: number
  frameHeight: number
  directions: Record<AuthoredDirection, SpriteSet>
}

// ---------- physics ----------
export type PropKind = 'letter' | 'duck' | 'pebble' | 'ball' | 'cone' | 'leaf' | 'cup'

export interface PhysicsBody {
  pos: Vec2
  vel: Vec2
  radius: number
  mass: number
  sleeping: boolean
}

export interface Prop extends PhysicsBody {
  id: number
  kind: PropKind
  rotation: number
  angVel: number
  grabbed: boolean
  /** for letters: where it drifts home to; undefined for free props */
  home?: Vec2
  /** for letters */
  char?: string
  /** seconds since last disturbed (drives letter return + sleep) */
  restTime: number
}

// ---------- world ----------
export type LandmarkKind = 'project' | 'story' | 'contact' | 'decor'

export interface LandmarkPlacement {
  id: string
  kind: LandmarkKind
  x: number
  y: number
  w: number
  h: number
  label: string
  /** which theme color key paints it, e.g. 'coral' */
  color: string
  /** projects.ts / story.ts entry id this opens; absent for decor */
  cardId?: string
}

export interface Landmark extends LandmarkPlacement {
  /** runtime wobble animation energy, decays to 0 */
  wobble: number
}

export interface PropSpawn {
  kind: PropKind
  x: number
  y: number
  count: number
  /** max random offset from (x,y) in world units */
  spread: number
}

export interface WorldConfig {
  width: number
  height: number
  spawn: Vec2
  /** name shown as physics letters around spawn */
  name: string
  landmarks: LandmarkPlacement[]
  props: PropSpawn[]
}

// ---------- content ----------
export interface LinkRef { label: string; url: string }

export interface ProjectEntry {
  id: string
  title: string
  tags: string[]
  blurb: string
  links: LinkRef[]
}

export interface StoryStop {
  id: string
  title: string
  years?: string
  body: string
}

export interface ContactConfig {
  email: string
  location: string
  socials: LinkRef[]
  emailjs: { publicKey: string; serviceId: string; templateId: string }
}

// ---------- theme / tuning / analytics ----------
export interface Theme {
  colors: {
    ink: string; paper: string; card: string
    orange: string; coral: string; sky: string; purple: string
    lime: string; pink: string; teal: string
  }
  fonts: { display: string; body: string; mono: string }
}

export interface Tuning {
  chaseAccel: number
  maxSpeed: number
  stopRadius: number
  bodyFriction: number
  propFriction: number
  restitution: number
  cameraLag: number
  plowForce: number
  flingPower: number
  letterReturnDelay: number
  letterReturnSpring: number
  duckFleeRadius: number
  duckFleeSpeed: number
  /** distance from camera beyond which props sleep */
  sleepDistance: number
  characterScale: number
}

export interface AnalyticsConfig { measurementId: string }

// ---------- runtime state ----------
export interface CameraState { pos: Vec2 }

export interface InputState {
  screen: Vec2
  world: Vec2
  down: boolean
  grabbed: Prop | null
}

export interface CharacterState {
  body: PhysicsBody
  dir: Direction
  action: ActionName
  frameIndex: number
  frameTime: number
  /** previous nonzero horizontal sign, for skid detection */
  lastDirX: number
}

export interface CardState { openId: string | null }

/** GA4 event names used by track() */
export type WorldEvent = 'name_scattered' | 'project_card_opened' | 'story_card_opened' | 'contact_opened' | 'contact_sent'
```

- [ ] **Step 2: Verify**

Run: `npm run check` — expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: central types.ts typing config, engine, and runtime state"
```

---

### Task 3: Config modules (theme, tuning, analytics, world, projects, story, contact)

**Files:**
- Create: `src/config/theme.ts`, `src/config/tuning.ts`, `src/config/analytics.ts`, `src/config/world.ts`, `src/config/projects.ts`, `src/config/story.ts`, `src/config/contact.ts`

**Interfaces:**
- Consumes: types from `src/types.ts`.
- Produces: `theme: Theme`, `tuning: Tuning`, `analytics: AnalyticsConfig`, `world: WorldConfig`, `projects: ProjectEntry[]`, `story: StoryStop[]`, `contact: ContactConfig` — each the default-less named export of its module.

- [ ] **Step 1: Write `src/config/theme.ts`**

```ts
import type { Theme } from '../types'

export const theme: Theme = {
  colors: {
    ink: '#201a17', paper: '#f5ecd6', card: '#fefaf0',
    orange: '#f47b28', coral: '#f0563e', sky: '#5aa0db', purple: '#a98fd0',
    lime: '#b7ce3c', pink: '#ff7fa5', teal: '#2fb0a3',
  },
  fonts: {
    display: "'Fredoka', 'Segoe UI', sans-serif",
    body: "'Nunito', 'Segoe UI', sans-serif",
    mono: "'Space Mono', ui-monospace, monospace",
  },
}
```

- [ ] **Step 2: Write `src/config/tuning.ts`** (starting values — expect to retune during playtests)

```ts
import type { Tuning } from '../types'

export const tuning: Tuning = {
  chaseAccel: 2600,
  maxSpeed: 520,
  stopRadius: 28,
  bodyFriction: 6.5,
  propFriction: 2.2,
  restitution: 0.55,
  cameraLag: 4.0,
  plowForce: 1.15,
  flingPower: 14,
  letterReturnDelay: 5,
  letterReturnSpring: 2.5,
  duckFleeRadius: 180,
  duckFleeSpeed: 300,
  sleepDistance: 1400,
  characterScale: 3,
}
```

- [ ] **Step 3: Write `src/config/analytics.ts`**

```ts
import type { AnalyticsConfig } from '../types'

/** Empty measurementId disables analytics (dev/preview stay clean). */
export const analytics: AnalyticsConfig = { measurementId: '' }
```

- [ ] **Step 4: Write `src/config/contact.ts`** (keys migrated from old site `js/emailjs.js`)

```ts
import type { ContactConfig } from '../types'

export const contact: ContactConfig = {
  email: 'dylandman287@gmail.com',
  location: 'Hoboken, NJ',
  socials: [
    { label: 'GitHub', url: 'https://github.com/dlandman27' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/dylan-landman' },
  ],
  emailjs: {
    publicKey: '2jjjFIyJd6iwp-gVa',
    serviceId: 'service_ohht1si',
    templateId: 'template_0oh4zgm',
  },
}
```

- [ ] **Step 5: Write `src/config/projects.ts`** (content migrated from old `templates/portfolio.html`)

```ts
import type { ProjectEntry } from '../types'

export const projects: ProjectEntry[] = [
  {
    id: 'rsotw',
    title: 'Random Sites On The Web!',
    tags: ['website', 'playground'],
    blurb: 'A growing collection of random sites I build — some useful, most just fun to poke at. The spiritual parent of the world you are standing in.',
    links: [{ label: 'Visit', url: 'https://randomsitesontheweb.com' }],
  },
  {
    id: 'playbook-raise',
    title: 'Playbook Raise',
    tags: ['work', 'fundraising'],
    blurb: 'A fundraising platform helping kids raise money for their teams and win prizes — over $2 million raised.',
    links: [{ label: 'Visit', url: 'https://playbookraise.com' }],
  },
  {
    id: 'playbook-sports',
    title: 'Playbook Sports',
    tags: ['work', 'saas'],
    blurb: 'The sports SaaS where I work — helping teams and organizations run their sports programs.',
    links: [{ label: 'Visit', url: 'https://callplaybook.com' }],
  },
  {
    id: 'takeoff',
    title: 'Takeoff Esports',
    tags: ['website', 'esports'],
    blurb: 'Site for a professional esports org and clothing company building a community of gamers, creators, and fans.',
    links: [{ label: 'Visit', url: 'https://takeoffgg.com' }],
  },
  {
    id: 'pixel-portfolio',
    title: 'Pixel Portfolio',
    tags: ['website', 'awwwards honorable mention'],
    blurb: 'My previous previous portfolio — a Pokémon-style pixel map you travel around. Earned an Awwwards Honorable Mention. dylanworld is its bigger sibling.',
    links: [{ label: 'Visit', url: 'https://dlandman27.github.io/pixel-portfolio' }],
  },
  {
    id: 'colorle',
    title: 'Colorle',
    tags: ['game', 'rsotw'],
    blurb: 'Wordle, but you guess the RGB of a color. Harder than it sounds.',
    links: [{ label: 'Play', url: 'https://randomsitesontheweb.com/sites/colorle/' }],
  },
  {
    id: 'fractal',
    title: 'Tailwind CSS Fractal',
    tags: ['toy', 'rsotw'],
    blurb: 'A fractal color-scheme explorer — experiment with palettes and watch them bloom.',
    links: [{ label: 'Play', url: 'https://randomsitesontheweb.com/sites/fractal/' }],
  },
  {
    id: 'randomphotos',
    title: 'Picsum Photo River',
    tags: ['tool', 'rsotw'],
    blurb: 'Endless scroll of every Picsum stock photo; click to copy a URL for your own site.',
    links: [{ label: 'Visit', url: 'https://randomsitesontheweb.com/sites/randomphotos/' }],
  },
  {
    id: 'wiigit',
    title: 'Wiigit',
    tags: ['mobile app', 'passion project'],
    blurb: 'A mobile productivity app helping people build better habits with insights on focus and progress over time.',
    links: [],
  },
  {
    id: 'virtual-classroom',
    title: 'Reimagining the Virtual Classroom',
    tags: ['research', 'published'],
    blurb: 'Published ACM research on making virtual classrooms more engaging — better student-teacher interaction inspired by what physical classrooms get right.',
    links: [{ label: 'Read the paper', url: 'https://dl.acm.org/doi/abs/10.1145/3591196.3596617' }],
  },
]
```

- [ ] **Step 6: Write `src/config/story.ts`** (migrated from old `templates/resume.html` + `about.html`)

```ts
import type { StoryStop } from '../types'

export const story: StoryStop[] = [
  {
    id: 'bio',
    title: 'Hi, I\'m Dylan',
    body: 'I build tools that help people grow and discover themselves. Backend foundations, UX care, and a belief that technology should empower, not complicate.',
  },
  {
    id: 'umass',
    title: 'UMass Amherst',
    years: '2020–2023',
    body: 'B.S. in Computer Science. Learned the fundamentals, published research, and started building things that escaped the classroom.',
  },
  {
    id: 'hoboken',
    title: 'Hoboken, NJ',
    body: 'Home base. Across the river from NYC, where the ducks are brave and the coffee is strong.',
  },
  {
    id: 'playbook',
    title: 'Playbook Sports',
    body: 'Where I work — building the platform that helps teams and organizations run their sports programs, including a fundraising product that has raised $2M+ for kids\' teams.',
  },
  {
    id: 'skills',
    title: 'The Toolbox',
    body: 'TypeScript, React & React Native, Node, Django, PostgreSQL, GraphQL, AWS (EC2/ALB/S3/Lightsail), Firebase, Nginx. Frontend to infra and the UX in between.',
  },
]
```

- [ ] **Step 7: Write `src/config/world.ts`**

```ts
import type { WorldConfig } from '../types'

export const world: WorldConfig = {
  width: 3000,
  height: 2000,
  spawn: { x: 1500, y: 1000 },
  name: 'DYLAN LANDMAN',
  landmarks: [
    // Project District — north-east quarter
    { id: 'lm-rsotw', kind: 'project', x: 2150, y: 450, w: 220, h: 170, label: 'Random Sites Arcade', color: 'orange', cardId: 'rsotw' },
    { id: 'lm-playbook-raise', kind: 'project', x: 2450, y: 600, w: 180, h: 150, label: 'Raise HQ', color: 'lime', cardId: 'playbook-raise' },
    { id: 'lm-playbook-sports', kind: 'project', x: 2700, y: 420, w: 180, h: 150, label: 'Playbook Stadium', color: 'sky', cardId: 'playbook-sports' },
    { id: 'lm-takeoff', kind: 'project', x: 2200, y: 800, w: 160, h: 140, label: 'Takeoff Tower', color: 'coral', cardId: 'takeoff' },
    { id: 'lm-pixel-portfolio', kind: 'project', x: 2550, y: 900, w: 150, h: 130, label: 'Old Portfolio Museum', color: 'purple', cardId: 'pixel-portfolio' },
    { id: 'lm-colorle', kind: 'project', x: 2050, y: 1100, w: 130, h: 120, label: 'Colorle Kiosk', color: 'pink', cardId: 'colorle' },
    { id: 'lm-fractal', kind: 'project', x: 2350, y: 1150, w: 130, h: 120, label: 'Fractal Garden', color: 'teal', cardId: 'fractal' },
    { id: 'lm-randomphotos', kind: 'project', x: 2650, y: 1200, w: 130, h: 120, label: 'Photo River', color: 'sky', cardId: 'randomphotos' },
    { id: 'lm-wiigit', kind: 'project', x: 2150, y: 1400, w: 140, h: 120, label: 'Wiigit Workshop', color: 'orange', cardId: 'wiigit' },
    { id: 'lm-paper', kind: 'project', x: 2500, y: 1500, w: 150, h: 120, label: 'Research Library', color: 'purple', cardId: 'virtual-classroom' },

    // Story Trail — western path, roughly top to bottom
    { id: 'lm-bio', kind: 'story', x: 700, y: 400, w: 90, h: 110, label: 'Start Here', color: 'coral', cardId: 'bio' },
    { id: 'lm-umass', kind: 'story', x: 500, y: 700, w: 90, h: 110, label: 'UMass', color: 'coral', cardId: 'umass' },
    { id: 'lm-hoboken', kind: 'story', x: 650, y: 1050, w: 90, h: 110, label: 'Hoboken', color: 'coral', cardId: 'hoboken' },
    { id: 'lm-playbook-story', kind: 'story', x: 450, y: 1400, w: 90, h: 110, label: 'Work', color: 'coral', cardId: 'playbook' },
    { id: 'lm-skills', kind: 'story', x: 700, y: 1650, w: 90, h: 110, label: 'Toolbox', color: 'coral', cardId: 'skills' },

    // Contact Cove — south
    { id: 'lm-mailbox', kind: 'contact', x: 1500, y: 1750, w: 80, h: 110, label: 'Mailbox', color: 'sky', cardId: 'contact' },

    // Decor
    { id: 'lm-welcome', kind: 'decor', x: 1500, y: 700, w: 160, h: 70, label: 'welcome to dylanworld', color: 'lime' },
  ],
  props: [
    { kind: 'duck', x: 1100, y: 1300, count: 5, spread: 150 },
    { kind: 'duck', x: 1900, y: 600, count: 3, spread: 120 },
    { kind: 'pebble', x: 1500, y: 1000, count: 14, spread: 600 },
    { kind: 'ball', x: 1350, y: 850, count: 1, spread: 0 },
    { kind: 'cone', x: 2300, y: 950, count: 4, spread: 200 },
    { kind: 'leaf', x: 800, y: 800, count: 10, spread: 400 },
    { kind: 'cup', x: 650, y: 1080, count: 2, spread: 60 },
  ],
}
```

- [ ] **Step 8: Verify + commit**

Run: `npm run check` — expected: exits 0.

```bash
git add src/config
git commit -m "feat: typed config — theme, tuning, world layout, migrated content"
```

---

### Task 4: Engine core — game loop, camera, world background

**Files:**
- Create: `src/engine/world.ts`
- Modify: `src/main.ts` (replace placeholder entirely)

**Interfaces:**
- Consumes: `world: WorldConfig`, `theme`, `tuning`, types.
- Produces:
  - `createCamera(): CameraState`
  - `updateCamera(cam: CameraState, target: Vec2, dt: number): void`
  - `worldToScreen(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2`
  - `screenToWorld(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2`
  - `drawWorldBackground(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void`
  - `main.ts` exposes the rAF loop pattern all later tasks extend.

- [ ] **Step 1: Write `src/engine/world.ts`**

```ts
import type { CameraState, Vec2 } from '../types'
import { world } from '../config/world'
import { theme } from '../config/theme'
import { tuning } from '../config/tuning'

export function createCamera(): CameraState {
  return { pos: { x: world.spawn.x, y: world.spawn.y } }
}

/** Exponential follow toward target; snaps if prefers-reduced-motion. */
export function updateCamera(cam: CameraState, target: Vec2, dt: number): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const t = reduce ? 1 : 1 - Math.exp(-tuning.cameraLag * dt)
  cam.pos.x += (target.x - cam.pos.x) * t
  cam.pos.y += (target.y - cam.pos.y) * t
  // clamp so the view never leaves the paper
  const halfW = window.innerWidth / 2
  const halfH = window.innerHeight / 2
  cam.pos.x = Math.min(Math.max(cam.pos.x, halfW), world.width - halfW)
  cam.pos.y = Math.min(Math.max(cam.pos.y, halfH), world.height - halfH)
}

export function worldToScreen(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: p.x - cam.pos.x + canvas.width / 2, y: p.y - cam.pos.y + canvas.height / 2 }
}

export function screenToWorld(cam: CameraState, canvas: HTMLCanvasElement, p: Vec2): Vec2 {
  return { x: p.x + cam.pos.x - canvas.width / 2, y: p.y + cam.pos.y - canvas.height / 2 }
}

/** Paper background + subtle ink dot grid + world edge as a hand-drawn border. */
export function drawWorldBackground(ctx: CanvasRenderingContext2D, cam: CameraState, canvas: HTMLCanvasElement): void {
  ctx.fillStyle = theme.colors.paper
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const origin = worldToScreen(cam, canvas, { x: 0, y: 0 })
  // dot grid every 120 units
  ctx.fillStyle = 'rgba(32, 26, 23, 0.08)'
  const step = 120
  const startX = ((origin.x % step) + step) % step
  const startY = ((origin.y % step) + step) % step
  for (let x = startX; x < canvas.width; x += step) {
    for (let y = startY; y < canvas.height; y += step) {
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
    }
  }
  // world border
  ctx.strokeStyle = theme.colors.ink
  ctx.lineWidth = 6
  ctx.strokeRect(origin.x, origin.y, world.width, world.height)
}
```

- [ ] **Step 2: Rewrite `src/main.ts`**

```ts
import { createCamera, updateCamera, drawWorldBackground } from './engine/world'
import { world } from './config/world'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

function resize(): void {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  ctx.imageSmoothingEnabled = false
}
window.addEventListener('resize', resize)
resize()

const camera = createCamera()
let last = performance.now()

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 20) // clamp long tab-away frames
  last = now

  updateCamera(camera, world.spawn, dt)
  drawWorldBackground(ctx, camera, canvas)

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

- [ ] **Step 3: Verify**

Run: `npm run check` — expected: exits 0.
Browser: paper background with a faint dot grid; thick ink rectangle around the world edge is off-screen at spawn (world is bigger than the window) — temporarily change `world.spawn` in devtools? No — instead verify by setting the browser window small and checking the dot grid renders; edge check happens when the character can walk (Task 7).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: engine core — camera, world background, game loop"
```

---

### Task 5: Sprite renderer + South-direction Dylan + sprite debug viewer

**Files:**
- Create: `src/engine/sprites.ts`, `src/config/sprites/dylan.ts`, `sprites.html` (debug viewer, repo root, served by Vite)

**Interfaces:**
- Consumes: `CharacterSprites`, `PixelFrame`, `AuthoredDirection`, `ActionName` types.
- Produces:
  - `dylanSprites: CharacterSprites` (config)
  - `drawFrame(ctx, sprites: CharacterSprites, frame: PixelFrame, x: number, y: number, scale: number, flip: boolean): void` — (x,y) is the frame's bottom-center in canvas pixels.
  - `getFrame(sprites: CharacterSprites, dir: Direction, action: ActionName, index: number): { frame: PixelFrame; flip: boolean }`

- [ ] **Step 1: Write `src/engine/sprites.ts`**

```ts
import type { ActionName, AuthoredDirection, CharacterSprites, Direction, PixelFrame } from '../types'

const MIRROR: Partial<Record<Direction, AuthoredDirection>> = { E: 'W', NE: 'NW', SE: 'SW' }

export function getFrame(
  sprites: CharacterSprites, dir: Direction, action: ActionName, index: number,
): { frame: PixelFrame; flip: boolean } {
  const authored = (MIRROR[dir] ?? dir) as AuthoredDirection
  const set = sprites.directions[authored]
  const frames = set[action].length > 0 ? set[action] : set.idle
  return { frame: frames[index % frames.length], flip: dir in MIRROR }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D, sprites: CharacterSprites, frame: PixelFrame,
  x: number, y: number, scale: number, flip: boolean,
): void {
  const w = sprites.frameWidth
  const h = sprites.frameHeight
  const left = Math.round(x - (w * scale) / 2)
  const top = Math.round(y - h * scale)
  for (let row = 0; row < frame.length; row++) {
    const line = frame[row]
    for (let col = 0; col < line.length; col++) {
      const key = line[flip ? line.length - 1 - col : col]
      if (key === '.') continue
      const color = sprites.palette[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(left + col * scale, top + row * scale, scale, scale)
    }
  }
}
```

- [ ] **Step 2: Write `src/config/sprites/dylan.ts` with the South set**

Palette (derived from dylan.png + new body): `h` hair brown, `d` dark hair shadow, `s` skin, `b` beard, `g` goggles gold, `j` jacket green, `k` jacket dark green, `w` shirt white, `p` pants blue, `o` shoes dark, `i` ink outline.

Complete South frames (16 wide × 24 tall). Idle frame 1:

```ts
import type { CharacterSprites, PixelFrame } from '../../types'

const S_IDLE_1: PixelFrame = [
  '......ihhhi.....',
  '.....ihhhhhi....',
  '....ihhdhhhhi...',
  '....ihgggghi....',
  '....ihgggghi....',
  '....ishssshi....',
  '....issssssi....',
  '....ibsisisbi...',
  '....ibbsssbbi...',
  '.....ibbbbbi....',
  '......issi......',
  '....ijjjjjji....',
  '...ijjwwwwjji...',
  '..ikjwwwwwwjki..',
  '..ikjwwwwwwjki..',
  '..iksjwwwwjski..',
  '...iijjjjjjii...',
  '.....ippppi.....',
  '.....ippppi.....',
  '.....ippippi....',
  '.....ipi.ipi....',
  '.....ipi.ipi....',
  '....iooi.iooi...',
  '....iooi.iooi...',
]
```

Idle frame 2 = frame 1 with the head rows shifted down one row (breathing bob): rows 0–9 move to rows 1–10, row 0 becomes all dots, and the torso stays. Author it literally (copy, shift, fix) — do not compute at runtime.

Walk frames 1–4: torso/head identical to S_IDLE_1; legs (rows 17–23) cycle:

```ts
// walk 1 — left leg forward
const S_WALK_LEGS_1 = [
  '.....ippppi.....',
  '.....ippppi.....',
  '....ippippi.....',
  '....ipi.ippi....',
  '...ipi...ipi....',
  '..iooi...iooi...',
  '..iooi....ioi...',
]
// walk 2 — legs passing (same as idle rows 17–23)
// walk 3 — right leg forward (mirror of walk 1 strings, reversed per row)
// walk 4 — legs passing again
```

Jump frames: 1 = crouch (legs rows compressed: duplicate row 18, drop rows 21–22, shoes directly under pants), 2 = air (both legs tucked: shoes rows replaced by pants-colored tuck), 3 = land-squash (whole frame's head rows shifted down 2, legs splayed like walk 1+3 combined). Skid: idle frame with both arms (`s` pixels at rows 12–15 edges) swapped to leading side and hair rows shifted 1px opposite the motion.

Assemble:

```ts
export const dylanSprites: CharacterSprites = {
  palette: {
    h: '#6b4a2f', d: '#4e3521', s: '#f2c9a0', b: '#8a5a34', g: '#c9a13b',
    j: '#3f6d3f', k: '#2c4f2c', w: '#f4f1e8', p: '#3d5a80', o: '#2b2b2b',
    i: '#201a17',
  },
  frameWidth: 16,
  frameHeight: 24,
  directions: {
    S: { idle: [S_IDLE_1, S_IDLE_2], walk: [S_WALK_1, S_WALK_2, S_WALK_3, S_WALK_4], jump: [S_JUMP_1, S_JUMP_2, S_JUMP_3], skid: [S_SKID_1] },
    SW: { idle: [], walk: [], jump: [], skid: [] }, // authored in Task 12
    W: { idle: [], walk: [], jump: [], skid: [] },
    NW: { idle: [], walk: [], jump: [], skid: [] },
    N: { idle: [], walk: [], jump: [], skid: [] },
  },
}
```

(Empty sets fall back to S via `getFrame`'s `frames.length > 0 ? : set.idle` guard — extend that guard: if the authored set's action AND idle are empty, fall back to `sprites.directions.S`. Implement that fallback in `getFrame` now:)

```ts
const set = sprites.directions[authored]
const primary = set[action].length ? set[action] : set.idle
const frames = primary.length ? primary : (sprites.directions.S[action].length ? sprites.directions.S[action] : sprites.directions.S.idle)
```

- [ ] **Step 3: Write `sprites.html` debug viewer**

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>sprite viewer</title>
<style>body{background:#f5ecd6;display:flex;flex-wrap:wrap;gap:20px;padding:20px;font-family:monospace}</style>
</head><body>
<script type="module">
import { dylanSprites } from '/src/config/sprites/dylan.ts'
import { drawFrame, getFrame } from '/src/engine/sprites.ts'
const dirs = ['S','SW','W','NW','N','NE','E','SE']
const actions = ['idle','walk','jump','skid']
for (const dir of dirs) for (const action of actions) {
  const wrap = document.createElement('div')
  wrap.innerHTML = `<p>${dir} ${action}</p>`
  const c = document.createElement('canvas')
  c.width = 16 * 6; c.height = 24 * 6
  const ctx = c.getContext('2d')
  let i = 0
  setInterval(() => {
    ctx.clearRect(0, 0, c.width, c.height)
    const { frame, flip } = getFrame(dylanSprites, dir, action, i++)
    drawFrame(ctx, dylanSprites, frame, c.width / 2, c.height, 6, flip)
  }, 180)
  wrap.appendChild(c)
  document.body.appendChild(wrap)
}
</script>
</body></html>
```

- [ ] **Step 4: Author + iterate visually**

Open http://localhost:5173/sprites.html. Expected: every direction/action cell animates (non-S directions show S art via fallback). Acceptance for the S set: reads as a small guy with brown hair, goggles on head, beard, green jacket, white shirt, blue pants; idle bobs; walk legs alternate; jump crouch→tuck→squash reads as a hop. Iterate pixel strings until true.

- [ ] **Step 5: Verify + commit**

Run: `npm run check` — expected: exits 0. Every frame string must be exactly 16 chars ×24 rows — add a dev-only assertion at the bottom of `dylan.ts`:

```ts
if (import.meta.env.DEV) {
  for (const [d, set] of Object.entries(dylanSprites.directions))
    for (const [a, frames] of Object.entries(set))
      frames.forEach((f, i) => {
        if (f.length !== 24 || f.some(r => r.length !== 16))
          throw new Error(`bad frame ${d}/${a}[${i}]`)
      })
}
```

```bash
git add -A
git commit -m "feat: sprite renderer, South-direction Dylan set, debug viewer"
```

---

### Task 6: Input — pointer state (mouse + touch)

**Files:**
- Create: `src/engine/input.ts`

**Interfaces:**
- Consumes: `InputState`, `Vec2` types; `screenToWorld` from `engine/world.ts`.
- Produces:
  - `createInput(canvas: HTMLCanvasElement): InputState`
  - `updateInputWorld(input: InputState, cam: CameraState, canvas: HTMLCanvasElement): void` — call every frame to refresh `input.world` (camera moves even when the pointer doesn't).

- [ ] **Step 1: Write `src/engine/input.ts`**

```ts
import type { CameraState, InputState } from '../types'
import { screenToWorld } from './world'

export function createInput(canvas: HTMLCanvasElement): InputState {
  const input: InputState = {
    screen: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    world: { x: 0, y: 0 },
    down: false,
    grabbed: null,
  }

  canvas.addEventListener('pointermove', (e) => {
    input.screen.x = e.clientX
    input.screen.y = e.clientY
  })
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    input.screen.x = e.clientX
    input.screen.y = e.clientY
    input.down = true
  })
  canvas.addEventListener('pointerup', () => { input.down = false })
  canvas.addEventListener('pointercancel', () => { input.down = false })

  return input
}

export function updateInputWorld(input: InputState, cam: CameraState, canvas: HTMLCanvasElement): void {
  input.world = screenToWorld(cam, canvas, input.screen)
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — add after `const camera = createCamera()`:

```ts
import { createInput, updateInputWorld } from './engine/input'
const input = createInput(canvas)
```

and inside `frame()` before `updateCamera`:

```ts
updateInputWorld(input, camera, canvas)
```

Temporary debug line inside frame (removed in Task 7): draw a small ink dot at the cursor's world position:

```ts
const p = worldToScreen(camera, canvas, input.world)
ctx.fillStyle = '#201a17'
ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill()
```

- [ ] **Step 3: Verify + commit**

Browser: an ink dot rides the cursor (and finger on touch emulation). `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: pointer input with world-coordinate tracking"
```

---

### Task 7: Character — chase the cursor, direction + animation, camera follow

**Files:**
- Create: `src/engine/character.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `dylanSprites`, `getFrame`, `drawFrame`, `tuning`, `world` config, `worldToScreen`; types `CharacterState`, `InputState`, `Direction`.
- Produces:
  - `createCharacter(): CharacterState`
  - `updateCharacter(ch: CharacterState, input: InputState, dt: number): void`
  - `drawCharacter(ctx, ch: CharacterState, cam: CameraState, canvas: HTMLCanvasElement): void`

- [ ] **Step 1: Write `src/engine/character.ts`**

```ts
import type { CameraState, CharacterState, Direction, InputState } from '../types'
import { tuning } from '../config/tuning'
import { world } from '../config/world'
import { dylanSprites } from '../config/sprites/dylan'
import { drawFrame, getFrame } from './sprites'
import { worldToScreen } from './world'

const DIRS: Direction[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']

export function createCharacter(): CharacterState {
  return {
    body: { pos: { ...world.spawn }, vel: { x: 0, y: 0 }, radius: 20, mass: 3, sleeping: false },
    dir: 'S',
    action: 'idle',
    frameIndex: 0,
    frameTime: 0,
    lastDirX: 0,
  }
}

export function updateCharacter(ch: CharacterState, input: InputState, dt: number): void {
  const b = ch.body
  const dx = input.world.x - b.pos.x
  const dy = input.world.y - b.pos.y
  const dist = Math.hypot(dx, dy)

  // on touch, only chase while pressed; mouse always chases
  const chasing = dist > tuning.stopRadius

  if (chasing) {
    b.vel.x += (dx / dist) * tuning.chaseAccel * dt
    b.vel.y += (dy / dist) * tuning.chaseAccel * dt
  }
  // friction
  const f = Math.exp(-tuning.bodyFriction * dt)
  b.vel.x *= f
  b.vel.y *= f
  // speed cap
  const speed = Math.hypot(b.vel.x, b.vel.y)
  if (speed > tuning.maxSpeed) {
    b.vel.x = (b.vel.x / speed) * tuning.maxSpeed
    b.vel.y = (b.vel.y / speed) * tuning.maxSpeed
  }
  b.pos.x = Math.min(Math.max(b.pos.x + b.vel.x * dt, b.radius), world.width - b.radius)
  b.pos.y = Math.min(Math.max(b.pos.y + b.vel.y * dt, b.radius), world.height - b.radius)

  // action + skid detection
  const moving = speed > 40
  const dirX = Math.abs(b.vel.x) > 20 ? Math.sign(b.vel.x) : 0
  if (moving && dirX !== 0 && ch.lastDirX !== 0 && dirX !== ch.lastDirX) {
    ch.action = 'skid'
    ch.frameTime = 0
  } else if (ch.action === 'skid' && ch.frameTime < 0.15) {
    // hold skid briefly
  } else {
    ch.action = moving ? 'walk' : 'idle'
  }
  if (dirX !== 0) ch.lastDirX = dirX

  // 8-way direction from velocity angle
  if (moving) {
    const angle = Math.atan2(b.vel.y, b.vel.x) // 0 = east, y down
    const idx = Math.round(angle / (Math.PI / 4))
    ch.dir = DIRS[((idx % 8) + 8) % 8]
  }

  // animation clock — walk speeds up with movement
  const fps = ch.action === 'walk' ? 6 + (speed / tuning.maxSpeed) * 8 : 3
  ch.frameTime += dt
  if (ch.frameTime > 1 / fps) {
    ch.frameTime = 0
    ch.frameIndex++
  }
}

export function drawCharacter(ctx: CanvasRenderingContext2D, ch: CharacterState, cam: CameraState, canvas: HTMLCanvasElement): void {
  const p = worldToScreen(cam, canvas, ch.body.pos)
  // paper shadow
  ctx.fillStyle = 'rgba(32, 26, 23, 0.18)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 4, 18, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  const { frame, flip } = getFrame(dylanSprites, ch.dir, ch.action, ch.frameIndex)
  drawFrame(ctx, dylanSprites, frame, p.x, p.y + 6, tuning.characterScale, flip)
}
```

- [ ] **Step 2: Wire into `src/main.ts`** — replace the debug cursor dot and camera target:

```ts
import { createCharacter, updateCharacter, drawCharacter } from './engine/character'
const character = createCharacter()
```

frame body becomes:

```ts
updateInputWorld(input, camera, canvas)
updateCharacter(character, input, dt)
updateCamera(camera, character.body.pos, dt)
drawWorldBackground(ctx, camera, canvas)
drawCharacter(ctx, character, camera, canvas)
```

- [ ] **Step 3: Verify + commit**

Browser: pixel Dylan chases the cursor with springy overshoot, skids on reversal (S-art fallback for unauthored directions is expected), camera follows him, world border visible when he runs to an edge. `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: cursor-chasing character with 8-way anim states and camera follow"
```

---

### Task 8: Physics — props, plow-through, grab-fling, name letters

**Files:**
- Create: `src/engine/physics.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Prop`, `PropSpawn`, `PhysicsBody`, `tuning`, `world` config, `input`.
- Produces:
  - `createProps(): Prop[]` — spawns from `world.props` + one letter Prop per char of `world.name` arranged around spawn (skip spaces), `home` set.
  - `updatePhysics(props: Prop[], character: PhysicsBody, input: InputState, cam: CameraState, dt: number): void` — integration, prop-prop + character-prop collisions, grab-fling, letter homing, duck flee, distance sleeping.
  - `drawProps(ctx, props: Prop[], cam: CameraState, canvas: HTMLCanvasElement): void` — kind-specific paper-style drawing (letters use Fredoka text).

- [ ] **Step 1: Write `src/engine/physics.ts`**

```ts
import type { CameraState, InputState, PhysicsBody, Prop, PropKind, Vec2 } from '../types'
import { tuning } from '../config/tuning'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { worldToScreen } from './world'

const PROP_SPECS: Record<PropKind, { radius: number; mass: number; color: string }> = {
  letter: { radius: 34, mass: 2.0, color: theme.colors.ink },
  duck:   { radius: 14, mass: 0.8, color: theme.colors.orange },
  pebble: { radius: 7,  mass: 0.5, color: '#b8ab90' },
  ball:   { radius: 18, mass: 1.0, color: theme.colors.coral },
  cone:   { radius: 12, mass: 0.9, color: theme.colors.orange },
  leaf:   { radius: 8,  mass: 0.15, color: theme.colors.lime },
  cup:    { radius: 9,  mass: 0.4, color: theme.colors.sky },
}

let nextId = 1

function makeProp(kind: PropKind, pos: Vec2, home?: Vec2, char?: string): Prop {
  const spec = PROP_SPECS[kind]
  return {
    id: nextId++, kind, char, home,
    pos: { ...pos }, vel: { x: 0, y: 0 },
    radius: spec.radius, mass: spec.mass,
    rotation: 0, angVel: 0,
    grabbed: false, sleeping: false, restTime: 99,
  }
}

export function createProps(): Prop[] {
  const props: Prop[] = []
  // name letters in an arc-free simple row centered on spawn, 2 rows if long
  const chars = world.name.split('')
  const letterGap = 76
  const rowY = world.spawn.y - 130
  const totalW = (chars.length - 1) * letterGap
  chars.forEach((c, i) => {
    if (c === ' ') return
    const pos = { x: world.spawn.x - totalW / 2 + i * letterGap, y: rowY }
    props.push(makeProp('letter', pos, { ...pos }, c))
  })
  for (const spawn of world.props) {
    for (let i = 0; i < spawn.count; i++) {
      const pos = {
        x: spawn.x + (Math.random() * 2 - 1) * spawn.spread,
        y: spawn.y + (Math.random() * 2 - 1) * spawn.spread,
      }
      props.push(makeProp(spawn.kind, pos))
    }
  }
  return props
}

function collide(a: PhysicsBody, b: PhysicsBody): void {
  const dx = b.pos.x - a.pos.x
  const dy = b.pos.y - a.pos.y
  const d = Math.hypot(dx, dy)
  const minD = a.radius + b.radius
  if (d === 0 || d >= minD) return
  const nx = dx / d
  const ny = dy / d
  const overlap = minD - d
  const total = a.mass + b.mass
  a.pos.x -= nx * overlap * (b.mass / total)
  a.pos.y -= ny * overlap * (b.mass / total)
  b.pos.x += nx * overlap * (a.mass / total)
  b.pos.y += ny * overlap * (a.mass / total)
  const rvx = b.vel.x - a.vel.x
  const rvy = b.vel.y - a.vel.y
  const velAlong = rvx * nx + rvy * ny
  if (velAlong > 0) return
  const j = -(1 + tuning.restitution) * velAlong / (1 / a.mass + 1 / b.mass)
  a.vel.x -= (j * nx) / a.mass
  a.vel.y -= (j * ny) / a.mass
  b.vel.x += (j * nx) / b.mass
  b.vel.y += (j * ny) / b.mass
}

export function updatePhysics(props: Prop[], character: PhysicsBody, input: InputState, cam: CameraState, dt: number): void {
  // grab / fling
  if (input.down && !input.grabbed) {
    for (const p of props) {
      if (Math.hypot(p.pos.x - input.world.x, p.pos.y - input.world.y) < p.radius + 14) {
        input.grabbed = p
        p.grabbed = true
        break
      }
    }
  }
  if (!input.down && input.grabbed) {
    input.grabbed.grabbed = false
    input.grabbed = null
  }
  if (input.grabbed) {
    const g = input.grabbed
    g.vel.x = (input.world.x - g.pos.x) * tuning.flingPower
    g.vel.y = (input.world.y - g.pos.y) * tuning.flingPower
    g.restTime = 0
    g.sleeping = false
  }

  const camDist = tuning.sleepDistance
  for (const p of props) {
    // sleep far-away, undisturbed props
    const far = Math.hypot(p.pos.x - cam.pos.x, p.pos.y - cam.pos.y) > camDist
    p.sleeping = far && p.restTime > 2
    if (p.sleeping) continue

    // duck flee
    if (p.kind === 'duck') {
      const dx = p.pos.x - character.pos.x
      const dy = p.pos.y - character.pos.y
      const d = Math.hypot(dx, dy)
      if (d < tuning.duckFleeRadius && d > 0) {
        p.vel.x += (dx / d) * tuning.duckFleeSpeed * dt * 4
        p.vel.y += (dy / d) * tuning.duckFleeSpeed * dt * 4
        p.restTime = 0
      }
    }
    // letter homing after rest
    if (p.home && p.restTime > tuning.letterReturnDelay && !p.grabbed) {
      p.vel.x += (p.home.x - p.pos.x) * tuning.letterReturnSpring * dt
      p.vel.y += (p.home.y - p.pos.y) * tuning.letterReturnSpring * dt
      p.rotation *= 1 - Math.min(1, dt * 2)
    }

    // integrate
    const f = Math.exp(-tuning.propFriction * dt)
    p.vel.x *= f
    p.vel.y *= f
    p.angVel *= f
    p.pos.x = Math.min(Math.max(p.pos.x + p.vel.x * dt, p.radius), world.width - p.radius)
    p.pos.y = Math.min(Math.max(p.pos.y + p.vel.y * dt, p.radius), world.height - p.radius)
    p.rotation += p.angVel * dt
    const speed = Math.hypot(p.vel.x, p.vel.y)
    p.restTime = speed < 8 ? p.restTime + dt : 0

    // character plow
    if (!p.grabbed) {
      const beforeVx = p.vel.x
      collide(character, p)
      // scale scatter with character speed
      if (p.vel.x !== beforeVx) {
        p.vel.x *= tuning.plowForce
        p.vel.y *= tuning.plowForce
        p.angVel += (Math.random() - 0.5) * 8
      }
    }
  }

  // prop-prop collisions (skip sleeping pairs)
  for (let i = 0; i < props.length; i++) {
    const a = props[i]
    if (a.sleeping) continue
    for (let j = i + 1; j < props.length; j++) {
      const b = props[j]
      if (b.sleeping || a.grabbed || b.grabbed) continue
      collide(a, b)
    }
  }
}

export function drawProps(ctx: CanvasRenderingContext2D, props: Prop[], cam: CameraState, canvas: HTMLCanvasElement): void {
  for (const p of props) {
    const s = worldToScreen(cam, canvas, p.pos)
    if (s.x < -80 || s.y < -80 || s.x > canvas.width + 80 || s.y > canvas.height + 80) continue
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(p.rotation)
    const spec = PROP_SPECS[p.kind]
    if (p.kind === 'letter' && p.char) {
      ctx.font = `700 64px ${theme.fonts.display}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = theme.colors.ink
      ctx.fillText(p.char, 0, 0)
    } else if (p.kind === 'duck') {
      // body + head + beak, paper style
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.ellipse(0, 2, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(8, -7, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = theme.colors.coral
      ctx.beginPath(); ctx.moveTo(13, -7); ctx.lineTo(19, -5); ctx.lineTo(13, -3); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = theme.colors.ink
      ctx.beginPath(); ctx.arc(9.5, -8.5, 1.3, 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'cone') {
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.stroke()
    } else {
      // circle-ish props: pebble, ball, leaf, cup
      ctx.fillStyle = spec.color
      ctx.strokeStyle = theme.colors.ink
      ctx.lineWidth = 2.5
      ctx.beginPath(); ctx.arc(0, 0, spec.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      if (p.kind === 'ball') {
        ctx.beginPath(); ctx.arc(0, 0, spec.radius * 0.55, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.restore()
  }
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

```ts
import { createProps, updatePhysics, drawProps } from './engine/physics'
const props = createProps()
```

frame body order:

```ts
updateInputWorld(input, camera, canvas)
updateCharacter(character, input, dt)
updatePhysics(props, character.body, input, camera, dt)
updateCamera(camera, character.body.pos, dt)
drawWorldBackground(ctx, camera, canvas)
drawProps(ctx, props, camera, canvas)
drawCharacter(ctx, character, camera, canvas)
```

- [ ] **Step 3: Verify + commit**

Browser: spawn shows DYLANLANDMAN letters overhead; running through them scatters them with spin; they drift home ~5s after settling; ducks waddle away when approached; click-dragging any prop yanks it to the cursor and releasing mid-drag flings it; pebbles/cones/ball collide with each other. `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: physics props — scatterable name letters, fleeing ducks, grab-fling"
```

---

### Task 9: Landmarks — drawing, wobble reactions, proximity hint

**Files:**
- Create: `src/engine/landmarks.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `world.landmarks`, `theme`, `Landmark` type, character body, `worldToScreen`.
- Produces:
  - `createLandmarks(): Landmark[]`
  - `updateLandmarks(lms: Landmark[], character: PhysicsBody, dt: number): void` — bump detection sets `wobble = 1`, decays; landmarks are solid (push character out with AABB clamp).
  - `drawLandmarks(ctx, lms: Landmark[], cam: CameraState, canvas: HTMLCanvasElement, characterPos: Vec2): void` — kind-specific paper building/signpost/mailbox rendering with label, squash-stretch from `wobble`, "!" hint when the character is within 90 units of an openable landmark.
  - `landmarkNear(lms: Landmark[], pos: Vec2, range: number): Landmark | null`

- [ ] **Step 1: Write `src/engine/landmarks.ts`**

```ts
import type { CameraState, Landmark, PhysicsBody, Vec2 } from '../types'
import { theme } from '../config/theme'
import { world } from '../config/world'
import { worldToScreen } from './world'

export function createLandmarks(): Landmark[] {
  return world.landmarks.map(p => ({ ...p, wobble: 0 }))
}

export function landmarkNear(lms: Landmark[], pos: Vec2, range: number): Landmark | null {
  for (const lm of lms) {
    const cx = Math.min(Math.max(pos.x, lm.x - lm.w / 2), lm.x + lm.w / 2)
    const cy = Math.min(Math.max(pos.y, lm.y - lm.h / 2), lm.y + lm.h / 2)
    if (Math.hypot(pos.x - cx, pos.y - cy) < range && lm.cardId) return lm
  }
  return null
}

export function updateLandmarks(lms: Landmark[], character: PhysicsBody, dt: number): void {
  for (const lm of lms) {
    lm.wobble = Math.max(0, lm.wobble - dt * 2.2)
    // solid AABB: push the character out, trigger wobble on contact
    const left = lm.x - lm.w / 2, right = lm.x + lm.w / 2
    const top = lm.y - lm.h / 2, bottom = lm.y + lm.h / 2
    const cx = Math.min(Math.max(character.pos.x, left), right)
    const cy = Math.min(Math.max(character.pos.y, top), bottom)
    const dx = character.pos.x - cx
    const dy = character.pos.y - cy
    const d = Math.hypot(dx, dy)
    if (d < character.radius) {
      const speed = Math.hypot(character.vel.x, character.vel.y)
      if (speed > 120) lm.wobble = 1
      if (d > 0) {
        const push = character.radius - d
        character.pos.x += (dx / d) * push
        character.pos.y += (dy / d) * push
      } else {
        character.pos.y = bottom + character.radius
      }
    }
  }
}

const COLOR_KEYS = theme.colors as Record<string, string>

export function drawLandmarks(ctx: CanvasRenderingContext2D, lms: Landmark[], cam: CameraState, canvas: HTMLCanvasElement, characterPos: Vec2): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  for (const lm of lms) {
    const s = worldToScreen(cam, canvas, { x: lm.x, y: lm.y })
    if (s.x < -300 || s.y < -300 || s.x > canvas.width + 300 || s.y > canvas.height + 300) continue
    const wob = reduce ? 0 : Math.sin(performance.now() / 60) * lm.wobble * 0.06
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(wob)
    ctx.scale(1 + lm.wobble * 0.04, 1 - lm.wobble * 0.04)
    const w = lm.w, h = lm.h
    const fill = COLOR_KEYS[lm.color] ?? theme.colors.orange
    // hard offset shadow
    ctx.fillStyle = theme.colors.ink
    ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w, h)
    // body
    ctx.fillStyle = fill
    ctx.strokeStyle = theme.colors.ink
    ctx.lineWidth = 3
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    if (lm.kind === 'project') {
      // roof triangle
      ctx.beginPath(); ctx.moveTo(-w / 2 - 8, -h / 2); ctx.lineTo(0, -h / 2 - 34); ctx.lineTo(w / 2 + 8, -h / 2); ctx.closePath()
      ctx.fillStyle = theme.colors.card; ctx.fill(); ctx.stroke()
      // door
      ctx.fillStyle = theme.colors.ink
      ctx.fillRect(-12, h / 2 - 34, 24, 34)
    }
    if (lm.kind === 'story') {
      // signpost pole
      ctx.fillStyle = theme.colors.ink
      ctx.fillRect(-3, h / 2, 6, 24)
    }
    if (lm.kind === 'contact') {
      // mailbox flag
      ctx.fillStyle = theme.colors.coral
      ctx.fillRect(w / 2 - 6, -h / 2 - 18, 6, 18)
    }
    // label
    ctx.font = `600 15px ${theme.fonts.display}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = theme.colors.ink
    ctx.fillText(lm.label, 0, lm.kind === 'decor' ? 0 : h / 2 + (lm.kind === 'story' ? 40 : 18))
    // proximity "!" hint
    if (lm.cardId) {
      const cx = Math.min(Math.max(characterPos.x, lm.x - w / 2), lm.x + w / 2)
      const cy = Math.min(Math.max(characterPos.y, lm.y - h / 2), lm.y + h / 2)
      if (Math.hypot(characterPos.x - cx, characterPos.y - cy) < 90) {
        ctx.font = `700 28px ${theme.fonts.display}`
        ctx.fillStyle = theme.colors.coral
        ctx.fillText('!', 0, -h / 2 - (lm.kind === 'project' ? 52 : 22))
      }
    }
    ctx.restore()
  }
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

```ts
import { createLandmarks, updateLandmarks, drawLandmarks } from './engine/landmarks'
const landmarks = createLandmarks()
```

frame body: `updateLandmarks(landmarks, character.body, dt)` after `updatePhysics`; `drawLandmarks(ctx, landmarks, camera, canvas, character.body.pos)` between `drawWorldBackground` and `drawProps`.

- [ ] **Step 3: Verify + commit**

Browser: buildings in the NE (roofs, doors, hard shadows), coral signposts down the west path, mailbox south, welcome sign north of spawn; running into any at speed makes it wobble; Dylan can't walk through them; a coral "!" appears when he's close to an openable one. `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: landmarks — paper buildings/signposts with wobble and proximity hint"
```

---

### Task 10: Cards — DOM paper popups for projects, story, contact (+ EmailJS)

**Files:**
- Create: `src/engine/cards.ts`
- Modify: `src/main.ts`, `index.html` (EmailJS CDN script), `styles/theme.css` (card styles)

**Interfaces:**
- Consumes: `projects`, `story`, `contact` configs; `CardState`, `Landmark` types; `track` (Task 11 — until then declare `const track = (..._args: unknown[]): void => {}` locally with a `// replaced in Task 11` note and remove it in Task 11).
- Produces:
  - `createCards(): CardState`
  - `openCardFor(state: CardState, lm: Landmark): void` — renders into `#cards-root`
  - `closeCard(state: CardState): void`
  - Click on a landmark (canvas click within its AABB while `cardId` set and character within 140 units) opens its card — wire in main.ts.

- [ ] **Step 1: Add EmailJS CDN to `index.html`** before the module script:

```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
```

- [ ] **Step 2: Add card styles to `styles/theme.css`**

```css
.paper-card {
  pointer-events: auto;
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%) rotate(-0.6deg);
  width: min(30rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100vh - 4rem));
  overflow-y: auto;
  background: var(--card);
  border: var(--border);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  user-select: text;
}
@media (prefers-reduced-motion: no-preference) {
  .paper-card { animation: card-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
  @keyframes card-pop {
    from { transform: translate(-50%, -40%) rotate(2deg) scale(0.8); opacity: 0; }
    to   { transform: translate(-50%, -50%) rotate(-0.6deg) scale(1); opacity: 1; }
  }
}
.paper-card h2 { font-family: var(--font-display); margin-bottom: 0.25rem; }
.paper-card .tags { font-family: var(--font-mono); font-size: 0.7rem; margin-bottom: 0.75rem; color: var(--coral); }
.paper-card p { margin-bottom: 1rem; line-height: 1.5; }
.paper-card .card-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.paper-card a.btn, .paper-card button.btn {
  font-family: var(--font-display); font-size: 0.9rem;
  background: var(--orange); color: var(--ink);
  border: 2px solid var(--ink); box-shadow: var(--shadow-sm);
  padding: 0.4rem 0.9rem; text-decoration: none; cursor: pointer;
}
.paper-card a.btn:active, .paper-card button.btn:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 var(--ink); }
.paper-card .close-btn {
  position: absolute; top: 0.5rem; right: 0.5rem;
  font-family: var(--font-mono); background: var(--card);
  border: 2px solid var(--ink); box-shadow: 2px 2px 0 var(--ink);
  width: 1.8rem; height: 1.8rem; cursor: pointer;
}
.paper-card label { display: block; font-family: var(--font-mono); font-size: 0.75rem; margin: 0.5rem 0 0.2rem; }
.paper-card input, .paper-card textarea {
  width: 100%; border: 2px solid var(--ink); background: var(--paper);
  font-family: var(--font-body); padding: 0.4rem; margin-bottom: 0.4rem;
}
.paper-card .form-status { font-family: var(--font-mono); font-size: 0.75rem; min-height: 1.2em; }
```

- [ ] **Step 3: Write `src/engine/cards.ts`**

```ts
import type { CardState, Landmark } from '../types'
import { projects } from '../config/projects'
import { story } from '../config/story'
import { contact } from '../config/contact'

// replaced in Task 11 with the real analytics import
const track = (..._args: unknown[]): void => {}

declare const emailjs: {
  init(opts: { publicKey: string }): void
  send(service: string, template: string, params: Record<string, string>): Promise<unknown>
}

const root = (): HTMLElement => document.getElementById('cards-root')!

export function createCards(): CardState {
  return { openId: null }
}

export function closeCard(state: CardState): void {
  state.openId = null
  root().innerHTML = ''
}

function shell(state: CardState, inner: string): void {
  root().innerHTML = `<div class="paper-card" role="dialog" aria-modal="true">
    <button class="close-btn" aria-label="Close">×</button>${inner}</div>`
  root().querySelector('.close-btn')!.addEventListener('click', () => closeCard(state))
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeCard(state); document.removeEventListener('keydown', esc) }
  })
}

export function openCardFor(state: CardState, lm: Landmark): void {
  if (!lm.cardId || state.openId === lm.cardId) return
  state.openId = lm.cardId

  if (lm.kind === 'project') {
    const p = projects.find(x => x.id === lm.cardId)
    if (!p) { state.openId = null; return }
    track('project_card_opened', { project_id: p.id })
    shell(state, `
      <h2>${p.title}</h2>
      <div class="tags">${p.tags.join(' · ')}</div>
      <p>${p.blurb}</p>
      <div class="card-links">${p.links.map(l => `<a class="btn" href="${l.url}" target="_blank" rel="noopener">${l.label} →</a>`).join('')}</div>`)
  }

  if (lm.kind === 'story') {
    const s = story.find(x => x.id === lm.cardId)
    if (!s) { state.openId = null; return }
    track('story_card_opened', { stop_id: s.id })
    shell(state, `
      <h2>${s.title}</h2>
      ${s.years ? `<div class="tags">${s.years}</div>` : ''}
      <p>${s.body}</p>`)
  }

  if (lm.kind === 'contact') {
    track('contact_opened', {})
    shell(state, `
      <h2>Say hi</h2>
      <div class="tags">${contact.email} · ${contact.location}</div>
      <form id="contact-form">
        <label for="cf-name">name</label><input id="cf-name" required>
        <label for="cf-email">email</label><input id="cf-email" type="email" required>
        <label for="cf-message">message</label><textarea id="cf-message" rows="4" required></textarea>
        <div class="form-status" id="cf-status"></div>
        <button class="btn" type="submit">Send it</button>
      </form>
      <div class="card-links" style="margin-top:0.75rem">
        ${contact.socials.map(l => `<a class="btn" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('')}
      </div>`)
    emailjs.init({ publicKey: contact.emailjs.publicKey })
    root().querySelector<HTMLFormElement>('#contact-form')!.addEventListener('submit', (e) => {
      e.preventDefault()
      const status = root().querySelector('#cf-status')!
      status.textContent = 'sending…'
      const name = (root().querySelector('#cf-name') as HTMLInputElement).value
      const email = (root().querySelector('#cf-email') as HTMLInputElement).value
      const message = (root().querySelector('#cf-message') as HTMLTextAreaElement).value
      emailjs.send(contact.emailjs.serviceId, contact.emailjs.templateId, {
        to_name: 'Dylan',
        from_name: `${name} @ ${email}`,
        message,
      }).then(() => {
        status.textContent = 'sent! talk soon.'
        track('contact_sent', {})
      }).catch(() => {
        status.textContent = 'failed to send — email me directly?'
      })
    })
  }
}
```

- [ ] **Step 4: Wire clicks in `src/main.ts`**

```ts
import { createCards, openCardFor, closeCard } from './engine/cards'
import { landmarkNear } from './engine/landmarks'
import { screenToWorld } from './engine/world'
const cards = createCards()

canvas.addEventListener('click', (e) => {
  const wp = screenToWorld(camera, canvas, { x: e.clientX, y: e.clientY })
  const clicked = landmarks.find(lm =>
    lm.cardId &&
    Math.abs(wp.x - lm.x) < lm.w / 2 + 20 && Math.abs(wp.y - lm.y) < lm.h / 2 + 20)
  const near = landmarkNear(landmarks, character.body.pos, 140)
  if (clicked && clicked === near) openCardFor(cards, clicked)
  else if (cards.openId) closeCard(cards)
})
```

- [ ] **Step 5: Verify + commit**

Browser: walk to a building, click it → paper card pops with title/tags/blurb/link buttons; Escape and × close it; clicking a faraway building does nothing (must walk over first); story signposts open story cards; mailbox opens the form; submitting with real values shows "sending… / sent!" (verify an email arrives — this is the old site's live EmailJS account). `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: DOM paper cards for projects, story, contact with EmailJS"
```

---

### Task 11: Analytics — GA4 wrapper + events

**Files:**
- Create: `src/engine/analytics.ts`
- Modify: `src/engine/cards.ts` (swap local `track` stub for the import), `src/engine/physics.ts` (name_scattered event), `index.html` (nothing — gtag is injected at runtime only when configured)

**Interfaces:**
- Consumes: `analytics` config, `WorldEvent` type.
- Produces: `initAnalytics(): void`, `track(event: WorldEvent, params: Record<string, string>): void`

- [ ] **Step 1: Write `src/engine/analytics.ts`**

```ts
import { analytics } from '../config/analytics'
import type { WorldEvent } from '../types'

declare global {
  interface Window { dataLayer: unknown[]; gtag: (...args: unknown[]) => void }
}

export function initAnalytics(): void {
  if (!analytics.measurementId) return
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${analytics.measurementId}`
  document.head.appendChild(s)
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args) }
  window.gtag('js', new Date())
  window.gtag('config', analytics.measurementId)
}

export function track(event: WorldEvent, params: Record<string, string>): void {
  if (!analytics.measurementId) return
  window.gtag('event', event, params)
}
```

- [ ] **Step 2: Swap the stub in `cards.ts`** — delete the local `const track = …` line and add:

```ts
import { track } from './analytics'
```

- [ ] **Step 3: Fire `name_scattered` once in `physics.ts`** — module-level flag; in `updatePhysics` where the character-plow branch adjusts a letter's velocity:

```ts
import { track } from './analytics'
let nameScatteredFired = false
// inside the plow branch, after p.vel adjustments:
if (p.kind === 'letter' && !nameScatteredFired) {
  nameScatteredFired = true
  track('name_scattered', {})
}
```

- [ ] **Step 4: Call `initAnalytics()`** at the top of `src/main.ts`:

```ts
import { initAnalytics } from './engine/analytics'
initAnalytics()
```

- [ ] **Step 5: Verify + commit**

With empty measurementId: no gtag network requests in devtools Network tab, no console errors, events are silent no-ops. Temporarily set a fake ID `G-TEST` and confirm the gtag script is requested, then set it back to `''`. `npm run check` exits 0.

```bash
git add -A
git commit -m "feat: GA4 analytics wrapper with world events, off by default"
```

---

### Task 12: Remaining sprite directions (SW, W, NW, N)

**Files:**
- Modify: `src/config/sprites/dylan.ts`

**Interfaces:**
- Consumes: format from Task 5.
- Produces: filled `SpriteSet` for SW, W, NW, N (idle 2, walk 4, jump 3, skid 1 each). E/NE/SE keep mirroring automatically.

- [ ] **Step 1: Author W (side profile)** — complete idle frame 1 to start from:

```ts
const W_IDLE_1: PixelFrame = [
  '......ihhhi.....',
  '.....ihhhhhi....',
  '....ihhhhhhi....',
  '....ihgggghi....',
  '....ihhhhhhi....',
  '....ibsssshi....',
  '....ibssssi.....',
  '....ibbsssi.....',
  '.....ibbsi......',
  '......ibi.......',
  '......issi......',
  '....ijjjjji.....',
  '...ijjjjjjji....',
  '...ikjjjjjki....',
  '...ikjjjjjki....',
  '...iksjjjski....',
  '....ijjjjji.....',
  '.....ipppi......',
  '.....ipppi......',
  '.....ippi.......',
  '.....ipi........',
  '.....ipi........',
  '....ioooi.......',
  '....ioooi.......',
]
```

Profile reads: goggles band across the side of the head, beard on the leading (left) edge, one visible arm, legs overlapping. Walk 1–4: legs scissor (front leg reaches left as back leg trails right, then swap); keep torso rows fixed. Idle 2: head rows shifted down 1. Jump/skid follow the same recipes as South (Task 5 step 2).

- [ ] **Step 2: Author N (back view)** — head is hair-only (no face/goggles: goggles strap `d` row across the back), jacket back with `k` shading down the spine, same leg recipes as S. Start from S frames and replace rows 0–10.

- [ ] **Step 3: Author SW and NW (three-quarter views)** — SW = S frames with head/torso pixels shifted 1–2 columns left and the right arm hidden; NW = N frames with the same leftward bias. Diagonals are the lowest-fidelity views; 'reads correctly at 3× scale in motion' is the bar, not per-pixel beauty.

- [ ] **Step 4: Verify + commit**

http://localhost:5173/sprites.html — all 8 directions × 4 actions animate with distinct art (E/NE/SE mirrored). In the world: run a full circle around a building and confirm the facing reads correctly the whole way, including the Paper Mario mirror-flip crossing W↔E. `npm run check` exits 0 (frame-shape assertion from Task 5 still passing).

```bash
git add src/config/sprites/dylan.ts
git commit -m "feat: full 8-direction sprite art for Dylan"
```

---

### Task 13: Resume escape hatch page

**Files:**
- Create: `public/resume.html` (plain, self-contained — no JS, inline styles using theme tokens)

**Interfaces:**
- Consumes: content from `src/config/story.ts` + `projects.ts` (copied as static HTML — this page is intentionally dependency-free).
- Produces: `/resume.html` reachable from the pinned corner link and noscript block.

- [ ] **Step 1: Write `public/resume.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dylan Landman — Resume</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#201a17; --paper:#f5ecd6; --card:#fefaf0; --orange:#f47b28; --coral:#f0563e; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--paper); color: var(--ink); font-family: 'Nunito', sans-serif; padding: 2rem 1rem; }
  main { max-width: 44rem; margin: 0 auto; background: var(--card); border: 3px solid var(--ink); box-shadow: 6px 6px 0 var(--ink); padding: 2rem; }
  h1, h2 { font-family: 'Fredoka', sans-serif; }
  h1 { margin-bottom: 0.25rem; }
  h2 { margin: 1.5rem 0 0.5rem; border-bottom: 3px solid var(--ink); }
  .sub { color: var(--coral); margin-bottom: 1rem; }
  li { margin: 0.4rem 0 0.4rem 1.2rem; }
  a { color: var(--ink); }
  .back { display: inline-block; margin-top: 1.5rem; font-weight: 700; }
</style>
</head>
<body>
<main>
  <h1>Dylan Landman</h1>
  <p class="sub">Software Developer · Hoboken, NJ · <a href="mailto:dylandman287@gmail.com">dylandman287@gmail.com</a></p>
  <h2>Work</h2>
  <ul>
    <li><strong>Playbook Sports</strong> — engineer on a sports-management SaaS; the fundraising product (Playbook Raise) has raised $2M+ for kids' teams.</li>
  </ul>
  <h2>Education</h2>
  <ul>
    <li><strong>University of Massachusetts Amherst</strong> — B.S. Computer Science, 2020–2023.</li>
  </ul>
  <h2>Selected Projects</h2>
  <ul>
    <li><a href="https://randomsitesontheweb.com">Random Sites On The Web</a> — a growing collection of interactive web toys and games.</li>
    <li><a href="https://dlandman27.github.io/pixel-portfolio">Pixel Portfolio</a> — Awwwards Honorable Mention.</li>
    <li><a href="https://dl.acm.org/doi/abs/10.1145/3591196.3596617">Reimagining the Virtual Classroom</a> — published ACM research.</li>
    <li>Wiigit — mobile habit-insights app (React Native).</li>
  </ul>
  <h2>Skills</h2>
  <ul>
    <li>TypeScript, JavaScript, React, React Native, Node.js, Django, Python</li>
    <li>PostgreSQL, GraphQL, NoSQL, AWS (EC2 / ALB / S3 / Lightsail), Firebase, Nginx</li>
  </ul>
  <p><a class="back" href="/">← back to the world</a></p>
</main>
</body>
</html>
```

- [ ] **Step 2: Verify + commit**

http://localhost:5173/resume.html renders the card; the corner chip on the world links to it; its "back to the world" link returns. `npm run build` succeeds and `dist/resume.html` exists.

```bash
git add public/resume.html
git commit -m "feat: plain resume escape-hatch page"
```

---

### Task 14: Polish pass — touch feel, celebration jump, legend, hidden jokes, perf floor

**Files:**
- Modify: `src/engine/character.ts` (touch behavior + celebration jump), `src/config/world.ts` (corner secrets), `src/engine/physics.ts` (only if the perf check fails), `index.html` + `styles/theme.css` (legend)

- [ ] **Step 1: Touch behavior** — in `updateCharacter`, only chase when the pointer is active on touch devices: add to the chasing condition

```ts
const isTouch = window.matchMedia('(pointer: coarse)').matches
const chasing = dist > tuning.stopRadius && (!isTouch || input.down)
```

(`input` already carries `down`.) Verify with devtools device emulation: Dylan only follows while the finger is down; tap on a nearby landmark still opens its card.

- [ ] **Step 2: Celebration jump** — the jump frames from Task 5 need a trigger. In `CharacterState` add `idleTime: number` (update `src/types.ts` and `createCharacter`). In `updateCharacter`:

```ts
if (ch.action === 'idle') {
  ch.idleTime += dt
  if (ch.idleTime > 5) { ch.action = 'jump'; ch.frameIndex = 0; ch.frameTime = 0; ch.idleTime = 0 }
} else {
  ch.idleTime = 0
}
// jump plays its 3 frames once, then returns to idle
if (ch.action === 'jump' && ch.frameIndex >= 3) ch.action = 'idle'
```

Guard the `ch.action = moving ? 'walk' : 'idle'` line so it doesn't stomp a playing jump: wrap it in `if (ch.action !== 'jump' || moving)`. Verify: leave Dylan idle 5s → he does a little hop, repeats every 5 idle seconds; moving cancels it.

- [ ] **Step 3: Corner legend** — a small hand-drawn compass card, DOM (not canvas), bottom-left. Add to `index.html` after `#recruiter-link`:

```html
<div id="legend">
  <strong>dylanworld</strong>
  <span>↗ projects</span>
  <span>← my story</span>
  <span>↓ mailbox</span>
</div>
```

and to `styles/theme.css`:

```css
#legend {
  position: fixed; left: 0.75rem; bottom: 0.75rem; z-index: 20;
  display: flex; flex-direction: column; gap: 0.1rem;
  background: var(--card); border: 2px solid var(--ink);
  box-shadow: var(--shadow-sm); padding: 0.4rem 0.7rem;
  font-family: var(--font-mono); font-size: 0.7rem;
  transform: rotate(-1deg); pointer-events: none;
}
#legend strong { font-family: var(--font-display); font-size: 0.8rem; }
```

Verify: legend card sits bottom-left, arrows match where the districts actually are from spawn (projects NE, story W, mailbox S).

- [ ] **Step 4: Corner secrets** — add to `world.landmarks`:

```ts
{ id: 'lm-secret-nw', kind: 'decor', x: 150, y: 150, w: 120, h: 60, label: 'you found the corner. it\'s just a corner.', color: 'pink' },
{ id: 'lm-secret-se', kind: 'decor', x: 2850, y: 1880, w: 130, h: 60, label: 'certified world\'s edge inspector', color: 'teal' },
```

and one duck flock at each far corner: `{ kind: 'duck', x: 200, y: 1800, count: 7, spread: 100 }` appended to `world.props`.

- [ ] **Step 5: Perf check** — devtools Performance panel with 6× CPU throttle, run through the letter pile scattering everything: frame time must stay under ~33ms (30fps floor throttled). If it fails, lower prop-prop collision cost: skip pairs where both `restTime > 1`, i.e. add early-continue in the pair loop. Only apply if needed.

- [ ] **Step 6: Verify + commit**

`npm run check` exits 0; play through everything once on desktop + emulated mobile.

```bash
git add -A
git commit -m "feat: touch polish, celebration jump, legend, corner secrets, perf floor"
```

---

### Task 15: README, GitHub, Vercel deploy

**Files:**
- Create: `README.md`
- No vercel.json needed: Vercel auto-detects Vite (`npm run build` → `dist/`).

- [ ] **Step 1: Write `README.md`**

```markdown
# dylanworld

dylanlandman.com — a portfolio you walk around in. Pixel Dylan chases your
cursor through a paper world; projects, story, and contact are places; every
loose thing flings.

Sibling of [randomsitesontheweb.com](https://randomsitesontheweb.com) — same
paper, same palette, same guy.

## Dev

npm install && npm run dev — http://localhost:5173
Sprite viewer: /sprites.html · Type check: npm run check · Build: npm run build

## Configure everything

All content and feel live in `src/config/`:
- `world.ts` — map size, landmark placement, prop spawns
- `projects.ts` / `story.ts` / `contact.ts` — card content
- `theme.ts` — palette + fonts (keep `styles/theme.css` in sync)
- `tuning.ts` — game feel (chase spring, friction, camera lag, scatter)
- `analytics.ts` — GA4 measurement ID ('' = off)
- `sprites/dylan.ts` — the character, frame by frame

Types for all of it: `src/types.ts`.

## Deploy

Vercel, auto-detected Vite. Push to main → production.
Domains at cutover: dylanlandman.com → this; 2020.dylanlandman.com → old repo.
```

- [ ] **Step 2: Create GitHub repo + push**

```bash
gh repo create dlandman27/dylanworld --public --source . --push
```

Expected: repo created, main pushed.

- [ ] **Step 3: Deploy to Vercel**

```bash
npx vercel --yes
npx vercel --prod
```

Expected: preview then production URL printed; site playable at the `*.vercel.app` URL. (Domain cutover — pointing dylanlandman.com here and 2020.dylanlandman.com at the old repo — is a deliberate manual step for Dylan later, NOT part of this plan.)

- [ ] **Step 4: Set GA4 ID**

When Dylan creates the GA4 property: put the `G-…` ID in `src/config/analytics.ts`, commit, push (auto-deploys). Until then it ships off.

- [ ] **Step 5: Final verification + commit**

Full playthrough on the production URL: scatter the name, fling a duck, open every project card, send a real contact message, open /resume.html. `npm run build` exits 0.

```bash
git add README.md
git commit -m "docs: README with config guide and deploy notes"
git push
```
