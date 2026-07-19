import { theme } from './theme'

// Hand-drawn sticker cursors, ported from rsotw's cursor arcade. Each cursor is
// a 32×32 canvas sticker (ink shadow + fill + outline) turned into a CSS cursor,
// plus an fx recipe: a motion trail and a click burst. No emoji — canvas only.

type Ctx = CanvasRenderingContext2D
const c = theme.colors
const INK = c.ink
export const GOLD = '#f7c948'
const GRAPHITE = '#3a3733'
const ZAP = '#ffd94a'

export const PALETTE: string[] = [c.coral, c.sky, c.lime, c.purple, c.orange, c.pink, c.teal]
export const anyPaint = (): string => PALETTE[(Math.random() * PALETTE.length) | 0]

// Dylan's pixel portrait (same asset rsotw uses for its 'dylan' cursor)
export const faceImg = new Image()
faceImg.src = '/dylan.png'

// ---- 32×32 shape paths (~3px margin leaves room for the hard ink shadow) ----
const arrowPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(5, 3); x.lineTo(5, 23); x.lineTo(10, 18.5); x.lineTo(13.5, 26)
  x.lineTo(17, 24.5); x.lineTo(13.5, 17.5); x.lineTo(20, 17.5); x.closePath()
}
const starPath = (x: Ctx): void => {
  x.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 12 : 5
    const a = -Math.PI / 2 + (Math.PI * i) / 5
    const px = 16 + Math.cos(a) * r, py = 16 + Math.sin(a) * r
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py)
  }
  x.closePath()
}
const heartPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(16, 27)
  x.bezierCurveTo(4, 18, 4, 8, 11, 6)
  x.bezierCurveTo(14, 5, 16, 8, 16, 10)
  x.bezierCurveTo(16, 8, 18, 5, 21, 6)
  x.bezierCurveTo(28, 8, 28, 18, 16, 27)
  x.closePath()
}
const boltPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(18, 3); x.lineTo(8, 18); x.lineTo(14, 18); x.lineTo(11, 28)
  x.lineTo(24, 13); x.lineTo(17, 13); x.lineTo(22, 3); x.closePath()
}
const pencilPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(6, 26); x.lineTo(9, 17); x.lineTo(23, 3); x.lineTo(28, 8); x.lineTo(14, 22); x.closePath()
}
const gunPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(3, 10); x.lineTo(25, 10); x.lineTo(25, 16); x.lineTo(15, 16)
  x.lineTo(17, 27); x.lineTo(10, 27); x.lineTo(8, 16); x.lineTo(3, 16); x.closePath()
}

// sticker treatment: hard ink shadow, then fill, then bold ink outline
const sticker = (path: (x: Ctx) => void, fill: string, stroke?: string) => (x: Ctx): void => {
  x.save(); x.translate(1.5, 1.5); path(x); x.fillStyle = INK; x.fill(); x.restore()
  path(x)
  x.fillStyle = fill
  x.lineWidth = 1.75
  x.lineJoin = 'round'
  x.strokeStyle = stroke || INK
  x.fill(); x.stroke()
}

// lucky die (rounded square with pips) — its own draw, not a simple path
const PIPS: Record<number, [number, number][]> = {
  5: [[10, 10], [22, 10], [16, 16], [10, 22], [22, 22]],
}
const dieDraw = (x: Ctx): void => {
  x.save(); x.translate(1.5, 1.5)
  roundRect(x, 4, 4, 24, 24, 5); x.fillStyle = INK; x.fill(); x.restore()
  roundRect(x, 3, 3, 24, 24, 5)
  x.fillStyle = c.card; x.fill()
  x.lineWidth = 2; x.strokeStyle = INK; x.stroke()
  x.fillStyle = INK
  for (const [px, py] of PIPS[5]) { x.beginPath(); x.arc(px, py, 2.4, 0, Math.PI * 2); x.fill() }
}
function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

const faceDraw = (x: Ctx): void => {
  x.imageSmoothingEnabled = false
  if (faceImg.complete && faceImg.naturalWidth) x.drawImage(faceImg, 2, 2, 28, 28)
  else { roundRect(x, 4, 4, 24, 24, 6); x.fillStyle = c.orange; x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke() }
}

export type TrailKind = 'comet' | 'stars' | 'drips' | 'none'
export type ClickKind = 'confetti' | 'nova' | 'paint' | 'facePop' | 'none'

export interface CursorFx { trail: TrailKind; click: ClickKind; color: string | null; every: number }
export interface CursorDef {
  id: string
  name: string
  price: number
  hot: [number, number]
  draw: (x: Ctx) => void
  fx: CursorFx
}

const COLOR_NAMES: Record<string, string> = {
  [c.coral]: 'coral', [c.sky]: 'sky', [c.lime]: 'lime',
  [c.purple]: 'purple', [c.orange]: 'orange', [c.pink]: 'pink',
}

export const CURSORS: CursorDef[] = [
  { id: 'arrow-ink', name: 'the classic', price: 0, hot: [5, 3],
    draw: sticker(arrowPath, c.card, INK),
    fx: { trail: 'comet', click: 'confetti', color: INK, every: 22 } },
]
for (const col of [c.coral, c.sky, c.lime, c.purple, c.orange, c.pink]) {
  CURSORS.push({
    id: 'arrow-' + COLOR_NAMES[col], name: COLOR_NAMES[col] + ' arrow', price: 0, hot: [5, 3],
    draw: sticker(arrowPath, col),
    fx: { trail: 'comet', click: 'confetti', color: col, every: 22 },
  })
}
CURSORS.push(
  { id: 'paintball', name: 'paintball gun', price: 0, hot: [3, 13], draw: sticker(gunPath, c.teal),
    fx: { trail: 'drips', click: 'paint', color: null, every: 26 } },
  { id: 'star', name: 'gold star', price: 0, hot: [16, 16], draw: sticker(starPath, GOLD),
    fx: { trail: 'stars', click: 'nova', color: GOLD, every: 34 } },
  { id: 'heart', name: 'heart', price: 0, hot: [16, 16], draw: sticker(heartPath, c.coral),
    fx: { trail: 'stars', click: 'confetti', color: c.coral, every: 40 } },
  { id: 'pencil', name: 'pencil', price: 0, hot: [6, 26], draw: sticker(pencilPath, c.sky),
    fx: { trail: 'comet', click: 'confetti', color: GRAPHITE, every: 12 } },
  { id: 'bolt', name: 'lightning bolt', price: 0, hot: [16, 16], draw: sticker(boltPath, c.orange),
    fx: { trail: 'comet', click: 'nova', color: ZAP, every: 24 } },
  { id: 'die', name: 'lucky die', price: 0, hot: [16, 16], draw: dieDraw,
    fx: { trail: 'comet', click: 'confetti', color: GOLD, every: 40 } },
  { id: 'dylan', name: 'dylan', price: 0, hot: [16, 16], draw: faceDraw,
    fx: { trail: 'comet', click: 'facePop', color: null, every: 60 } },
)
