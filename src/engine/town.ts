import type { CameraState } from '../types'
import { theme } from '../config/theme'
import { plaza } from '../config/town'
import { worldToScreen } from './world'

// The town square, hand-drawn in the paper/ink sticker style: radial cobble
// paving, a fountain, lamp posts, benches, a bulletin board, a rose banner, and
// hydrangea beds. Everything is drawn in local coords around the plaza centre.

type Ctx = CanvasRenderingContext2D
const c = theme.colors
const INK = c.ink
const BRICK = '#e6cfa4'
const BRICK_LINE = 'rgba(120, 90, 50, 0.18)'
const STONE = '#d9d0bc'
const STONE_D = '#b9ad93'
const WOOD = '#b98a52'
const HEDGE = '#6f9e39'
const HEDGE_D = '#527a29'
const HYD = '#6f9be0'
const HYD2 = '#a9c6ef'
const GLOW = 'rgba(247, 201, 72, 0.35)'
const HALF_W = plaza.w / 2
const HALF_H = plaza.h / 2

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function drawPaving(g: Ctx): void {
  // hard offset shadow
  g.fillStyle = 'rgba(32,26,23,0.12)'
  roundRect(g, -HALF_W + 6, -HALF_H + 10, plaza.w, plaza.h, 44); g.fill()
  // base
  g.fillStyle = BRICK
  roundRect(g, -HALF_W, -HALF_H, plaza.w, plaza.h, 42); g.fill()
  g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = INK; g.stroke()
  // radial roundel + spokes, clipped to the paving
  g.save()
  roundRect(g, -HALF_W, -HALF_H, plaza.w, plaza.h, 42); g.clip()
  g.strokeStyle = BRICK_LINE; g.lineWidth = 2
  const fy = 70
  for (let r = 56; r <= 340; r += 46) { g.beginPath(); g.ellipse(0, fy, r, r, 0, 0, Math.PI * 2); g.stroke() }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath(); g.moveTo(0, fy); g.lineTo(Math.cos(a) * 340, fy + Math.sin(a) * 340); g.stroke()
  }
  g.restore()
}

function drawHedgeRun(g: Ctx, x0: number, y: number, x1: number): void {
  g.fillStyle = HEDGE
  g.strokeStyle = INK; g.lineWidth = 2.5; g.lineJoin = 'round'
  for (let x = x0; x <= x1; x += 26) {
    g.beginPath(); g.arc(x, y, 18, Math.PI, 0); g.closePath(); g.fill(); g.stroke()
  }
  g.fillStyle = HEDGE_D
  for (let x = x0 + 8; x <= x1; x += 26) { g.beginPath(); g.arc(x, y - 3, 4, 0, Math.PI * 2); g.fill() }
}

function drawLamp(g: Ctx, x: number, y: number): void {
  // warm glow
  const grd = g.createRadialGradient(x, y - 116, 0, x, y - 116, 46)
  grd.addColorStop(0, GLOW); grd.addColorStop(1, 'rgba(247,201,72,0)')
  g.fillStyle = grd; g.beginPath(); g.arc(x, y - 116, 46, 0, Math.PI * 2); g.fill()
  // base + pole
  g.fillStyle = INK
  g.fillRect(x - 8, y - 4, 16, 6)
  g.fillRect(x - 3, y - 116, 6, 114)
  // lantern head
  g.beginPath()
  g.moveTo(x - 12, y - 116); g.lineTo(x + 12, y - 116); g.lineTo(x + 8, y - 138)
  g.lineTo(x - 8, y - 138); g.closePath(); g.fillStyle = INK; g.fill()
  g.fillStyle = '#f7c948'
  g.fillRect(x - 7, y - 133, 14, 15)
  g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(x - 7, y - 133, 14, 15)
  g.fillStyle = INK; g.beginPath(); g.moveTo(x, y - 146); g.lineTo(x - 4, y - 138); g.lineTo(x + 4, y - 138); g.closePath(); g.fill()
}

function drawBench(g: Ctx, x: number, y: number, faceRight: boolean): void {
  g.save(); g.translate(x, y); if (!faceRight) g.scale(-1, 1)
  g.fillStyle = 'rgba(32,26,23,0.12)'; g.beginPath(); g.ellipse(0, 16, 34, 6, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = WOOD; g.strokeStyle = INK; g.lineWidth = 2.5; g.lineJoin = 'round'
  roundRect(g, -32, -2, 64, 10, 3); g.fill(); g.stroke()          // seat
  roundRect(g, -32, -26, 10, 26, 3); g.fill(); g.stroke()          // back
  roundRect(g, -30, -22, 60, 6, 3); g.fill(); g.stroke()           // back rail
  g.fillStyle = INK; g.fillRect(-28, 8, 4, 12); g.fillRect(22, 8, 4, 12) // legs
  g.restore()
}

function drawBulletin(g: Ctx): void {
  const y = -HALF_H + 96
  g.fillStyle = INK; g.fillRect(-64, y + 30, 5, 34); g.fillRect(59, y + 30, 5, 34) // posts
  g.fillStyle = WOOD; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
  roundRect(g, -80, y - 44, 160, 78, 6); g.fill(); g.stroke()      // frame
  g.fillStyle = '#e8d9b0'; roundRect(g, -70, y - 34, 140, 58, 4); g.fill(); g.stroke()  // cork
  // little tent roof
  g.fillStyle = c.coral
  g.beginPath(); g.moveTo(-90, y - 44); g.lineTo(0, y - 70); g.lineTo(90, y - 44); g.closePath(); g.fill(); g.stroke()
  // sticky notes
  const notes = [[-44, -14, c.card], [6, -18, '#bfe0f2'], [30, 4, '#ffe08a'], [-20, 6, c.pink]]
  for (const [nx, ny, col] of notes as [number, number, string][]) {
    g.save(); g.translate(nx, y + ny); g.rotate((nx % 7) / 40)
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.4
    g.fillRect(-11, -11, 22, 22); g.strokeRect(-11, -11, 22, 22); g.restore()
  }
}

function drawBanner(g: Ctx): void {
  const x = -HALF_W + 120, base = HALF_H - 40
  g.fillStyle = INK; g.fillRect(x - 3, base - 300, 6, 300)          // pole
  g.beginPath(); g.arc(x, base - 300, 6, 0, Math.PI * 2); g.fill()
  g.fillStyle = c.card; g.strokeStyle = INK; g.lineWidth = 2.5
  roundRect(g, x + 3, base - 296, 92, 108, 6); g.fill(); g.stroke() // banner
  // a simple rose crest
  g.save(); g.translate(x + 49, base - 242)
  g.strokeStyle = c.coral; g.lineWidth = 3; g.lineJoin = 'round'
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0, 0, 6 + i * 6, i, i + 3.4); g.stroke() }
  g.fillStyle = c.coral; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill()
  g.strokeStyle = HEDGE_D; g.lineWidth = 3
  g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 34); g.stroke(); g.restore()
}

