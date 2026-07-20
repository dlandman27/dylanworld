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
  /** scrolling texture offset for rolling props (marbles) */
  tex: Vec2
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
  /** how fast the dragged paper glides to a stop after release (higher = stickier) */
  paperFriction: number
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
export interface CameraState {
  pos: Vec2
  vel: Vec2
  zoom: number
  /** zoom eases toward this each frame (fluid wheel/pinch) */
  zoomTarget: number
  /** screen point kept fixed while the zoom eases */
  zoomFocus: Vec2
}

export interface InputState {
  screen: Vec2
  world: Vec2
  down: boolean
  grabbed: Prop | null
  /** true while dragging empty paper (panning the sheet) */
  panning: boolean
  /** world point pinned under the cursor while panning */
  panAnchor: Vec2
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
