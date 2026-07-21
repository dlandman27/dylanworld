import { theme } from '../../config/theme'
import { apps } from '../../config/apps'
import { registerObstacleProvider } from '../physics'
import { clunk } from '../audio'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// An iPad on the table showing Dylan's released apps. Tap an icon to open its
// App Store page in a new tab. Real device details: live clock/date + the
// machine's actual battery, a power button (screen off/on), and a first-run
// lock screen you swipe up to open. Fixed kiosk; a solid slab things hit.

const SW = 460, SH = 340
const M = 16
const BW = SW / 2 + M, BH = SH / 2 + M
const STATUS = 26
const COLS = 4
const ICON = 66
const ROW_H = ICON + 26
const WALL = '#bfe0f2'
const ICON_COLORS = [theme.colors.coral, theme.colors.sky, theme.colors.lime, theme.colors.purple, theme.colors.orange, theme.colors.pink, theme.colors.teal, '#f7c948']
const UNLOCK_KEY = 'dw-ipad-unlocked'

// preload icons once
const imgs = new Map<string, HTMLImageElement>()
for (const a of apps) {
  if (a.icon && !imgs.has(a.icon)) { const im = new Image(); im.src = a.icon; imgs.set(a.icon, im) }
}

// live battery (the actual device), with a graceful fallback
const battery = { level: 1, charging: false, known: false }
try {
  const nav = navigator as unknown as { getBattery?: () => Promise<Record<string, unknown>> }
  nav.getBattery?.().then((b) => {
    const upd = (): void => { battery.level = b.level as number; battery.charging = b.charging as boolean; battery.known = true }
    upd()
    ;(b as unknown as EventTarget).addEventListener('levelchange', upd)
    ;(b as unknown as EventTarget).addEventListener('chargingchange', upd)
  }).catch(() => { /* unsupported */ })
} catch { /* unsupported */ }

const clock = (): { time: string; date: string } => {
  const now = new Date()
  const h = now.getHours() % 12 || 12
  const m = String(now.getMinutes()).padStart(2, '0')
  return { time: `${h}:${m}`, date: now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }
}

