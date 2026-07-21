import type { CameraState } from '../../types'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A brass magnifying glass lying on the table. Drag it anywhere — the lens
// ACTUALLY magnifies whatever is under it (the world is re-rendered through a
// second camera, clipped to the glass). Marble-recipe beauty: glass, glint,
// distortion, and everything on the table becomes more interesting through it.

const LENS_R = 100      // outer rim radius
const GLASS_R = 88      // visible glass radius
const MAG = 2.1         // magnification over current zoom
const BRASS = '#c9a63f'
const BRASS_DARK = '#a2812b'

interface LensDeps {
  camera: CameraState
  canvas: HTMLCanvasElement
  /** re-render the whole world with an arbitrary camera into a context */
  render: (cam: CameraState, t: number, rc?: CanvasRenderingContext2D) => void
}

let deps: LensDeps | null = null
let lensing = false // reentrancy guard: no lenses inside lenses

/** True while the world is being re-rendered inside the lens — critters can use
 * this to reveal a secret (e.g. the fly's sign) only when magnified. */
export function isLensing(): boolean {
  return lensing
}

export function bindLens(d: LensDeps): void {
  deps = d
}

export function createMagnifier(hx: number, hy: number): TableGame {
  let x = hx, y = hy
  let lift = 0
  let held = false
  let hoff = { x: 0, y: 0 }
  const handleAng = 2.4 // handle points down-left

  const onBody = (px: number, py: number): boolean => {
    if (Math.hypot(px - x, py - y) < LENS_R + 10) return true
    // the handle: a capsule extending from the rim
    const hxx = x + Math.cos(handleAng) * (LENS_R + 70)
    const hyy = y + Math.sin(handleAng) * (LENS_R + 70)
    return Math.hypot(px - hxx, py - hyy) < 80
  }

  return {
    id: 'magnifier',
    onDown(px, py) {
      if (!onBody(px, py)) return false
      held = true
      hoff = { x: px - x, y: py - y }
      return true
    },
    onMove(px, py) {
      if (held) { x = px - hoff.x; y = py - hoff.y }
    },
    onUp() { held = false },
    update(dt) {
      lift += ((held ? 1 : 0) - lift) * Math.min(1, dt * 12)
    },
    draw(g: Ctx) {
      if (lensing) return
      // ground shadow (table layer, under everything the lens floats over)
      g.fillStyle = `rgba(32,26,23,${0.18 - lift * 0.07})`
      g.beginPath()
      g.ellipse(x + 6 + lift * 10, y + 10 + lift * 14, LENS_R * 0.98, LENS_R * 0.82, 0, 0, Math.PI * 2)
      g.fill()
      const ha = handleAng
      g.save()
      g.translate(x + Math.cos(ha) * (LENS_R + 60) + 6 + lift * 10, y + Math.sin(ha) * (LENS_R + 60) + 10 + lift * 14)
      g.rotate(ha)
      g.fillRect(-70, -16, 150, 32)
      g.restore()
    },
    drawAbove(g: Ctx, t) {
      if (lensing || !deps) return
      const { camera, canvas, render } = deps

      // ---- the magnified view through the glass ----
      // choose a lens-camera so the world point under the lens centre stays
      // exactly under the lens centre, but rendered MAG× closer
      const zoom = camera.zoom * MAG
      const sx = (x - camera.pos.x) * camera.zoom + canvas.width / 2
      const sy = (y - camera.pos.y) * camera.zoom + canvas.height / 2
      const magCam: CameraState = {
        pos: { x: x - (sx - canvas.width / 2) / zoom, y: y - (sy - canvas.height / 2) / zoom },
        vel: { x: 0, y: 0 },
        zoom,
        zoomTarget: zoom,
        zoomFocus: { x: 0, y: 0 },
      }
      g.save()
      g.beginPath()
      g.arc(x, y, GLASS_R, 0, Math.PI * 2)
      g.clip()
      lensing = true
      render(magCam, t)
      lensing = false
      g.restore()
      // (render() resets transforms — restore ours for the rim drawing)
      g.setTransform(camera.zoom, 0, 0, camera.zoom,
        canvas.width / 2 - camera.pos.x * camera.zoom,
        canvas.height / 2 - camera.pos.y * camera.zoom)

      g.save()
      g.translate(x, y)
      const grow = 1 + lift * 0.05
      g.scale(grow, grow)

      // edge shading inside the glass — curvature at the rim
      g.strokeStyle = 'rgba(32,26,23,0.18)'
      g.lineWidth = 10
      g.beginPath(); g.arc(0, 0, GLASS_R - 5, 0, Math.PI * 2); g.stroke()
      // glass glints
      g.strokeStyle = 'rgba(255,255,255,0.55)'
      g.lineWidth = 7
      g.lineCap = 'round'
      g.beginPath(); g.arc(0, 0, GLASS_R - 16, -2.3, -1.65); g.stroke()
      g.lineWidth = 4
      g.beginPath(); g.arc(0, 0, GLASS_R - 14, 0.6, 0.95); g.stroke()

      // brass rim
      g.lineWidth = 5
      g.strokeStyle = INK
      g.beginPath(); g.arc(0, 0, LENS_R, 0, Math.PI * 2); g.stroke()
      const rim = g.createLinearGradient(-LENS_R, -LENS_R, LENS_R, LENS_R)
      rim.addColorStop(0, '#e8cd7a')
      rim.addColorStop(0.5, BRASS)
      rim.addColorStop(1, BRASS_DARK)
      g.strokeStyle = rim
      g.lineWidth = LENS_R - GLASS_R - 4
      g.beginPath(); g.arc(0, 0, (LENS_R + GLASS_R) / 2, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = INK
      g.lineWidth = 2.5
      g.beginPath(); g.arc(0, 0, GLASS_R, 0, Math.PI * 2); g.stroke()

      // handle: brass collar + dark grip with a brass cap
      g.rotate(handleAng)
      g.translate(LENS_R - 2, 0)
      g.fillStyle = rim
      g.strokeStyle = INK
      g.lineWidth = 2.5
      roundRect(g, 0, -13, 34, 26, 6); g.fill(); g.stroke()
      g.fillStyle = '#4a3d30'
      roundRect(g, 30, -15, 118, 30, 14); g.fill(); g.stroke()
      // grip ridges
      g.strokeStyle = 'rgba(255,255,255,0.14)'
      g.lineWidth = 2
      for (let k = 0; k < 4; k++) {
        g.beginPath(); g.moveTo(48 + k * 22, -12); g.lineTo(44 + k * 22, 12); g.stroke()
      }
      g.fillStyle = rim
      g.strokeStyle = INK
      g.lineWidth = 2.5
      g.beginPath(); g.arc(150, 0, 12, 0, Math.PI * 2); g.fill(); g.stroke()
      g.restore()
    },
  }
}
