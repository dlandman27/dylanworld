import type { ExperienceEntry } from '../types'

// Dylan's work history, hung as a gallery of framed photos on the WEST wall,
// above the dresser. Each frame shows a logo/initial tile; pressing it opens a
// card with the role, dates, and what he did. Newest first (top of the wall).
//
// To use real logos: drop a PNG in  public/logos/<file>.png  and set `logo`.
// Until it loads, a colored tile with the company's initial is drawn instead —
// so this always works with no assets.

export const experience: ExperienceEntry[] = [
  {
    id: 'chalkboard',
    company: 'Chalkboard',
    role: 'Senior Software Engineer',
    years: '2025 — present',
    location: 'New York, NY',
    blurb: 'Building a daily fantasy sports app. Joined as a Software Engineer and promoted to Senior — React Native front to back-end.',
    color: '#f0563e',
    logo: '/logos/chalkboard.png',
  },
  {
    id: 'playbook',
    company: 'Playbook Sports',
    role: 'Full Stack Developer',
    years: '2023 — 2025',
    location: 'Hoboken, NJ',
    blurb: 'Built the sports SaaS platform and Playbook Raise, a fundraising product that has raised $2M+ for kids\' teams.',
    color: '#5aa0db',
    mat: '#ffffff',
    logo: '/logos/playbook.png',
  },
  {
    id: 'partnercare',
    company: 'Primary PartnerCare',
    role: 'Software Engineer Intern',
    years: 'Summer 2022',
    location: 'Remote',
    blurb: 'Summer internship on the data side — data science and Microsoft SQL Server analytics work.',
    color: '#b7ce3c',
    mat: '#ffffff',
    logo: '/logos/partnercare.png',
  },
  {
    id: 'mm-social',
    company: 'M&M Social Media',
    role: 'Intern',
    years: '2019 — 2020',
    blurb: 'The early days: social media, marketing, and web/design work — where the building habit started.',
    color: '#2099d6',
    mat: '#2099d6',
    logo: '/logos/mm-social.png',
  },
]
