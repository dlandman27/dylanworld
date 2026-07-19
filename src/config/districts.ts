// Dylan's World: one sandy island carved into irregular zone regions that tile it
// edge-to-edge (a Voronoi partition of the seeds below). The sandy pathways are
// the thin gaps between regions. Seeds are scattered organically — not a grid.

export interface District {
  id: string
  name: string
  subtitle: string
  /** seed point — the region is everywhere on the island nearest this point */
  cx: number
  cy: number
  tint: string
  theme: 'grass' | 'sand' | 'beach' | 'forest' | 'tech' | 'space' | 'farm'
  labelDy?: number
}

export const districts: District[] = [
  { id: 'tech-city',        name: 'TECH CITY',        subtitle: 'Gadgets & Upgrades',      cx: 560,  cy: 640,  tint: '#c3b7de', theme: 'tech' },
  { id: 'creator-studio',   name: 'CREATOR STUDIO',   subtitle: 'Build & Design',          cx: 1180, cy: 470,  tint: '#d6c9ea', theme: 'grass' },
  { id: 'game-arena',       name: 'GAME ARENA',       subtitle: 'Minigames & Challenges',  cx: 1840, cy: 470,  tint: '#bcd98f', theme: 'grass' },
  { id: 'treasure-island',  name: 'TREASURE ISLAND',  subtitle: 'Quests & Rewards',        cx: 2560, cy: 500,  tint: '#e3c68a', theme: 'sand' },
  { id: 'chill-beach',      name: 'CHILL BEACH',      subtitle: 'Relax & Hangout',         cx: 3260, cy: 700,  tint: '#f0dd95', theme: 'beach' },

  { id: 'space-station',    name: 'SPACE STATION',    subtitle: 'Explore & Discover',      cx: 380,  cy: 1360, tint: '#a89cd2', theme: 'space' },
  { id: 'arcade-alley',     name: 'ARCADE ALLEY',     subtitle: 'Classic Games',           cx: 1060, cy: 1120, tint: '#c7bce2', theme: 'grass' },
  { id: 'social-plaza',     name: 'SOCIAL PLAZA',     subtitle: 'Meet Friends',            cx: 2320, cy: 1040, tint: '#c3df9a', theme: 'grass' },
  { id: 'music-stage',      name: 'MUSIC STAGE',      subtitle: 'Listen & Play',           cx: 3120, cy: 1300, tint: '#d0b3e0', theme: 'grass' },
  { id: 'events-hub',       name: 'EVENTS HUB',       subtitle: 'Special Events',          cx: 3480, cy: 2000, tint: '#c1c9de', theme: 'grass' },

  { id: 'art-gallery',      name: 'ART GALLERY',      subtitle: 'Art & Collectibles',      cx: 430,  cy: 2080, tint: '#dbc7a6', theme: 'grass' },
  { id: 'farm-life',        name: 'FARM LIFE',        subtitle: 'Grow & Harvest',          cx: 1120, cy: 1820, tint: '#bcd98f', theme: 'farm' },
  { id: 'adventure-portal', name: 'ADVENTURE PORTAL', subtitle: 'New Worlds Await',        cx: 1900, cy: 1600, tint: '#c3df9a', theme: 'grass', labelDy: 210 },
  { id: 'sports-zone',      name: 'SPORTS ZONE',      subtitle: 'Play & Compete',          cx: 2620, cy: 1780, tint: '#bcd98f', theme: 'grass' },
  { id: 'movie-theater',    name: 'MOVIE THEATER',    subtitle: 'Watch Together',          cx: 3280, cy: 2120, tint: '#cbbde0', theme: 'grass' },

  { id: 'puzzle-land',      name: 'PUZZLE LAND',      subtitle: 'Mind Games',              cx: 660,  cy: 2760, tint: '#dac5a0', theme: 'grass' },
  { id: 'magic-forest',     name: 'MAGIC FOREST',     subtitle: 'Mystery & Secrets',       cx: 1400, cy: 2560, tint: '#b7d49a', theme: 'forest' },
  { id: 'future-lab',       name: 'FUTURE LAB',       subtitle: 'Innovation & Experiments', cx: 2160, cy: 2500, tint: '#cbbde4', theme: 'tech' },
  { id: 'vip-lounge',       name: 'VIP LOUNGE',       subtitle: 'Exclusive Perks',         cx: 2900, cy: 2680, tint: '#e6cf8f', theme: 'sand' },
]

// One big sandy landmass under all the zones, with corner bumps for an organic coast.
export const islandLobes = [
  { cx: 1920, cy: 1620, rx: 1880, ry: 1420 },
  { cx: 940,  cy: 780,  rx: 760,  ry: 600 },
  { cx: 3000, cy: 820,  rx: 760,  ry: 600 },
  { cx: 900,  cy: 2560, rx: 760,  ry: 600 },
  { cx: 3060, cy: 2520, rx: 760,  ry: 600 },
]

/** Decorative islets in the surrounding water. */
export const islets = [
  { cx: 220,  cy: 320,  r: 70 },
  { cx: 3720, cy: 380,  r: 60 },
  { cx: 180,  cy: 3000, r: 60 },
  { cx: 3760, cy: 3020, r: 70 },
]
