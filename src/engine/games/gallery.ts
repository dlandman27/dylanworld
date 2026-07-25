import { theme } from '../../config/theme'
import { experience } from '../../config/experience'
import type { ExperienceEntry } from '../../types'
import { westWallP } from '../walls'
import { spark } from '../physics'
import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// The career gallery: Dylan's work history hung as framed photos on the WEST
// wall, above the dresser. Each frame lies FLAT on the wall plane (foreshortened
// by the fold, like the taped kid-drawings) with a wood border, a recessed mat,
// a cast shadow, and a company logo. Press a frame → its card opens. Newest job
// sits highest on the wall.
//
// It's a TableGame (not wall decor) so it can hit-test presses: westWallP maps
// wall space → WORLD coords, exactly the space presses arrive in.

export type GalleryGame = TableGame & { closeFrame: () => void }

const FW = 128, FH = 150      // half-width (along wall) / half-height (up wall), world units
const BW = 20                 // wood border thickness
const IW = FW - BW, IH = FH - BW   // inner opening (photo) half-size
const WOOD = '#b5915a'

interface Vec { x: number; y: number }
const norm = (v: Vec): Vec => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l } }

// preload logos once (falls back to an initial tile until one loads)
const logos = new Map<string, HTMLImageElement>()
for (const e of experience) {
  if (e.logo && !logos.has(e.logo)) { const im = new Image(); im.src = e.logo; logos.set(e.logo, im) }
}

// four frames stacked up the wall at one height, centered on the dresser
// (world y≈1500 → t≈0.674). Higher t = higher on screen, so newest sits on top.
const S_MID = 0.56
const T_STEP = 0.064
const frames = experience.map((entry, i) => ({
  entry,
  tc: 0.674 + (1.5 - i) * T_STEP,
  sc: S_MID,
  press: 0,          // 0..1 press-lift, eases back to 0
}))

// local wall frame at (tc, sc): W(sx, sy) = world point sx along the wall, sy up
// it (world units). ax/ux are the (non-orthogonal, sheared-by-the-fold) unit
// axes and c the center — enough to warp the logo onto the frame's parallelogram.
function axesAt(tc: number, sc: number): { W: (sx: number, sy: number) => Vec; ax: Vec; ux: Vec; c: Vec } {
  const c = westWallP(tc, sc)
  const ax = norm({ x: westWallP(tc + 0.003, sc).x - westWallP(tc - 0.003, sc).x, y: westWallP(tc + 0.003, sc).y - westWallP(tc - 0.003, sc).y })
  const ux = norm({ x: westWallP(tc, sc + 0.006).x - westWallP(tc, sc - 0.006).x, y: westWallP(tc, sc + 0.006).y - westWallP(tc, sc - 0.006).y })
  return { W: (sx, sy) => ({ x: c.x + ax.x * sx + ux.x * sy, y: c.y + ax.y * sx + ux.y * sy }), ax, ux, c }
}

