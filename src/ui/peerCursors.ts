import type { CameraState } from '../types'
import { peers } from '../engine/net'
import { CURSORS } from '../config/cursors'
import { theme } from '../config/theme'
import { worldToScreen } from '../engine/world'

// Ghost cursors of everyone else at the table: their equipped cursor sticker at
// constant screen size, a name tag underneath, eased toward the network target.
// Fades out when idle, gone after 30s (net.ts prunes).

const byId = new Map(CURSORS.map(c => [c.id, c]))
let lastFrame = performance.now()

export function drawPeerCursors(
  ctx: CanvasRenderingContext2D,
  cam: CameraState,
  canvas: HTMLCanvasElement,
): void {
  const now = performance.now()
  const dt = Math.min((now - lastFrame) / 1000, 0.1)
  lastFrame = now
  const ease = Math.min(1, dt * 14)

  for (const p of peers().values()) {
    p.x += (p.tx - p.x) * ease
    p.y += (p.ty - p.y) * ease
    const s = worldToScreen(cam, canvas, { x: p.x, y: p.y })
    if (s.x < -80 || s.y < -80 || s.x > canvas.width + 80 || s.y > canvas.height + 80) continue
    const idle = (now - p.lastSeen) / 1000
    const alpha = idle < 4 ? 1 : Math.max(0.25, 1 - (idle - 4) / 10)

    ctx.save()
    ctx.globalAlpha = alpha
    // the cursor sticker, ~40px on screen regardless of zoom
    const cur = byId.get(p.cur) ?? CURSORS[0]
    ctx.save()
    ctx.translate(s.x - cur.hot[0] * 1.25, s.y - cur.hot[1] * 1.25)
    ctx.scale(1.25, 1.25)
    cur.draw(ctx)
    ctx.restore()
    // name tag
    ctx.font = '700 11px ui-monospace, monospace'
    const w = ctx.measureText(p.name).width + 12
    const tx = s.x - w / 2
    const ty = s.y + 30
    ctx.fillStyle = theme.colors.card
    ctx.strokeStyle = theme.colors.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(tx, ty, w, 17, 5)
    else ctx.rect(tx, ty, w, 17)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = theme.colors.ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.name, s.x, ty + 9)
    ctx.restore()
  }
  ctx.globalAlpha = 1
}