function drawHydrangea(g: Ctx, x: number, y: number): void {
  g.fillStyle = HEDGE; g.strokeStyle = INK; g.lineWidth = 2.5; g.lineJoin = 'round'
  g.beginPath(); g.arc(x - 8, y, 12, 0, Math.PI * 2); g.arc(x + 8, y, 12, 0, Math.PI * 2); g.fill(); g.stroke()
  for (const [dx, dy] of [[-10, -4], [0, -8], [10, -4], [-4, 2], [6, 2]] as number[][]) {
    g.fillStyle = (dx + dy) % 2 ? HYD : HYD2
    g.beginPath(); g.arc(x + dx, y + dy, 4.2, 0, Math.PI * 2); g.fill()
  }
}

function drawWhiteFlower(g: Ctx, x: number, y: number): void {
  g.strokeStyle = INK; g.lineWidth = 1.4; g.fillStyle = '#fbfaf5'
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
    g.beginPath(); g.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.4, 3.4, 0, 0, Math.PI * 2); g.fill(); g.stroke()
  }
  g.fillStyle = '#5a6bb0'; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill()
}

function drawFountain(g: Ctx, t: number): void {
  const fy = 70
  g.fillStyle = 'rgba(32,26,23,0.14)'; g.beginPath(); g.ellipse(0, fy + 8, 84, 24, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = STONE; g.strokeStyle = INK; g.lineWidth = 3.5; g.lineJoin = 'round'
  g.beginPath(); g.arc(0, fy, 80, 0, Math.PI * 2); g.fill(); g.stroke()          // basin rim
  g.fillStyle = STONE_D; g.beginPath(); g.arc(0, fy, 66, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#bfe0f2'; g.beginPath(); g.arc(0, fy, 60, 0, Math.PI * 2); g.fill() // water
  // ripples
  g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2
  for (let i = 0; i < 3; i++) {
    const r = ((t / 520 + i * 0.9) % 2.7) * 24
    g.globalAlpha = Math.max(0, 1 - r / 65)
    g.beginPath(); g.arc(0, fy, r, 0, Math.PI * 2); g.stroke()
  }
  g.restore(); g.globalAlpha = 1
  // centre tier + spout
  g.fillStyle = STONE; g.strokeStyle = INK; g.lineWidth = 2.5
  g.beginPath(); g.arc(0, fy, 20, 0, Math.PI * 2); g.fill(); g.stroke()
  g.beginPath(); g.arc(0, fy - 14, 9, 0, Math.PI * 2); g.fill(); g.stroke()
  g.strokeStyle = '#bfe0f2'; g.lineWidth = 2.4; g.lineCap = 'round'
  for (const dx of [-1, 1]) { g.beginPath(); g.moveTo(0, fy - 20); g.quadraticCurveTo(dx * 16, fy - 30, dx * 22, fy - 8); g.stroke() }
}

export function drawTown(ctx: Ctx, cam: CameraState, canvas: HTMLCanvasElement, t: number): void {
  const s = worldToScreen(cam, canvas, { x: plaza.cx, y: plaza.cy })
  const hw = HALF_W * cam.zoom + 240, hh = HALF_H * cam.zoom + 240
  if (s.x + hw < 0 || s.x - hw > canvas.width || s.y + hh < 0 || s.y - hh > canvas.height) return
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.scale(cam.zoom, cam.zoom)
  drawPaving(ctx)
  drawHedgeRun(ctx, -HALF_W + 40, -HALF_H - 6, HALF_W - 40)   // hedge along the back
  drawBanner(ctx)
  drawBulletin(ctx)
  drawLamp(ctx, -HALF_W + 60, -60)
  drawLamp(ctx, HALF_W - 60, -60)
  drawLamp(ctx, -HALF_W + 60, HALF_H - 40)
  drawLamp(ctx, HALF_W - 60, HALF_H - 40)
  drawBench(ctx, -HALF_W + 150, 150, true)
  drawBench(ctx, HALF_W - 150, 150, false)
  drawFountain(ctx, t)
  // hydrangea + white-flower bed along the front edge
  for (let i = 0; i <= 8; i++) {
    const x = -HALF_W + 90 + (i * (plaza.w - 180)) / 8
    drawHydrangea(ctx, x, HALF_H + 18)
    drawWhiteFlower(ctx, x + 30, HALF_H + 30)
  }
  ctx.restore()
}