export function createIpad(cx: number, cy: number): TableGame {
  const SELF = Symbol('ipad')
  let unlocked = false
  try { unlocked = localStorage.getItem(UNLOCK_KEY) === '1' } catch { /* private mode */ }
  let state: 'locked' | 'home' | 'off' = unlocked ? 'home' : 'locked'
  let lockY = 0, lockTarget = 0     // lock overlay slide (0 covering, -SH gone)
  let swiping = false, swipeStart = 0
  let press = -1, pressScale = 0
  let ptr = { x: 0, y: 0 }

  const gapX = (SW - COLS * ICON) / (COLS + 1)
  const gridTop = -SH / 2 + STATUS + 26
  const iconRect = (i: number): { x: number; y: number } => {
    const col = i % COLS, row = Math.floor(i / COLS)
    return { x: -SW / 2 + gapX + col * (ICON + gapX) + ICON / 2, y: gridTop + row * ROW_H + ICON / 2 }
  }
  const iconAt = (lx: number, ly: number): number => {
    for (let i = 0; i < apps.length; i++) {
      const r = iconRect(i)
      if (Math.abs(lx - r.x) < ICON / 2 + 6 && Math.abs(ly - r.y) < ICON / 2 + 6) return i
    }
    return -1
  }
  const onPower = (lx: number, ly: number): boolean => Math.abs(lx - BW * 0.42) < 30 && Math.abs(ly + BH) < 18

  registerObstacleProvider(() => [{ x: cx, y: cy, half: Math.min(BW, BH) * 0.94, owner: SELF }])

  return {
    id: 'ipad',
    onDown(x, y) {
      const lx = x - cx, ly = y - cy
      if (onPower(lx, ly)) {
        clunk(0.2)
        if (state === 'off') { state = unlocked ? 'home' : 'locked'; lockY = 0; lockTarget = 0 } else state = 'off'
        return true
      }
      if (Math.abs(lx) > BW || Math.abs(ly) > BH) return false
      ptr = { x: lx, y: ly }
      if (state === 'off') return true
      if (state === 'locked') { swiping = true; swipeStart = ly; return true }
      press = iconAt(lx, ly)
      return true
    },
    onMove(x, y) {
      ptr = { x: x - cx, y: y - cy }
      if (swiping) lockY = Math.min(0, ptr.y - swipeStart)
      else if (press >= 0 && iconAt(ptr.x, ptr.y) !== press) press = -1
    },
    onUp() {
      if (swiping) {
        swiping = false
        lockTarget = lockY < -110 ? -SH : 0 // pulled up far enough → unlock
      } else if (press >= 0 && iconAt(ptr.x, ptr.y) === press) {
        clunk(0.12)
        window.open(apps[press].url, '_blank', 'noopener')
      }
      press = -1
    },
    update(dt) {
      pressScale += ((press >= 0 ? 1 : 0) - pressScale) * Math.min(1, dt * 18)
      if (state === 'locked' && !swiping) {
        lockY += (lockTarget - lockY) * Math.min(1, dt * 14)
        if (lockTarget === -SH && lockY < -SH + 6) {
          state = 'home'; unlocked = true
          try { localStorage.setItem(UNLOCK_KEY, '1') } catch { /* ignore */ }
        }
      }
    },
    draw(g: Ctx, t) {
      g.save()
      g.translate(cx, cy)
      // shadow + aluminium body
      g.fillStyle = 'rgba(32,26,23,0.24)'; roundRect(g, -BW + 6, -BH + 9, BW * 2, BH * 2, 26); g.fill()
      g.fillStyle = '#3c3f45'; roundRect(g, -BW, -BH, BW * 2, BH * 2, 26); g.fill()
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke()
      // power button on the top edge
      g.fillStyle = '#2b2e33'
      roundRect(g, BW * 0.42 - 22, -BH - 8, 44, 12, 4); g.fill()
      g.lineWidth = 2; g.strokeStyle = INK; g.stroke()
      // volume buttons (decor) on the left edge
      g.fillStyle = '#2b2e33'
      roundRect(g, -BW - 8, -BH * 0.4, 12, 34, 4); g.fill(); g.stroke()
      roundRect(g, -BW - 8, -BH * 0.4 + 42, 12, 34, 4); g.fill(); g.stroke()
      // screen recess
      g.fillStyle = '#1c1f23'; roundRect(g, -SW / 2 - 5, -SH / 2 - 5, SW + 10, SH + 10, 14); g.fill()
      g.fillStyle = '#5a5e66'; g.beginPath(); g.arc(-BW + 9, 0, 3.5, 0, Math.PI * 2); g.fill()

      g.save()
      roundRect(g, -SW / 2, -SH / 2, SW, SH, 10); g.clip()

      if (state === 'off') {
        g.fillStyle = '#0c0e10'; g.fillRect(-SW / 2, -SH / 2, SW, SH)
        g.fillStyle = 'rgba(255,255,255,0.04)'
        g.beginPath(); g.ellipse(-SW * 0.2, -SH * 0.3, SW * 0.6, SH * 0.5, -0.4, 0, Math.PI * 2); g.fill()
      } else {
        drawHome(g)
        if (state === 'locked') { g.save(); g.translate(0, lockY); drawLock(g, t); g.restore() }
      }
      g.restore()

      if (state === 'home') { g.fillStyle = 'rgba(32,26,23,0.4)'; roundRect(g, -34, SH / 2 - 10, 68, 4, 2); g.fill() }
      g.restore()
    },
  }

  // ---- screens ----
  function drawStatusBar(g: Ctx): void {
    const { time } = clock()
    g.fillStyle = 'rgba(32,26,23,0.75)'
    g.font = `700 13px ${theme.fonts.body}, sans-serif`
    g.textAlign = 'left'; g.textBaseline = 'middle'
    g.fillText(time, -SW / 2 + 14, -SH / 2 + STATUS / 2)
    g.textAlign = 'right'
    g.fillText('Apps by Dylan Landman', SW / 2 - 52, -SH / 2 + STATUS / 2)
    drawBattery(g, SW / 2 - 44, -SH / 2 + STATUS / 2)
  }
  function drawBattery(g: Ctx, x: number, y: number): void {
    const w = 24, h = 12
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(32,26,23,0.7)'
    roundRect(g, x, y - h / 2, w, h, 3); g.stroke()
    g.fillStyle = 'rgba(32,26,23,0.7)'; g.fillRect(x + w + 1, y - 3, 2, 6) // nub
    const lvl = Math.max(0.04, battery.level)
    g.fillStyle = battery.charging ? '#4caf50' : lvl < 0.2 ? '#e0231c' : 'rgba(32,26,23,0.7)'
    g.fillRect(x + 1.5, y - h / 2 + 1.5, (w - 3) * lvl, h - 3)
    if (battery.charging) { // little bolt
      g.fillStyle = '#fbfaf4'
      g.beginPath(); g.moveTo(x + w / 2 + 1, y - 4); g.lineTo(x + w / 2 - 2, y + 1); g.lineTo(x + w / 2, y + 1); g.lineTo(x + w / 2 - 1, y + 4); g.lineTo(x + w / 2 + 3, y - 1); g.lineTo(x + w / 2 + 1, y - 1); g.closePath(); g.fill()
    }
  }
  function drawHome(g: Ctx): void {
    g.fillStyle = WALL; g.fillRect(-SW / 2, -SH / 2, SW, SH)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.beginPath(); g.ellipse(-SW * 0.2, -SH * 0.3, SW * 0.5, SH * 0.4, -0.4, 0, Math.PI * 2); g.fill()
    drawStatusBar(g)
    g.textAlign = 'center'; g.textBaseline = 'middle'
    for (let i = 0; i < apps.length; i++) {
      const r = iconRect(i)
      const sc = i === press ? 1 - pressScale * 0.12 : 1
      const half = (ICON / 2) * sc
      g.save(); g.translate(r.x, r.y)
      g.fillStyle = 'rgba(32,26,23,0.18)'; roundRect(g, -half + 2, -half + 3, half * 2, half * 2, half * 0.42); g.fill()
      const im = apps[i].icon ? imgs.get(apps[i].icon!) : undefined
      g.save(); roundRect(g, -half, -half, half * 2, half * 2, half * 0.42); g.clip()
      if (im && im.complete && im.naturalWidth) g.drawImage(im, -half, -half, half * 2, half * 2)
      else {
        g.fillStyle = ICON_COLORS[i % ICON_COLORS.length]; g.fillRect(-half, -half, half * 2, half * 2)
        g.fillStyle = '#fbfaf4'; g.font = `900 ${Math.round(half * 1.05)}px "Arial Black", ${theme.fonts.display}, sans-serif`
        g.fillText((apps[i].name[0] || '?').toUpperCase(), 0, 2)
      }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-half * 0.3, -half * 0.5, half, half * 0.6, 0, 0, Math.PI * 2); g.fill()
      g.restore()
      g.lineWidth = 2; g.strokeStyle = 'rgba(32,26,23,0.5)'; roundRect(g, -half, -half, half * 2, half * 2, half * 0.42); g.stroke()
      g.restore()
      g.fillStyle = 'rgba(32,26,23,0.85)'; g.font = `700 11px ${theme.fonts.body}, sans-serif`
      g.fillText(apps[i].name, r.x, r.y + ICON / 2 + 11)
    }
  }
  function drawLock(g: Ctx, t: number): void {
    const { time, date } = clock()
    // dim wallpaper
    g.fillStyle = '#7aa9c4'; g.fillRect(-SW / 2, -SH / 2, SW, SH)
    g.fillStyle = 'rgba(32,26,23,0.28)'; g.fillRect(-SW / 2, -SH / 2, SW, SH)
    // lock glyph
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3
    roundRect(g, -12, -SH / 2 + 42, 24, 18, 4); g.stroke()
    g.beginPath(); g.arc(0, -SH / 2 + 42, 8, Math.PI, 0); g.stroke()
    // big clock + date
    g.fillStyle = '#fbfaf4'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `300 72px ${theme.fonts.body}, sans-serif`
    g.fillText(time, 0, -14)
    g.font = `600 18px ${theme.fonts.body}, sans-serif`
    g.fillText(date, 0, 34)
    // swipe-up hint (bobbing)
    const bob = Math.sin(t / 320) * 4
    g.globalAlpha = 0.9
    g.strokeStyle = '#fbfaf4'; g.lineWidth = 3; g.lineCap = 'round'
    g.beginPath(); g.moveTo(-12, SH / 2 - 40 + bob); g.lineTo(0, SH / 2 - 52 + bob); g.lineTo(12, SH / 2 - 40 + bob); g.stroke()
    g.font = `600 13px ${theme.fonts.body}, sans-serif`
    g.fillStyle = '#fbfaf4'; g.fillText('swipe up to view', 0, SH / 2 - 22)
    g.globalAlpha = 1
  }
}
