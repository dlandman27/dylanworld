import type { ActionName, AuthoredDirection, CharacterSprites, Direction, PixelFrame } from '../types'

const MIRROR: Partial<Record<Direction, AuthoredDirection>> = { E: 'W', NE: 'NW', SE: 'SW' }

export function getFrame(
  sprites: CharacterSprites, dir: Direction, action: ActionName, index: number,
): { frame: PixelFrame; flip: boolean } {
  const authored = (MIRROR[dir] ?? dir) as AuthoredDirection
  const set = sprites.directions[authored]
  const primary = set[action].length ? set[action] : set.idle
  const frames = primary.length ? primary : (sprites.directions.S[action].length ? sprites.directions.S[action] : sprites.directions.S.idle)
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