export function createGallery(
  onOpen: (e: ExperienceEntry) => void,
  onClose: () => void,
): GalleryGame {
  let openIdx = -1

  const poly = (g: Ctx, pts: Vec[], fill: string, ink = 0): void => {
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
    g.closePath()
    if (fill) { g.fillStyle = fill; g.fill() }
    if (ink) { g.strokeStyle = INK; g.lineWidth = ink; g.lineJoin = 'round'; g.stroke() }
  }
  const edge = (g: Ctx, a: Vec, b: Vec, col: string, lw: number): void => {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
  }

  // outer corners of frame f (a small press-scale gives the tap some life)
  const corners = (f: typeof frames[number]): Vec[] => {
    const { W } = axesAt(f.tc, f.sc)
    const k = 1 + f.press * 0.05
    return [W(-FW * k, FH * k), W(FW * k, FH * k), W(FW * k, -FH * k), W(-FW * k, -FH * k)]
  }

  const inQuad = (px: number, py: number, q: Vec[]): boolean => {
    let sign = 0
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4]
      const cr = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)
      if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false }
    }
    return true
  }

  const shelve = (): void => { openIdx = -1 }

  return {
    id: 'gallery',
    closeFrame: shelve,
    onDown(x, y) {
      for (let i = 0; i < frames.length; i++) {
        if (inQuad(x, y, corners(frames[i]))) {
          if (i === openIdx) { shelve(); onClose() }
          else { frames[i].press = 1; spark(x, y, 0.08); clunk(0.5); openIdx = i; onOpen(frames[i].entry) }
          return true
        }
      }
      return false   // not on a frame → let the table pan
    },
    onMove() {},
    onUp() {},
    update(dt) {
      for (const f of frames) f.press += (0 - f.press) * Math.min(1, dt * 8)
    },
    draw(g) {
      for (const f of frames) {
        const { W, ax } = axesAt(f.tc, f.sc)
        const k = 1 + f.press * 0.05
        const o = (sx: number, sy: number): Vec => W(sx * k, sy * k)
        const OTL = o(-FW, FH), OTR = o(FW, FH), OBR = o(FW, -FH), OBL = o(-FW, -FH)
        const iTL = o(-IW, IH), iTR = o(IW, IH), iBR = o(IW, -IH), iBL = o(-IW, -IH)

        // cast shadow on the wall (offset down-right) — lifts the frame off it
        poly(g, [OTL, OTR, OBR, OBL].map((p) => ({ x: p.x + 15, y: p.y + 20 })), 'rgba(32,26,23,0.22)')

        // wood border
        poly(g, [OTL, OTR, OBR, OBL], WOOD, 0)

        // the photo: mat behind the logo (or colored tile for the initial)
        poly(g, [iTL, iTR, iBR, iBL], f.entry.mat ?? f.entry.color, 0)
        const img = f.entry.logo ? logos.get(f.entry.logo) : undefined
        if (img && img.complete && img.naturalWidth) {
          // map the image's unit square onto the opening's parallelogram, oriented
          // so the logo's top points toward the wall (−x) — a picture on the side
          // wall facing outward. Fills the frame despite the shear.
          g.save()
          g.transform(iTR.x - iTL.x, iTR.y - iTL.y, iBL.x - iTL.x, iBL.y - iTL.y, iTL.x, iTL.y)
          g.imageSmoothingEnabled = true
          g.drawImage(img, 0, 0, 1, 1)
          g.imageSmoothingEnabled = false
          g.restore()
        } else {
          const pc = o(0, 0)
          g.save()
          g.translate(pc.x, pc.y)
          g.rotate(Math.atan2(ax.y, ax.x))
          const size = Math.min(IW, IH) * 1.5
          g.font = `900 ${size}px "Arial Black", ${theme.fonts.display}, sans-serif`
          g.textAlign = 'center'; g.textBaseline = 'middle'
          g.lineJoin = 'round'; g.lineWidth = size * 0.14; g.strokeStyle = INK
          g.strokeText(f.entry.company[0], 0, 0)
          g.fillStyle = '#fff'; g.fillText(f.entry.company[0], 0, 0)
          g.restore()
        }

        // recess bevel: thin edges inside the opening (top/left shadow, bottom/right light)
        edge(g, iTL, iTR, 'rgba(32,26,23,0.32)', 3)
        edge(g, iTL, iBL, 'rgba(32,26,23,0.26)', 3)
        edge(g, iBL, iBR, 'rgba(255,255,255,0.5)', 2)
        edge(g, iTR, iBR, 'rgba(255,255,255,0.38)', 2)

        // ink outlines + a highlight along the top of the wood
        poly(g, [iTL, iTR, iBR, iBL], '', 2.5)
        poly(g, [OTL, OTR, OBR, OBL], '', 3.5)
        edge(g, OTL, OTR, 'rgba(255,255,255,0.4)', 2)
      }

      // ---- "MY WORK" plaque under the frames, turned to match the paintings ----
      {
        const { W, ax, ux } = axesAt(0.51, 0.56)
        const LW = 150, LH = 44   // long ALONG the wall (like the frames), thin across
        const cTL = W(-LW, LH), cTR = W(LW, LH), cBR = W(LW, -LH), cBL = W(-LW, -LH)
        poly(g, [cTL, cTR, cBR, cBL].map((p) => ({ x: p.x + 12, y: p.y + 15 })), 'rgba(32,26,23,0.2)')
        poly(g, [cTL, cTR, cBR, cBL], '#3a3733', 0)   // dark museum plaque
        const cc = W(0, 0)
        g.save()
        g.translate(cc.x, cc.y)
        g.transform(ax.x, ax.y, -ux.x, -ux.y, 0, 0)   // orient exactly like the frame logos
        g.fillStyle = '#f7c948'
        g.font = `900 52px "Arial Black", ${theme.fonts.display}, sans-serif`
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('MY WORK', 0, 0)
        g.restore()
        poly(g, [cTL, cTR, cBR, cBL], '', 3.5)
      }
    },
  }
}
