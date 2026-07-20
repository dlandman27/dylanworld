import { theme } from '../../config/theme'
import type { Ctx, TableGame } from './shared'
import { INK, roundRect } from './shared'

// A piece of mail on the table, addressed to you-know-who. Drag it around like
// anything else; TAP it and the flap opens, the letter slides out, and the
// contact card appears. Tapping again (or closing the card) tucks it back in.

const EW = 96   // envelope half-width
const EH = 64   // envelope half-height

// the stamp wears Dylan's pixel portrait
const stampImg = new Image()
stampImg.src = '/dylan-avatar.png'

export type MailGame = TableGame & { close: () => void }

export function createMail(
  hx: number,
  hy: number,
  onOpen: () => void,
  onClose: () => void,
): MailGame {
  // the mail stays PUT — it's the one thing on the table you can rely on
  const x = hx, y = hy
  const rot = -0.06
  let open01 = 0        // 0 sealed … 1 letter out
  let wantOpen = false
  let held = false

  const game: MailGame = {
    id: 'mail',
    close() {
      wantOpen = false
    },
    onDown(px, py) {
      const cos = Math.cos(-rot), sin = Math.sin(-rot)
      const lx = (px - x) * cos - (py - y) * sin
      const ly = (px - x) * sin + (py - y) * cos
      if (Math.abs(lx) > EW + 12 || Math.abs(ly) > EH + 34) return false
      held = true
      return true
    },
    onMove() { /* the mail doesn't move */ },
    onUp() {
      if (!held) return
      held = false
      wantOpen = !wantOpen
      if (wantOpen) onOpen()
      else onClose()
    },
    update(dt) {
      open01 += ((wantOpen ? 1 : 0) - open01) * Math.min(1, dt * 8)
    },
    draw(g: Ctx) {
      g.save()
      g.translate(x, y)
      g.rotate(rot)

      // shadow
      g.fillStyle = 'rgba(32,26,23,0.2)'
      roundRect(g, -EW + 5, -EH + 8, EW * 2, EH * 2, 8); g.fill()

      // the opened flap, standing up ABOVE the envelope (drawn furthest back)
      const flapUp = Math.max(0, (open01 - 0.35) / 0.65)
      if (flapUp > 0) {
        g.fillStyle = '#efdfbc'
        g.beginPath()
        g.moveTo(-EW + 3, -EH + 4)
        g.lineTo(0, -EH - flapUp * EH * 1.15)
        g.lineTo(EW - 3, -EH + 4)
        g.closePath()
        g.fill()
        g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke()
      }

      // the letter, sliding up out of the envelope as it opens
      if (open01 > 0.02) {
        const rise = open01 * EH * 1.35
        g.fillStyle = '#fbfaf4'
        roundRect(g, -EW * 0.78, -EH * 0.7 - rise, EW * 1.56, EH * 1.5, 6)
        g.fill()
        g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()
        // scribbled lines on the letter
        g.strokeStyle = 'rgba(32,26,23,0.4)'
        g.lineWidth = 2
        for (let i = 0; i < 3; i++) {
          const ly = -EH * 0.45 - rise + i * 13
          g.beginPath(); g.moveTo(-EW * 0.6, ly); g.lineTo(EW * (0.2 + (i % 2) * 0.3), ly); g.stroke()
        }
      }

      // envelope body
      g.fillStyle = '#f6ead0'
      roundRect(g, -EW, -EH, EW * 2, EH * 2, 8); g.fill()
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke()
      // the V of the flap (closed) hinges open as open01 grows
      g.save()
      roundRect(g, -EW, -EH, EW * 2, EH * 2, 8); g.clip()
      if (open01 < 0.5) {
        // closed flap: V from the top corners to centre
        g.fillStyle = '#efdfbc'
        g.beginPath()
        g.moveTo(-EW, -EH)
        g.lineTo(0, EH * 0.25 - open01 * EH * 1.4)
        g.lineTo(EW, -EH)
        g.closePath()
        g.fill()
        g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke()
      }
      g.restore()

      // address + stamp when sealed
      if (open01 < 0.4) {
        g.globalAlpha = 1 - open01 * 2.5
        // wax seal
        g.fillStyle = theme.colors.coral
        g.beginPath(); g.arc(0, EH * 0.14, 15, 0, Math.PI * 2); g.fill()
        g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke()
        g.fillStyle = INK
        g.textAlign = 'center'; g.textBaseline = 'middle'
        g.font = `800 15px ${theme.fonts.display}, sans-serif`
        g.fillText('D', 0, EH * 0.16)
        // corner stamp — Dylan's pixel portrait behind perforated edges
        const sx = EW - 40, sy = -EH + 10, sw = 30, sh = 34
        g.fillStyle = theme.colors.sky
        g.fillRect(sx, sy, sw, sh)
        if (stampImg.complete && stampImg.naturalWidth) {
          // keep the portrait square — no stretching to the stamp's shape
          const side = Math.min(sw - 4, sh - 4)
          g.save()
          g.imageSmoothingEnabled = false
          g.drawImage(stampImg, sx + (sw - side) / 2, sy + (sh - side) / 2, side, side)
          g.restore()
        }
        g.lineWidth = 2; g.strokeStyle = INK
        g.setLineDash([3, 3])
        g.strokeRect(sx, sy, sw, sh)
        g.setLineDash([])
        // "say hi →" whisper under the seal
        g.font = `700 13px ${theme.fonts.body}, sans-serif`
        g.fillStyle = 'rgba(32,26,23,0.65)'
        g.fillText('say hi', 0, EH * 0.62)
        g.globalAlpha = 1
      }

      g.restore()
    },
  }
  return game
}
