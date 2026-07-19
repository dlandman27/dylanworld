import type { CameraState, Landmark, Vec2 } from '../types'
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

export function updateLandmarks(lms: Landmark[], cursor: Vec2, dt: number): void {
  for (const lm of lms) {
    lm.wobble = Math.max(0, lm.wobble - dt * 2.2)
    // wobble to life when the cursor (your hand) hovers over the sticker
    const cx = Math.min(Math.max(cursor.x, lm.x - lm.w / 2), lm.x + lm.w / 2)
    const cy = Math.min(Math.max(cursor.y, lm.y - lm.h / 2), lm.y + lm.h / 2)
    if (Math.hypot(cursor.x - cx, cursor.y - cy) < 24) lm.wobble = 1
  }
}

const COLOR_KEYS = theme.colors as Record<string, string>

// rsotw: deterministic per-landmark "sticker tilt" (radians). Stable across frames
// (derived from the id string, NOT random/time) so buildings sit at a fixed jaunty angle.
function stickerTilt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  // map hash to roughly [-3.2deg, +3.2deg]
  return (((h % 1000) / 1000) - 0.5) * 0.112
}

// rsotw: chunky rounded rect helper (falls back to sharp if roundRect unsupported)
function chunkyRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.rect(x, y, w, h)
  }
}

export function drawLandmarks(ctx: CanvasRenderingContext2D, lms: Landmark[], cam: CameraState, canvas: HTMLCanvasElement, cursorPos: Vec2): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  for (const lm of lms) {
    const s = worldToScreen(cam, canvas, { x: lm.x, y: lm.y })
    if (s.x < -300 || s.y < -300 || s.x > canvas.width + 300 || s.y > canvas.height + 300) continue
    const wob = reduce ? 0 : Math.sin(performance.now() / 60) * lm.wobble * 0.06
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.scale(cam.zoom, cam.zoom)
    // rsotw: base sticker tilt + dynamic wobble on top
    ctx.rotate(stickerTilt(lm.id) + wob)
    ctx.scale(1 + lm.wobble * 0.04, 1 - lm.wobble * 0.04)
    const w = lm.w, h = lm.h
    const fill = COLOR_KEYS[lm.color] ?? theme.colors.orange
    const radius = 12 // rsotw: chunky rounded corners
    // rsotw: hard offset shadow, no blur (matches --shadow 6px 6px 0 ink)
    ctx.fillStyle = theme.colors.ink
    chunkyRect(ctx, -w / 2 + 6, -h / 2 + 6, w, h, radius); ctx.fill()
    // body — 3px solid ink border + accent fill
    ctx.fillStyle = fill
    ctx.strokeStyle = theme.colors.ink
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    chunkyRect(ctx, -w / 2, -h / 2, w, h, radius); ctx.fill(); ctx.stroke()
    if (lm.kind === 'project') {
      // roof triangle
      ctx.beginPath(); ctx.moveTo(-w / 2 - 8, -h / 2); ctx.lineTo(0, -h / 2 - 34); ctx.lineTo(w / 2 + 8, -h / 2); ctx.closePath()
      ctx.fillStyle = theme.colors.card; ctx.fill(); ctx.stroke()
      // door (rounded-top)
      ctx.fillStyle = theme.colors.ink
      chunkyRect(ctx, -12, h / 2 - 34, 24, 34, 6); ctx.fill()
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
    // proximity "!" hint — rsotw: gentle bob so it feels alive
    if (lm.cardId) {
      const cx = Math.min(Math.max(cursorPos.x, lm.x - w / 2), lm.x + w / 2)
      const cy = Math.min(Math.max(cursorPos.y, lm.y - h / 2), lm.y + h / 2)
      if (Math.hypot(cursorPos.x - cx, cursorPos.y - cy) < 90) {
        const bob = reduce ? 0 : Math.sin(performance.now() / 180) * 4
        ctx.font = `700 28px ${theme.fonts.display}`
        ctx.fillStyle = theme.colors.coral
        ctx.fillText('!', 0, -h / 2 - (lm.kind === 'project' ? 52 : 22) + bob)
      }
    }
    ctx.restore()
  }
}
