// The project card that pops open when you pull a book off the shelf — a paper
// card with the project's blurb, tags, and real links. Dismissing it tells the
// bookshelf to slide the book home. One card, reused for whichever book is
// pulled. Modeled on the contact card so the two feel like siblings.

import type { ProjectEntry } from '../types'

const STYLE = `
.dw-proj-veil {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(32, 26, 23, 0.25);
  display: none; align-items: center; justify-content: center;
}
.dw-proj-veil.open { display: flex; }
.dw-proj-card {
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); border-radius: 16px;
  box-shadow: 8px 8px 0 var(--ink, #201a17);
  padding: 1.6rem 2rem 1.4rem; width: min(440px, calc(100vw - 2.5rem));
  font-family: var(--font-body, 'Nunito', sans-serif);
  transform: rotate(-1deg);
}
.dw-proj-card h2 {
  font-family: var(--font-display, 'Fredoka', sans-serif);
  margin: 0 0 0.5rem; font-size: 1.65rem; line-height: 1.1;
}
.dw-proj-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.9rem; }
.dw-proj-tags span {
  font-family: var(--font-mono, monospace); font-size: 0.68rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em;
  background: var(--paper, #f5ecd6); border: 2px solid var(--ink, #201a17);
  border-radius: 999px; padding: 0.12rem 0.55rem;
}
.dw-proj-card .blurb { margin: 0 0 1rem; font-size: 0.98rem; line-height: 1.45; }
.dw-proj-links { display: flex; flex-direction: column; gap: 0.6rem; }
.dw-proj-links a {
  display: flex; align-items: center; gap: 0.5rem;
  text-decoration: none; color: var(--ink, #201a17); font-weight: 800;
  background: var(--paper, #f5ecd6); border: 2.5px solid var(--ink, #201a17);
  border-radius: 10px; padding: 0.55rem 0.8rem;
  box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-proj-links a::after { content: ' \\2197'; margin-left: auto; opacity: 0.6; }
.dw-proj-links a:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
.dw-proj-close {
  margin-top: 1.1rem; width: 100%;
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.95rem;
  background: var(--coral, #f0563e); color: #fff;
  border: 2.5px solid var(--ink, #201a17); border-radius: 10px;
  padding: 0.5rem; cursor: pointer; box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-proj-close:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
`

export interface ProjectCard {
  show: (p: ProjectEntry) => void
  hide: () => void
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function initProjectCard(onDismiss: () => void): ProjectCard {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const veil = document.createElement('div')
  veil.className = 'dw-proj-veil'
  document.body.appendChild(veil)

  const hide = (): void => {
    veil.classList.remove('open')
    onDismiss()
  }

  const render = (p: ProjectEntry): void => {
    const tags = p.tags.map((t) => `<span>${esc(t)}</span>`).join('')
    const links = p.links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join('')
    veil.innerHTML = `
      <div class="dw-proj-card" role="dialog" aria-label="${esc(p.title)}">
        <h2>${esc(p.title)}</h2>
        <div class="dw-proj-tags">${tags}</div>
        <p class="blurb">${esc(p.blurb)}</p>
        ${links ? `<div class="dw-proj-links">${links}</div>` : ''}
        <button class="dw-proj-close">shelve it</button>
      </div>`
    veil.querySelector('.dw-proj-close')!.addEventListener('click', hide)
  }

  veil.addEventListener('pointerdown', (e) => {
    if (e.target === veil) hide() // click the dim = close
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && veil.classList.contains('open')) hide()
  })

  return {
    show: (p: ProjectEntry) => {
      render(p)
      veil.classList.add('open')
    },
    hide: () => veil.classList.remove('open'),
  }
}
