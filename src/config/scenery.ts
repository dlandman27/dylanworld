// Soft ground regions, walking paths, and ponds that turn the blank paper into a
// place. Coordinates are keyed to the landmark layout in world.ts: story trail in
// the west, project district in the east, mailbox to the south, ducks by the ponds.

export interface Region { x: number; y: number; rx: number; ry: number; color: string; alpha: number }
export interface Pond { x: number; y: number; rx: number; ry: number }

export const regions: Region[] = [
  // the park the story trail runs through (west)
  { x: 640, y: 1020, rx: 520, ry: 920, color: 'lime', alpha: 0.22 },
  // the plaza the project district sits on (east)
  { x: 2400, y: 950, rx: 560, ry: 780, color: 'orange', alpha: 0.12 },
  // a soft meadow around spawn / the title
  { x: 1500, y: 1080, rx: 520, ry: 380, color: 'lime', alpha: 0.12 },
]

export const ponds: Pond[] = [
  { x: 1120, y: 1320, rx: 260, ry: 165 }, // the big duck pond (matches the 5-duck spawn)
  { x: 1900, y: 620, rx: 175, ry: 120 },  // a small pond by the 3-duck spawn
]

// hand-drawn walking paths (world-space polylines) linking the districts
export const paths: number[][][] = [
  [[1500, 1000], [1120, 760], [820, 520], [700, 400]],                 // spawn → story start
  [[700, 400], [520, 720], [660, 1040], [460, 1400], [700, 1650]],     // the story trail itself
  [[1500, 1000], [1860, 840], [2180, 720], [2500, 560]],               // spawn → project district
  [[2150, 900], [2450, 1050], [2650, 1200]],                           // through the projects
  [[1500, 1010], [1500, 1380], [1500, 1740]],                          // spawn → mailbox
]
