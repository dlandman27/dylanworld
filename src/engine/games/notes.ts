import { theme } from '../../config/theme'
import { spark } from '../physics'
import type { Ctx, TableGame } from './shared'
import { INK } from './shared'

// The doodle pad. Draw on the top sheet with your cursor, then grab the
// dog-eared corner, RIP the note off, and stick it anywhere on the table.
// A fresh sheet waits underneath. Notes persist in localStorage — the table
// slowly collects your graffiti.

const NW = 150            // note size (square-ish)
const CORNER = 34         // dog-ear grab zone
const PAPER = '#ffe08a'
const PAPER_EDGE = '#e8c96a'
const MAX_NOTES = 40
const STORE_KEY = 'dw-doodle-notes'

type Stroke = number[]    // flat [x0,y0, x1,y1, ...] in note-local coords

interface StuckNote { x: number; y: number; rot: number; strokes: Stroke[] }

interface Saved { top: Stroke[]; notes: StuckNote[] }

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Saved
      if (Array.isArray(s.notes) && Array.isArray(s.top)) return s
    }
  } catch { /* fresh table */ }
  return { top: [], notes: [] }
}

export function createNotes(px: number, py: number): TableGame {
  const saved = load()
  let topStrokes: Stroke[] = saved.top
  const notes: StuckNote[] = saved.notes
  let drawing: Stroke | null = null
  let carrying: StuckNote | null = null
  let carryLift = 0
  let peelPull = 0
  let mode: 'idle' | 'draw' | 'peel' | 'carry' | 'moveNote' = 'idle'

  const save = (): void => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ top: topStrokes, notes }))
    } catch { /* private mode */ }
  }

  const onPad = (x: number, y: number): boolean =>
    Math.abs(x - px) < NW / 2 + 6 && Math.abs(y - py) < NW / 2 + 6
  const onDogEar = (x: number, y: number): boolean =>
    x > px + NW / 2 - CORNER && x < px + NW / 2 + 10 &&
    y > py + NW / 2 - CORNER && y < py + NW / 2 + 10

  const noteAt = (x: number, y: number): StuckNote | null => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      const cos = Math.cos(-n.rot), sin = Math.sin(-n.rot)
      const lx = (x - n.x) * cos - (y - n.y) * sin
      const ly = (x - n.x) * sin + (y - n.y) * cos
      if (Math.abs(lx) < NW / 2 && Math.abs(ly) < NW / 2) return n
    }
    return null
  }

  const drawStrokes = (g: Ctx, strokes: Stroke[]): void => {
    g.strokeStyle = INK
    g.lineWidth = 3.2
    g.lineCap = 'round'
    g.lineJoin = 'round'
    for (const s of strokes) {
      if (s.length < 4) continue
      g.beginPath()
      g.moveTo(s[0], s[1])
      for (let i = 2; i < s.length; i += 2) g.lineTo(s[i], s[i + 1])
      g.stroke()
    }
  }

  const drawSheet = (g: Ctx, dogEar: boolean): void => {
    g.fillStyle = PAPER
    g.strokeStyle = INK
    g.lineWidth = 2.6
    if (dogEar) {
      // sheet with a folded corner (the rip handle)
      const h = NW / 2, f = 24
      g.beginPath()
      g.moveTo(-h, -h); g.lineTo(h, -h); g.lineTo(h, h - f)
      g.lineTo(h - f, h); g.lineTo(-h, h); g.closePath()
      g.fill(); g.stroke()
      g.fillStyle = PAPER_EDGE
      g.beginPath()
      g.moveTo(h, h - f); g.lineTo(h - f, h); g.lineTo(h - f, h - f); g.closePath()
      g.fill(); g.stroke()
    } else {
      g.fillRect(-NW / 2, -NW / 2, NW, NW)
      g.strokeRect(-NW / 2, -NW / 2, NW, NW)
    }
  }

  return {
    id: 'notes',
    onDown(x, y) {
      const n = noteAt(x, y)
      if (n && !onPad(x, y)) {
        // pick a stuck note back up
        const idx = notes.indexOf(n)
        notes.splice(idx, 1)
        carrying = n
        mode = 'moveNote'
        return true
      }
      if (onDogEar(x, y)) { mode = 'peel'; peelPull = 0; return true }
      if (onPad(x, y)) {
        mode = 'draw'
        drawing = [x - px, y - py]
        topStrokes.push(drawing)
        return true
      }
      return false
    },
    onMove(x, y) {
      if (mode === 'draw' && drawing) {
        const lx = Math.max(-NW / 2, Math.min(NW / 2, x - px))
        const ly = Math.max(-NW / 2, Math.min(NW / 2, y - py))
        const n = drawing.length
        if (n < 2 || Math.hypot(lx - drawing[n - 2], ly - drawing[n - 1]) > 3) {
          drawing.push(lx, ly)
        }
      } else if (mode === 'peel') {
        peelPull = Math.hypot(x - (px + NW / 2), y - (py + NW / 2))
        if (peelPull > 46) {
          // RIP — the note comes off in your hand
          carrying = { x, y, rot: 0, strokes: topStrokes }
          topStrokes = []
          mode = 'carry'
          spark(px + NW / 2, py + NW / 2, 0.18)
          save()
        }
      } else if ((mode === 'carry' || mode === 'moveNote') && carrying) {
        carrying.x = x
        carrying.y = y
      }
    },
    onUp() {
      if (mode === 'draw') {
        drawing = null
        save()
      } else if ((mode === 'carry' || mode === 'moveNote') && carrying) {
        // stick it down with a little slap
        carrying.rot = (Math.random() - 0.5) * 0.22
        notes.push(carrying)
        if (notes.length > MAX_NOTES) notes.shift()
        spark(carrying.x, carrying.y, 0.14)
        carrying = null
        save()
      }
      mode = 'idle'
      peelPull = 0
    },
    update(dt) {
      carryLift += (((mode === 'carry' || mode === 'moveNote') ? 1 : 0) - carryLift) * Math.min(1, dt * 12)
    },
    draw(g: Ctx) {
      // stuck notes first (they live on the table)
      for (const n of notes) {
        g.save()
        g.translate(n.x, n.y)
        g.rotate(n.rot)
        g.fillStyle = 'rgba(32,26,23,0.16)'
        g.fillRect(-NW / 2 + 3, -NW / 2 + 5, NW, NW)
        drawSheet(g, false)
        // tape strip at the top
        g.fillStyle = 'rgba(255,255,255,0.55)'
        g.fillRect(-16, -NW / 2 - 6, 32, 13)
        g.strokeStyle = 'rgba(32,26,23,0.4)'
        g.lineWidth = 1.4
        g.strokeRect(-16, -NW / 2 - 6, 32, 13)
        drawStrokes(g, n.strokes)
        g.restore()
      }

      // the pad: a little stack, top sheet with the doodle + dog-ear
      g.save()
      g.translate(px, py)
      g.fillStyle = 'rgba(32,26,23,0.2)'
      g.fillRect(-NW / 2 + 4, -NW / 2 + 7, NW, NW)
      // under-sheets peeking out
      for (const [dx, dy] of [[3.5, 5], [1.5, 2.5]] as [number, number][]) {
        g.save()
        g.translate(dx, dy)
        g.fillStyle = PAPER_EDGE
        g.strokeStyle = INK
        g.lineWidth = 2
        g.fillRect(-NW / 2, -NW / 2, NW, NW)
        g.strokeRect(-NW / 2, -NW / 2, NW, NW)
        g.restore()
      }
      // top sheet lifts slightly as you tug the dog-ear
      const tug = Math.min(1, peelPull / 46)
      g.rotate(-tug * 0.09)
      drawSheet(g, true)
      drawStrokes(g, topStrokes)
      if (topStrokes.length === 0) {
        g.fillStyle = 'rgba(32,26,23,0.35)'
        g.font = `700 15px ${theme.fonts.body}, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('doodle!', 0, -NW / 2 + 22)
      }
      g.restore()

      // the note in your hand rides on top with a lifted shadow
      if (carrying) {
        g.save()
        g.translate(carrying.x, carrying.y)
        g.fillStyle = `rgba(32,26,23,${0.2 - carryLift * 0.08})`
        g.fillRect(-NW / 2 + 4 + carryLift * 9, -NW / 2 + 6 + carryLift * 13, NW, NW)
        g.rotate(0.05)
        g.scale(1 + carryLift * 0.08, 1 + carryLift * 0.08)
        drawSheet(g, false)
        drawStrokes(g, carrying.strokes)
        g.restore()
      }
    },
  }
}
