import type { ProjectEntry } from '../types'

export const projects: ProjectEntry[] = [
  {
    id: 'rsotw',
    title: 'Random Sites On The Web!',
    tags: ['website', 'playground'],
    blurb: 'A growing collection of random sites I build — some useful, most just fun to poke at. The spiritual parent of the world you are standing in.',
    links: [{ label: 'Visit', url: 'https://randomsitesontheweb.com' }],
  },
  {
    id: 'playbook-raise',
    title: 'Playbook Raise',
    tags: ['work', 'fundraising'],
    blurb: 'A fundraising platform helping kids raise money for their teams and win prizes — over $2 million raised.',
    links: [{ label: 'Visit', url: 'https://playbookraise.com' }],
  },
  {
    id: 'playbook-sports',
    title: 'Playbook Sports',
    tags: ['work', 'saas'],
    blurb: 'The sports SaaS where I work — helping teams and organizations run their sports programs.',
    links: [{ label: 'Visit', url: 'https://callplaybook.com' }],
  },
  {
    id: 'takeoff',
    title: 'Takeoff Esports',
    tags: ['website', 'esports'],
    blurb: 'Site for a professional esports org and clothing company building a community of gamers, creators, and fans.',
    links: [{ label: 'Visit', url: 'https://takeoffgg.com' }],
  },
  {
    id: 'pixel-portfolio',
    title: 'Pixel Portfolio',
    tags: ['website', 'awwwards honorable mention'],
    blurb: 'My previous previous portfolio — a Pokémon-style pixel map you travel around. Earned an Awwwards Honorable Mention. dylanworld is its bigger sibling.',
    links: [{ label: 'Visit', url: 'https://dlandman27.github.io/pixel-portfolio' }],
  },
  {
    id: 'colorle',
    title: 'Colorle',
    tags: ['game', 'rsotw'],
    blurb: 'Wordle, but you guess the RGB of a color. Harder than it sounds.',
    links: [{ label: 'Play', url: 'https://randomsitesontheweb.com/sites/colorle/' }],
  },
  {
    id: 'fractal',
    title: 'Tailwind CSS Fractal',
    tags: ['toy', 'rsotw'],
    blurb: 'A fractal color-scheme explorer — experiment with palettes and watch them bloom.',
    links: [{ label: 'Play', url: 'https://randomsitesontheweb.com/sites/fractal/' }],
  },
  {
    id: 'randomphotos',
    title: 'Picsum Photo River',
    tags: ['tool', 'rsotw'],
    blurb: 'Endless scroll of every Picsum stock photo; click to copy a URL for your own site.',
    links: [{ label: 'Visit', url: 'https://randomsitesontheweb.com/sites/randomphotos/' }],
  },
  {
    id: 'wiigit',
    title: 'Wiigit',
    tags: ['mobile app', 'passion project'],
    blurb: 'A mobile productivity app helping people build better habits with insights on focus and progress over time.',
    links: [],
  },
  {
    id: 'virtual-classroom',
    title: 'Reimagining the Virtual Classroom',
    tags: ['research', 'published'],
    blurb: 'Published ACM research on making virtual classrooms more engaging — better student-teacher interaction inspired by what physical classrooms get right.',
    links: [{ label: 'Read the paper', url: 'https://dl.acm.org/doi/abs/10.1145/3591196.3596617' }],
  },
]
