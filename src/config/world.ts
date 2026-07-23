import type { WorldConfig } from '../types'

// The room grew 5200×3600 → 6600×4600 for the bedroom furniture (bed, desk,
// dresser…). Everything shifted +700x +940y so the rug (keyed to spawn) sits at
// the exact center of the new floor.
export const world: WorldConfig = {
  width: 6600,
  height: 4600,
  spawn: { x: 3300, y: 2740 },
  name: "DYLAN'S WORLD",
  landmarks: [
    // Project District — north-east quarter
    { id: 'lm-rsotw', kind: 'project', x: 2150, y: 450, w: 220, h: 170, label: 'Random Sites Arcade', color: 'orange', cardId: 'rsotw' },
    { id: 'lm-playbook-raise', kind: 'project', x: 2450, y: 600, w: 180, h: 150, label: 'Raise HQ', color: 'lime', cardId: 'playbook-raise' },
    { id: 'lm-playbook-sports', kind: 'project', x: 2700, y: 420, w: 180, h: 150, label: 'Playbook Stadium', color: 'sky', cardId: 'playbook-sports' },
    { id: 'lm-takeoff', kind: 'project', x: 2200, y: 800, w: 160, h: 140, label: 'Takeoff Tower', color: 'coral', cardId: 'takeoff' },
    { id: 'lm-pixel-portfolio', kind: 'project', x: 2550, y: 900, w: 150, h: 130, label: 'Old Portfolio Museum', color: 'purple', cardId: 'pixel-portfolio' },
    { id: 'lm-colorle', kind: 'project', x: 2050, y: 1100, w: 130, h: 120, label: 'Colorle Kiosk', color: 'pink', cardId: 'colorle' },
    { id: 'lm-fractal', kind: 'project', x: 2350, y: 1150, w: 130, h: 120, label: 'Fractal Garden', color: 'teal', cardId: 'fractal' },
    { id: 'lm-randomphotos', kind: 'project', x: 2650, y: 1200, w: 130, h: 120, label: 'Photo River', color: 'sky', cardId: 'randomphotos' },
    { id: 'lm-wiigit', kind: 'project', x: 2150, y: 1400, w: 140, h: 120, label: 'Wiigit Workshop', color: 'orange', cardId: 'wiigit' },
    { id: 'lm-paper', kind: 'project', x: 2500, y: 1500, w: 150, h: 120, label: 'Research Library', color: 'purple', cardId: 'virtual-classroom' },

    // Story Trail — western path, roughly top to bottom
    { id: 'lm-bio', kind: 'story', x: 700, y: 400, w: 90, h: 110, label: 'Start Here', color: 'coral', cardId: 'bio' },
    { id: 'lm-umass', kind: 'story', x: 500, y: 700, w: 90, h: 110, label: 'UMass', color: 'coral', cardId: 'umass' },
    { id: 'lm-hoboken', kind: 'story', x: 650, y: 1050, w: 90, h: 110, label: 'Jersey City', color: 'coral', cardId: 'hoboken' },
    { id: 'lm-playbook-story', kind: 'story', x: 450, y: 1400, w: 90, h: 110, label: 'Work', color: 'coral', cardId: 'playbook' },
    { id: 'lm-skills', kind: 'story', x: 700, y: 1650, w: 90, h: 110, label: 'Toolbox', color: 'coral', cardId: 'skills' },

    // Contact Cove — south
    { id: 'lm-mailbox', kind: 'contact', x: 1500, y: 1750, w: 80, h: 110, label: 'Mailbox', color: 'sky', cardId: 'contact' },

    // Decor
    { id: 'lm-welcome', kind: 'decor', x: 1500, y: 700, w: 160, h: 70, label: 'welcome to dylanworld', color: 'lime' },
  ],
  props: [
    // marbles strewn across the table, grabbable/flingable
    { kind: 'pebble', x: 3300, y: 2740, count: 30, spread: 2100 },
    { kind: 'ball', x: 2700, y: 2140, count: 1, spread: 0 },
    // loose change: a spilled pocket near the cards + strays everywhere
    { kind: 'coin', x: 4600, y: 2440, count: 7, spread: 260 },
    { kind: 'coin', x: 3300, y: 2740, count: 8, spread: 2000 },
    // poker chips by the cards — somebody's mid-hand
    { kind: 'chip', x: 4850, y: 2290, count: 10, spread: 150 },
    { kind: 'chip', x: 4680, y: 2480, count: 5, spread: 90 },  // moved off the bigger bed's footprint
  ],
}
