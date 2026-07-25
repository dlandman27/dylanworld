import { theme } from '../../config/theme'
import { rsotwSites, rsotwName, rsotwUrl, RSOTW_BASE } from '../../config/rsotw'
import { registerObstacleProvider } from '../physics'
import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A retro CRT telly on a little wooden stand by the bookshelf — it's the Random
// Sites On The Web set. Drawn face-up (the room's screen convention). Power knob
// turns it on; the channel knob spins to a RANDOM rsotw site (channel-surfing =
// the whole rsotw idea); click the screen to visit that site; the little "rsotw"
// plate opens randomsitesontheweb.com itself.

const BW = 540, BH = 420          // TV body (world units)
const INSET = 60                  // screen inset from the body edge
const KN = 26                     // knob radius
const SITE_COLORS = [theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple, theme.colors.orange, theme.colors.pink, theme.colors.teal, '#f7c948']

const hueOf = (slug: string): string => {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return SITE_COLORS[h % SITE_COLORS.length]
}

export function createTv(cx: number, cy: number): TableGame {
  let on = false
  let ch = (Math.random() * rsotwSites.length) | 0
  let flip = 0            // static flash on channel change / power
  let press = ''; let pressT = 0

  const sx0 = cx - BW / 2 + INSET, sy0 = cy - BH / 2 + INSET
  const sw = BW - INSET * 2, sh = BH - INSET * 2 - 34    // leave a strip for the brand/channel readout
  const powerKnob = { x: cx + BW / 2 - 30, y: cy - BH / 2 + 60 }
  const chanKnob = { x: cx + BW / 2 - 30, y: cy - BH / 2 + 130 }
  const brand = { x: cx - BW / 2 + INSET, y: sy0 + sh + 6, w: 150, h: 30 }   // "rsotw" plate on the lower bezel

  registerObstacleProvider(() => [{ x: cx, y: cy + 30, half: BW / 2 }])

  const near = (p: { x: number; y: number }, x: number, y: number): boolean => Math.hypot(x - p.x, y - p.y) < KN + 10
  const inRect = (r: { x: number; y: number; w: number; h: number }, x: number, y: number): boolean => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h
  const onScreen = (x: number, y: number): boolean => x > sx0 && x < sx0 + sw && y > sy0 && y < sy0 + sh

  return {
    id: 'tv',
    onDown(x, y) {
      if (near(powerKnob, x, y)) { on = !on; flip = 0.35; press = 'power'; pressT = 1; clunk(0.4); return true }
      if (near(chanKnob, x, y)) {
        if (on) { let n = ch; while (n === ch) n = (Math.random() * rsotwSites.length) | 0; ch = n; flip = 0.32 }
        press = 'chan'; pressT = 1; clunk(0.4); return true
      }
      if (inRect(brand, x, y)) { window.open(RSOTW_BASE, '_blank', 'noopener'); return true }   // rsotw → home, always
      if (on && onScreen(x, y)) { window.open(rsotwUrl(rsotwSites[ch]), '_blank', 'noopener'); return true }
      return x > cx - BW / 2 - 26 && x < cx + BW / 2 + 26 && y > cy - BH / 2 - 60 && y < cy + BH / 2 + 40
    },
    onMove() {},
    onUp() {},
    update(dt) { flip = Math.max(0, flip - dt); pressT = Math.max(0, pressT - dt * 4) },
    draw(g: Ctx, t) {
      // ---- wooden stand under the set ----
      g.fillStyle = 'rgba(32,26,23,0.24)'; roundRect(g, cx - BW / 2 - 14, cy + BH / 2 - 30, BW + 28, 92, 14); g.fill()
      g.fillStyle = '#7a4e28'; roundRect(g, cx - BW / 2 - 20, cy + BH / 2 - 40, BW + 40, 92, 14); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke()
      g.fillStyle = '#8f5c30'; roundRect(g, cx - BW / 2 - 8, cy + BH / 2 - 30, BW + 16, 40, 8); g.fill(); g.lineWidth = 2; g.stroke()

      // ---- TV body (retro beige plastic) ----
      g.fillStyle = 'rgba(32,26,23,0.26)'; roundRect(g, cx - BW / 2 + 8, cy - BH / 2 + 11, BW, BH, 30); g.fill()
      g.fillStyle = '#5fb3a8'; roundRect(g, cx - BW / 2, cy - BH / 2, BW, BH, 30); g.fill()   // retro teal shell
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; roundRect(g, cx - BW / 2 + 7, cy - BH / 2 + 7, BW - 14, BH - 14, 24); g.stroke()

      // ---- screen bezel + glass ----
      g.fillStyle = '#2a2622'; roundRect(g, sx0 - 10, sy0 - 10, sw + 20, sh + 20, 22); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      g.save()
      roundRect(g, sx0, sy0, sw, sh, 16); g.clip()
      drawScreen(g, sx0, sy0, sw, sh, on, ch, flip, t)
      g.globalAlpha = 0.12; g.fillStyle = INK
      for (let yy = sy0; yy < sy0 + sh; yy += 4) g.fillRect(sx0, yy, sw, 2)   // scanlines
      g.globalAlpha = 1
      const vig = g.createRadialGradient(sx0 + sw / 2, sy0 + sh / 2, sh * 0.2, sx0 + sw / 2, sy0 + sh / 2, sh * 0.72)
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.4)')
      g.fillStyle = vig; g.fillRect(sx0, sy0, sw, sh)
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.beginPath(); g.moveTo(sx0 + 12, sy0 + 10); g.lineTo(sx0 + sw * 0.42, sy0 + 10); g.lineTo(sx0 + 12, sy0 + sh * 0.5); g.closePath(); g.fill()
      g.restore()

      // ---- "rsotw" brand plate (click → home) + channel readout ----
      g.fillStyle = on ? '#1c1c1c' : '#3a3733'
      roundRect(g, brand.x, brand.y, brand.w, brand.h, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke()
      g.fillStyle = on ? '#f7c948' : '#8a8378'; g.font = `900 17px "Arial Black", ${theme.fonts.display}, sans-serif`
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('rsotw', brand.x + brand.w / 2, brand.y + brand.h / 2)
      g.fillStyle = INK; g.font = `800 15px ${theme.fonts.mono}, monospace`; g.textAlign = 'right'
      g.fillText(on ? `CH ${String(ch + 1).padStart(2, '0')}` : 'CH --', cx + BW / 2 - INSET, brand.y + brand.h / 2)

      // ---- knobs ----
      for (const [k, label] of [[powerKnob, 'power'], [chanKnob, 'chan']] as const) {
        const pd = press === label ? pressT : 0
        g.save(); g.translate(k.x, k.y + pd * 2)
        g.fillStyle = 'rgba(32,26,23,0.22)'; g.beginPath(); g.arc(2, 3, KN, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#6f625a'; g.beginPath(); g.arc(0, 0, KN, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
        g.strokeStyle = '#e8e2d6'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -KN + 6); g.stroke()
        g.restore()
      }
      g.fillStyle = on ? '#57d06a' : '#b03a2e'; g.beginPath(); g.arc(cx + BW / 2 - 30, cy + BH / 2 - 34, 5, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke()

      // ---- antenna (rabbit ears) ----
      g.strokeStyle = '#9aa0a5'; g.lineWidth = 5; g.lineCap = 'round'
      for (const dir of [-1, 1]) {
        g.beginPath(); g.moveTo(cx + dir * 24, cy - BH / 2 + 14); g.lineTo(cx + dir * 150, cy - BH / 2 - 120); g.stroke()
        g.fillStyle = '#9aa0a5'; g.beginPath(); g.arc(cx + dir * 150, cy - BH / 2 - 120, 6, 0, Math.PI * 2); g.fill()
      }
    },
  }
}

function drawScreen(g: Ctx, x: number, y: number, w: number, h: number, on: boolean, ch: number, flip: number, t: number): void {
  if (!on) { g.fillStyle = '#14110e'; g.fillRect(x, y, w, h); return }
  if (flip > 0.05) { drawSnow(g, x, y, w, h); return }
  const slug = rsotwSites[ch], name = rsotwName(slug), col = hueOf(slug)
  // channel background in the site's colour, with a soft top sheen
  g.fillStyle = col; g.fillRect(x, y, w, h)
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w, h * 0.5)
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x, y + h * 0.5, w, h * 0.5)
  // site name (bobbing), url, and a blinking "click to visit"
  const bob = Math.sin(t / 260) * 8
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  g.font = `900 30px "Arial Black", ${theme.fonts.display}, sans-serif`
  g.lineWidth = 6; g.strokeStyle = INK; g.strokeText(fit(g, name, w - 36), x + w / 2, y + h / 2 - 16 + bob)
  g.fillStyle = '#fff'; g.fillText(fit(g, name, w - 36), x + w / 2, y + h / 2 - 16 + bob)
  g.font = `700 13px ${theme.fonts.mono}, monospace`; g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillText(`randomsitesontheweb.com/${slug}`, x + w / 2, y + h / 2 + 16)
  if (Math.floor(t / 500) % 2 === 0) {
    g.fillStyle = INK; g.font = `800 15px ${theme.fonts.display}, sans-serif`
    g.fillText('▶ click to visit', x + w / 2, y + h - 24)
  }
}

function drawSnow(g: Ctx, x: number, y: number, w: number, h: number): void {
  g.fillStyle = '#222'; g.fillRect(x, y, w, h)
  for (let i = 0; i < 800; i++) {
    const v = Math.random()
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${v * 0.7})` : `rgba(120,120,120,${v})`
    g.fillRect(x + Math.random() * w, y + Math.random() * h, 3, 3)
  }
}

function fit(g: Ctx, text: string, max: number): string {
  if (g.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s + '…'
}
