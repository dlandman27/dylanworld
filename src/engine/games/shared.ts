import { theme } from '../../config/theme'

// Shared bits for the table games: the game interface the input system talks to,
// plus small drawing helpers used across games.

export type Ctx = CanvasRenderingContext2D
export const INK = theme.colors.ink
export const TILE = '#f0e2be'

/**
 * A game on the table. All coordinates are WORLD coordinates (the caller applies
 * the camera transform before draw). onDown returning true captures the pointer:
 * the world won't pan and props won't grab until onUp.
 */
export interface TableGame {
  id: string
  /** pointer pressed at (x, y) — return true to capture the gesture */
  onDown(x: number, y: number): boolean
  /** pointer moved while captured */
  onMove(x: number, y: number): void
  /** pointer released while captured; (vx, vy) = cursor velocity in world units/s */
  onUp(x: number, y: number, vx: number, vy: number): void
  update(dt: number, t: number): void
  draw(g: Ctx, t: number): void
  /** optional second pass drawn ABOVE the props layer (tall standing pieces) */
  drawAbove?(g: Ctx, t: number): void
}

export function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

export function pips(g: Ctx, x: number, y: number, s: number, face: number): void {
  const P: Record<number, [number, number][]> = {
    1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  }
  g.fillStyle = INK
  for (const [px, py] of P[face] ?? []) {
    g.beginPath(); g.arc(x + px * s * 0.3, y + py * s * 0.3, s * 0.09, 0, Math.PI * 2); g.fill()
  }
}
