import { theme } from '../../config/theme'
import { spark, registerObstacleProvider } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'
import { cabinetLayout, drawCabinet, type CabinetBook } from './wallCabinet'
import { WORLD } from '../../config/worldMap'

// The curio shelf: the shared 3D bookcase (see wallCabinet.ts) standing against
// the wall, with a spinning GLOBE, a blinking tin ROBOT, a swaying PLANT and a
// gold TROPHY set back on the ledge, plus books in the open shelf below.

const TAU = Math.PI * 2
const BOOK_COLS = [theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple, '#f7c948', theme.colors.teal, theme.colors.orange, theme.colors.pink]

function hsh(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

export function createCurioShelf(cx: number, cy: number): TableGame {
  const L = cabinetLayout(cx, cy, 420)
  const baseY = L.itemBaseY, span = L.itemRight - L.itemLeft
  const gX = L.itemLeft + span * 0.15, rX = L.itemLeft + span * 0.42, pX = L.itemLeft + span * 0.65, trX = L.itemLeft + span * 0.88

  const gR = 58, gCY = baseY - gR - 26   // raised so the stand + stem show below it
  let globeAngle = 0, globeVel = 0.35
  let gDrag = false, gLastX = 0
  let botBlink = 0, botBounce = 0
  // trophy: a tap "gleam" flash that decays, plus a squash/bob that eases back
  let trGleam = 0, trSquash = 0, trBob = 0

  const nBooks = 9
  const books: CabinetBook[] = Array.from({ length: nBooks }, (_, i) => ({
    col: BOOK_COLS[i % BOOK_COLS.length], hh: (L.caseBot - L.caseTop - 34) * (0.7 + hsh(i + 20) * 0.26), lean: (hsh(i + 22) - 0.5) * 0.14, tip: 0,
  }))

  registerObstacleProvider(() => [
    { x: L.cx - 130, y: (cy + L.caseTop) / 2, half: 150 },
    { x: L.cx + 130, y: (cy + L.caseTop) / 2, half: 150 },
  ])

  const inFootprint = (x: number, y: number): boolean =>
    x > L.ledgeL - 12 && x < L.ledgeR + 12 && y > L.ledgeBackY - 240 && y < cy + 10

  return {
    id: 'curio',
    onDown(x, y) {
      if (!inFootprint(x, y)) return false
      if (Math.hypot(x - gX, y - gCY) < gR + 12) { gDrag = true; gLastX = x; globeVel = 0; spark(gX, gCY, 0.1) }
      else if (Math.hypot(x - rX, y - (baseY - 52)) < 52) { botBounce = 1; botBlink = 0.3; spark(rX, baseY - 52, 0.1) }
      else if (x > trX - 44 && x < trX + 44 && y > baseY - 108 && y < baseY + 6) {
        // celebratory tap: gleam sweep + squash/bob that ease back, sparkle burst
        trGleam = 1; trSquash = 1; trBob = 1
        spark(trX, baseY - 84, 0.35)
      }
      else if (y > L.caseTop && y < L.caseBot) {
        books[Math.max(0, Math.min(nBooks - 1, Math.floor(((x - L.caseL) / (L.caseR - L.caseL)) * nBooks)))].tip = 1; spark(x, y, 0.1)
      } else spark(x, y, 0.1)
      return true
    },
    onMove(x) { if (gDrag) { globeAngle += (x - gLastX) * 0.02; gLastX = x } },
    onUp(_x, _y, vx) { if (gDrag) { globeVel = Math.max(-9, Math.min(9, vx * 0.01)); gDrag = false } },
    update(dt) {
      if (!gDrag) { globeVel += (0.35 - globeVel) * Math.min(1, dt * 0.5); globeAngle += globeVel * dt }
      botBounce = Math.max(0, botBounce - dt * 3)
      botBlink = Math.max(0, botBlink - dt)
      trGleam = Math.max(0, trGleam - dt * 1.6)     // gleam sweeps then fades
      trSquash += (0 - trSquash) * Math.min(1, dt * 9)  // ease squash back to rest
      trBob += (0 - trBob) * Math.min(1, dt * 6)        // ease bob back to rest
      for (const b of books) b.tip = Math.max(0, b.tip - dt * 4)
    },
    draw(g: Ctx, t) {
      const ts = t * 0.001
      drawCabinet(g, L, books)

      // ---------- TROPHY — a two-handled gold loving cup on a stem + plinth ----------
      {
        // press feedback: squash flattens the cup + a little bob lift, both eased in update()
        const sq = trSquash * 0.16                 // 0..0.16 flatten factor
        const bob = -trBob * 6                      // lifts on tap, settles back
        const GOLD = '#d9a441', GOLD_LT = '#f2c14e', GOLD_HI = '#fbe08a', GOLD_DK = '#b5842f'
        shadow(g, trX, baseY, 42)
        g.strokeStyle = INK; g.lineJoin = 'round'; g.lineWidth = 3.5

        // --- base: stepped plinth with an engraved name-plate ---
        g.fillStyle = GOLD_DK; rr(g, trX - 36, baseY - 12, 72, 16, 5); g.fill(); g.stroke()   // bottom slab
        g.fillStyle = GOLD; rr(g, trX - 28, baseY - 24, 56, 14, 4); g.fill(); g.stroke()       // upper step
        // engraved name-plate (dark inset with text)
        g.fillStyle = '#5a4a2a'; rr(g, trX - 24, baseY - 22, 48, 10, 2); g.fill()
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke()
        g.fillStyle = GOLD_HI; g.font = '700 7px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('CHAMPION', trX, baseY - 16.5)
        g.strokeStyle = INK; g.lineWidth = 3.5

        // --- stem: knob + tapered pillar rising from the plinth to the cup ---
        const cupBot = baseY - 30 + bob            // where the stem meets the cup, lifted by bob
        g.fillStyle = GOLD; rr(g, trX - 7, cupBot - 8, 14, 18, 3); g.fill(); g.stroke()          // pillar
        g.fillStyle = GOLD_LT; g.beginPath(); g.ellipse(trX, cupBot - 6, 12, 6, 0, 0, TAU); g.fill(); g.stroke() // knob

        // --- the cup: bowl on a rim, squashed slightly on press ---
        const cupH = 46 * (1 - sq)                  // squash flattens the bowl
        const cupTopY = cupBot - cupH               // rim line
        const rimW = 34
        // two looped handles behind the bowl (drawn first so the cup overlaps them):
        // each is a CLOSED gold-filled ear attached to the bowl at TWO points —
        // a top anchor near the rim and a lower anchor on the bowl side.
        g.lineJoin = 'round'
        for (const s of [-1, 1]) {
          const topX = trX + s * (rimW - 2), topY = cupTopY + 4    // upper attach (by the rim)
          const botX = trX + s * (rimW - 8), botY = cupTopY + 30   // lower attach (on the bowl)
          g.fillStyle = GOLD_LT; g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath()
          g.moveTo(topX, topY)
          // swing out and around to the lower anchor (outer edge of the ear)
          g.bezierCurveTo(topX + s * 26, topY + 2, botX + s * 26, botY - 2, botX, botY)
          // inner edge hugging back up to the top anchor, closing the loop
          g.bezierCurveTo(botX + s * 12, botY - 8, topX + s * 12, topY + 8, topX, topY)
          g.closePath(); g.fill(); g.stroke()
        }
        g.lineWidth = 3.5
        // bowl body (trapezoid tapering to the stem) — flat fill + ink outline
        g.fillStyle = GOLD_LT
        g.beginPath()
        g.moveTo(trX - rimW, cupTopY)
        g.lineTo(trX + rimW, cupTopY)
        g.lineTo(trX + rimW - 4, cupTopY + 6)
        g.quadraticCurveTo(trX + 14, cupBot + 2, trX + 9, cupBot)
        g.lineTo(trX - 9, cupBot)
        g.quadraticCurveTo(trX - 14, cupBot + 2, trX - rimW + 4, cupTopY + 6)
        g.closePath(); g.fill(); g.strokeStyle = INK; g.stroke()
        // rim band across the mouth of the cup
        g.fillStyle = GOLD; rr(g, trX - rimW - 2, cupTopY - 6, (rimW + 2) * 2, 10, 3); g.fill(); g.stroke()

        // --- emblem: a star + "1" on the bowl face (house text recipe: ink outline, white fill) ---
        star(g, trX, cupTopY + 20, 12, GOLD_HI)
        g.font = '900 12px "Arial Black", sans-serif'; g.lineJoin = 'round'
        g.strokeStyle = INK; g.lineWidth = 3; g.strokeText('1', trX, cupTopY + 21)
        g.fillStyle = '#ffffff'; g.fillText('1', trX, cupTopY + 21)

        // --- ribbon hanging off the base ---
        g.fillStyle = theme.colors.coral; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'
        for (const s of [-1, 1]) {
          g.beginPath()
          g.moveTo(trX + s * 5, baseY - 20)
          g.lineTo(trX + s * 13, baseY + 2)
          g.lineTo(trX + s * 6, baseY - 2)
          g.lineTo(trX + s * 2, baseY + 4)
          g.closePath(); g.fill(); g.stroke()
        }
        g.fillStyle = '#f7c948'; g.beginPath(); g.arc(trX, baseY - 6, 5, 0, TAU); g.fill(); g.stroke()

        // --- idle life: a shine that slowly travels across the gold, clipped to the bowl ---
        g.save()
        g.beginPath()
        g.moveTo(trX - rimW, cupTopY); g.lineTo(trX + rimW, cupTopY)
        g.lineTo(trX + rimW - 4, cupTopY + 6); g.quadraticCurveTo(trX + 14, cupBot + 2, trX + 9, cupBot)
        g.lineTo(trX - 9, cupBot); g.quadraticCurveTo(trX - 14, cupBot + 2, trX - rimW + 4, cupTopY + 6)
        g.closePath(); g.clip()
        const sweep = ((Math.sin(ts * 0.6) + 1) / 2)              // 0..1 slow travel
        const shX = trX - rimW + sweep * rimW * 2
        g.fillStyle = `rgba(255,255,255,${0.28 + trGleam * 0.5})`  // tap makes the shine flare
        g.beginPath(); g.ellipse(shX, cupTopY + 22, 5 + trGleam * 4, cupH * 0.4, -0.35, 0, TAU); g.fill()
        g.restore()

        // --- periodic sparkle glint above the rim ---
        if (Math.sin(ts * 1.3 + trX) > 0.92) star(g, trX + 26, cupTopY - 12, 5, '#ffffff')
        if (trGleam > 0.5) star(g, trX - 26, cupTopY - 8, 5 * trGleam, '#ffffff')
        g.textAlign = 'left'; g.textBaseline = 'alphabetic'   // restore canvas text defaults
      }

      // ---------- POTTED PLANT ----------
      shadow(g, pX, baseY, 36)
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.4, len = 56 + (i % 2) * 16, sway = Math.sin(ts * 0.9 + i) * 0.12
        const tipX = pX + Math.cos(a + sway) * len, tipY = (baseY - 36) + Math.sin(a + sway) * len
        g.fillStyle = i % 2 ? '#4f9a55' : '#5cae61'; g.strokeStyle = INK; g.lineWidth = 2.6; g.lineJoin = 'round'
        g.beginPath(); g.moveTo(pX, baseY - 30); g.quadraticCurveTo((pX + tipX) / 2 - Math.sin(a) * 12, (baseY - 36 + tipY) / 2, tipX, tipY); g.quadraticCurveTo((pX + tipX) / 2 + Math.sin(a) * 12, (baseY - 36 + tipY) / 2 + 10, pX, baseY - 30); g.closePath(); g.fill(); g.stroke()
      }
      g.fillStyle = '#cf6b4a'; g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); g.moveTo(pX - 34, baseY - 38); g.lineTo(pX + 34, baseY - 38); g.lineTo(pX + 26, baseY); g.lineTo(pX - 26, baseY); g.closePath(); g.fill(); g.stroke()
      g.fillStyle = '#e07a56'; rr(g, pX - 37, baseY - 46, 74, 12, 3); g.fill(); g.stroke()

      // ---------- ROBOT ----------
      const bob = Math.sin(ts * 2) * 3 - botBounce * 12, rBaseY = baseY + bob
      shadow(g, rX, baseY, 36)
      g.strokeStyle = INK; g.lineWidth = 3.5; g.lineJoin = 'round'
      g.beginPath(); g.moveTo(rX, rBaseY - 96); g.lineTo(rX, rBaseY - 114); g.stroke()
      g.fillStyle = theme.colors.coral; g.beginPath(); g.arc(rX, rBaseY - 118, 6, 0, TAU); g.fill(); g.stroke()
      g.fillStyle = '#f2c14e'; rr(g, rX - 28, rBaseY - 50, 56, 50, 9); g.fill(); g.stroke()
      g.fillStyle = '#7fbfc7'; g.beginPath(); g.arc(rX, rBaseY - 28, 8, 0, TAU); g.fill(); g.stroke()
      for (const s of [-1, 1]) { g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(rX + s * 28, rBaseY - 40); g.lineTo(rX + s * 40, rBaseY - 24); g.stroke() }
      g.fillStyle = '#e6b83c'; rr(g, rX - 26, rBaseY - 96, 52, 48, 9); g.fill(); g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      const eh = botBlink > 0 ? 2 : 8
      g.fillStyle = INK; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(rX + s * 12, rBaseY - 74, 6, eh, 0, 0, TAU); g.fill() }
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(rX - 10, rBaseY - 58); g.lineTo(rX + 10, rBaseY - 58); g.stroke()

      // ---------- GLOBE — a tilted desk globe on a black stand ----------
      const TILT_FWD = 0.26, TILT_LEAN = 0.36
      const cf = Math.cos(TILT_FWD), sf = Math.sin(TILT_FWD), cln = Math.cos(TILT_LEAN), sln = Math.sin(TILT_LEAN)
      // (lon,lat)° → unit vector on the sphere after spin + axial tilt; +Z faces viewer
      const unit = (lo: number, la: number): { X: number; Y: number; Z: number } => {
        const rel = lo * (Math.PI / 180) + globeAngle, lat = la * (Math.PI / 180), cc = Math.cos(lat)
        const x = cc * Math.sin(rel), y = Math.sin(lat), z = cc * Math.cos(rel)
        const y2 = y * cf - z * sf, z2 = y * sf + z * cf
        return { X: x * cln - y2 * sln, Y: x * sln + y2 * cln, Z: z2 }
      }
      const project = (lo: number, la: number): { x: number; y: number; z: number } => {
        const u = unit(lo, la); return { x: gX + u.X * gR, y: gCY - u.Y * gR, z: u.Z }
      }
      const ringR = gR + 12
      // black pedestal base + stem (behind the globe)
      g.fillStyle = 'rgba(32,26,23,0.22)'; g.beginPath(); g.ellipse(gX + 6, baseY + 1, 46, 12, 0, 0, TAU); g.fill()
      g.fillStyle = '#33333a'; g.strokeStyle = INK; g.lineWidth = 3; g.lineJoin = 'round'
      g.beginPath(); g.moveTo(gX - 11, baseY - 6); g.lineTo(gX + 11, baseY - 6); g.lineTo(gX + 6, gCY + gR - 4); g.lineTo(gX - 6, gCY + gR - 4); g.closePath(); g.fill(); g.stroke()
      g.beginPath(); g.ellipse(gX, baseY, 46, 14, 0, 0, TAU); g.fill(); g.stroke()
      // globe body
      g.save(); g.beginPath(); g.arc(gX, gCY, gR, 0, TAU); g.clip()
      g.fillStyle = '#3f8fd0'; g.fillRect(gX - gR, gCY - gR, gR * 2, gR * 2)   // ocean
      const POL = ['#8fce6b', '#f2d06b', '#e39a5b', '#c99ad6', '#f295a8', '#7fc9c0', '#9fd06b', '#e3b85b']
      // clip each landmass to the FRONT hemisphere (Z>=0): edges crossing the
      // horizon are cut at the rim and rejoined by an arc along the limb, so a wide
      // continent (Eurasia) never folds a coloured wedge across the globe.
      WORLD.forEach((cont, ci) => {
        if (cont.every(([, la]) => la < -55)) return          // skip the Antarctica strip
        const u = cont.map(([lo, la]) => unit(lo, la))
        if (u.every((p) => p.Z < 0.02)) return                // wholly on the far side
        const poly: { x: number; y: number; rim: boolean; ang: number }[] = []
        for (let k = 0; k < u.length; k++) {
          const A = u[k], B = u[(k + 1) % u.length]
          if (A.Z >= 0) poly.push({ x: gX + A.X * gR, y: gCY - A.Y * gR, rim: false, ang: 0 })
          if ((A.Z >= 0) !== (B.Z >= 0)) {
            const t = A.Z / (A.Z - B.Z); let ix = A.X + (B.X - A.X) * t, iy = A.Y + (B.Y - A.Y) * t
            const dd = Math.hypot(ix, iy) || 1; ix /= dd; iy /= dd
            const sx = gX + ix * gR, sy = gCY - iy * gR
            poly.push({ x: sx, y: sy, rim: true, ang: Math.atan2(sy - gCY, sx - gX) })
          }
        }
        if (poly.length < 3) return
        const fin: { x: number; y: number }[] = []
        for (let k = 0; k < poly.length; k++) {
          const c = poly[k], nx = poly[(k + 1) % poly.length]; fin.push(c)
          if (c.rim && nx.rim) {   // walk the limb between two horizon crossings
            let da = nx.ang - c.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU
            const steps = Math.max(1, Math.round(Math.abs(da) / 0.25))
            for (let s = 1; s < steps; s++) { const a = c.ang + (da * s) / steps; fin.push({ x: gX + Math.cos(a) * gR, y: gCY + Math.sin(a) * gR }) }
          }
        }
        g.fillStyle = POL[ci % POL.length]; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.lineJoin = 'round'
        g.beginPath(); fin.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fill(); g.stroke()
      })
      // graticule — front-facing arcs only
      g.strokeStyle = 'rgba(255,255,255,0.24)'; g.lineWidth = 1.1
      const arc = (pts: { x: number; y: number; z: number }[]): void => {
        g.beginPath(); let pen = false
        for (const p of pts) { if (p.z > 0.02) { pen ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); pen = true } else pen = false }
        g.stroke()
      }
      for (const la of [-40, 0, 40]) { const pts = []; for (let lo = -180; lo <= 180; lo += 8) pts.push(project(lo, la)); arc(pts) }
      for (let m = 0; m < 6; m++) { const pts = []; for (let la = -82; la <= 82; la += 8) pts.push(project(m * 60, la)); arc(pts) }
      // curvature crescent + glint
      g.fillStyle = 'rgba(32,26,23,0.16)'; g.beginPath(); g.arc(gX, gCY, gR, 0, TAU); g.arc(gX - gR * 0.18, gCY - gR * 0.22, gR * 0.92, 0, TAU, true); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(gX - gR * 0.35, gCY - gR * 0.42, gR * 0.24, gR * 0.13, -0.6, 0, TAU); g.fill()
      g.restore()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.beginPath(); g.arc(gX, gCY, gR, 0, TAU); g.stroke()
      // meridian hoop (in front, leaning with the axis) + pole mounts
      g.save(); g.translate(gX, gCY); g.rotate(TILT_LEAN)
      g.strokeStyle = '#2b2b30'; g.lineWidth = 9; g.lineCap = 'round'
      g.beginPath(); g.arc(0, 0, ringR, Math.PI * 0.5, Math.PI * 1.5); g.stroke()
      g.fillStyle = '#2b2b30'; g.strokeStyle = INK; g.lineWidth = 2.4
      g.beginPath(); g.arc(0, -ringR, 8, 0, TAU); g.fill(); g.stroke()
      g.beginPath(); g.arc(0, ringR, 7, 0, TAU); g.fill(); g.stroke()
      g.restore()
    },
  }
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
function shadow(g: Ctx, x: number, y: number, r: number): void {
  g.fillStyle = 'rgba(32,26,23,0.22)'; g.beginPath(); g.ellipse(x + 5, y - 2, r, 11, 0, 0, TAU); g.fill()
}
function star(g: Ctx, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 2.4; g.lineJoin = 'round'; g.beginPath()
  for (let k = 0; k < 10; k++) { const rad = k % 2 ? r * 0.42 : r, a = -Math.PI / 2 + (k * Math.PI) / 5; k ? g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) }
  g.closePath(); g.fill(); g.stroke()
}
