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
const crownPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(4, 25); x.lineTo(6, 9); x.lineTo(12, 17); x.lineTo(16, 6)
  x.lineTo(20, 17); x.lineTo(26, 9); x.lineTo(28, 25); x.closePath()
}
const diamondPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(16, 3); x.lineTo(27, 13); x.lineTo(16, 29); x.lineTo(5, 13); x.closePath()
}
const flowerPath = (x: Ctx): void => {
  x.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const px = 16 + Math.cos(a) * 8, py = 16 + Math.sin(a) * 8
    x.moveTo(px + 4.5, py); x.arc(px, py, 4.5, 0, Math.PI * 2)
  }
  x.moveTo(21, 16); x.arc(16, 16, 5, 0, Math.PI * 2)
}
const ghostPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(5, 27); x.lineTo(5, 15)
  x.arc(16, 15, 11, Math.PI, 0, false)
  x.lineTo(27, 27); x.lineTo(23, 23); x.lineTo(19.5, 27); x.lineTo(16, 23)
  x.lineTo(12.5, 27); x.lineTo(9, 23); x.closePath()
}
const sparklePath = (x: Ctx): void => {
  const p: [number, number][] = [[16, 3], [18.5, 13.5], [29, 16], [18.5, 18.5], [16, 29], [13.5, 18.5], [3, 16], [13.5, 13.5]]
  x.beginPath(); p.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath()
}
const pawPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(24, 21); x.ellipse(16, 21, 8, 7, 0, 0, Math.PI * 2)
  for (const [tx, ty] of [[9, 11], [14, 8], [19, 8], [24, 11]] as const) {
    x.moveTo(tx + 3.2, ty); x.arc(tx, ty, 3.2, 0, Math.PI * 2)
  }
}
const rocketPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(16, 3)
  x.bezierCurveTo(22, 8, 22, 15, 20, 20)
  x.lineTo(12, 20)
  x.bezierCurveTo(10, 15, 10, 8, 16, 3)
  x.closePath()
  x.moveTo(12, 18); x.lineTo(6, 25); x.lineTo(13, 22); x.closePath()   // left fin
  x.moveTo(20, 18); x.lineTo(26, 25); x.lineTo(19, 22); x.closePath()  // right fin
}
const leafPath = (x: Ctx): void => {
  x.beginPath()
  x.moveTo(6, 26)
  x.bezierCurveTo(6, 10, 16, 4, 26, 6)
  x.bezierCurveTo(28, 16, 22, 26, 6, 26)
  x.closePath()
}
const fishPath = (x: Ctx): void => {
  x.beginPath()
  x.ellipse(14, 16, 11, 7, 0, 0, Math.PI * 2)                          // body
  x.moveTo(25, 16); x.lineTo(30, 10); x.lineTo(30, 22); x.closePath()  // tail
}
const hexPath = (x: Ctx): void => {
  x.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2
    const px = 16 + Math.cos(a) * 12, py = 16 + Math.sin(a) * 12
    i ? x.lineTo(px, py) : x.moveTo(px, py)
  }
  x.closePath()
}
const balloonPath = (x: Ctx): void => {
  x.beginPath()
  x.ellipse(16, 13, 9, 11, 0, 0, Math.PI * 2)                          // balloon
  x.moveTo(16, 24); x.lineTo(13, 28); x.lineTo(19, 28); x.closePath()  // knot
}
const moonPath = (x: Ctx): void => {
  x.beginPath()
  x.arc(16, 16, 12, Math.PI * 0.33, Math.PI * 1.67, false)
  x.arc(21, 16, 10.5, Math.PI * 1.55, Math.PI * 0.45, true)
  x.closePath()
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

// a friendly ghost: white body + two ink eyes and a little mouth
const ghostDraw = (x: Ctx): void => {
  x.save(); x.translate(1.5, 1.5); ghostPath(x); x.fillStyle = INK; x.fill(); x.restore()
  ghostPath(x)
  x.fillStyle = c.card; x.lineWidth = 1.75; x.lineJoin = 'round'; x.strokeStyle = INK; x.fill(); x.stroke()
  x.fillStyle = INK
  x.beginPath(); x.arc(12, 14, 2, 0, Math.PI * 2); x.arc(20, 14, 2, 0, Math.PI * 2); x.fill()
  x.beginPath(); x.arc(16, 18, 2.2, 0, Math.PI, false); x.fill()   // little smile
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

export const CURSORS: CursorDef[] = [
  { id: 'arrow-ink', name: 'the classic', price: 0, hot: [5, 3],
    draw: sticker(arrowPath, c.card, INK),
    fx: { trail: 'comet', click: 'confetti', color: INK, every: 22 } },
]
// a whole rainbow of arrow cursors — one per hue
const ARROW_COLORS: [string, string][] = [
  ['coral', c.coral], ['sky', c.sky], ['lime', c.lime], ['purple', c.purple],
  ['orange', c.orange], ['pink', c.pink], ['teal', c.teal], ['gold', GOLD],
  ['red', '#e23c2e'], ['blue', '#2f6fe0'], ['green', '#3ba55d'], ['mint', '#4fd1b5'],
  ['magenta', '#d94fd1'], ['indigo', '#5a51d6'], ['sunburst', '#f7a939'], ['bubblegum', '#ff9ec4'],
  ['navy', '#2a3a78'], ['forest', '#2f7d4f'], ['plum', '#7d4fa5'], ['slate', '#5b6472'],
]
for (const [name, col] of ARROW_COLORS) {
  CURSORS.push({
    id: 'arrow-' + name, name: name + ' arrow', price: 0, hot: [5, 3],
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
  { id: 'crown', name: 'crown', price: 0, hot: [16, 16], draw: sticker(crownPath, GOLD),
    fx: { trail: 'stars', click: 'nova', color: GOLD, every: 30 } },
  { id: 'diamond', name: 'diamond', price: 0, hot: [16, 16], draw: sticker(diamondPath, c.sky),
    fx: { trail: 'stars', click: 'nova', color: c.sky, every: 30 } },
  { id: 'sparkle', name: 'sparkle', price: 0, hot: [16, 16], draw: sticker(sparklePath, GOLD),
    fx: { trail: 'stars', click: 'nova', color: GOLD, every: 22 } },
  { id: 'flower', name: 'flower', price: 0, hot: [16, 16], draw: sticker(flowerPath, c.pink),
    fx: { trail: 'stars', click: 'confetti', color: c.pink, every: 34 } },
  { id: 'ghost', name: 'ghost', price: 0, hot: [16, 16], draw: ghostDraw,
    fx: { trail: 'comet', click: 'confetti', color: c.purple, every: 26 } },
  { id: 'paw', name: 'paw print', price: 0, hot: [16, 16], draw: sticker(pawPath, c.orange),
    fx: { trail: 'comet', click: 'confetti', color: c.orange, every: 28 } },
  { id: 'rocket', name: 'rocket', price: 0, hot: [16, 16], draw: sticker(rocketPath, c.coral),
    fx: { trail: 'comet', click: 'nova', color: c.orange, every: 18 } },
  { id: 'moon', name: 'crescent moon', price: 0, hot: [16, 16], draw: sticker(moonPath, GOLD),
    fx: { trail: 'stars', click: 'nova', color: GOLD, every: 34 } },
  { id: 'leaf', name: 'leaf', price: 0, hot: [16, 16], draw: sticker(leafPath, c.lime),
    fx: { trail: 'stars', click: 'confetti', color: c.lime, every: 30 } },
  { id: 'fish', name: 'fish', price: 0, hot: [16, 16], draw: sticker(fishPath, c.sky),
    fx: { trail: 'drips', click: 'confetti', color: c.sky, every: 26 } },
  { id: 'balloon', name: 'balloon', price: 0, hot: [16, 16], draw: sticker(balloonPath, c.pink),
    fx: { trail: 'stars', click: 'confetti', color: c.pink, every: 34 } },
  { id: 'gem', name: 'gem', price: 0, hot: [16, 16], draw: sticker(hexPath, c.teal),
    fx: { trail: 'stars', click: 'nova', color: c.teal, every: 30 } },
)
