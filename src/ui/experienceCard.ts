// The card that pops open when you press a framed photo on the career wall — a
// paper card with the role, dates, place, and what Dylan did there. One card,
// reused for whichever frame is pressed. Sibling of the project + contact cards.

import type { ExperienceEntry } from '../types'

const STYLE = `
.dw-exp-veil {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(32, 26, 23, 0.25);
  display: none; align-items: center; justify-content: center;
}
.dw-exp-veil.open { display: flex; }
.dw-exp-card {
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); border-radius: 16px;
  box-shadow: 8px 8px 0 var(--ink, #201a17);
  padding: 1.5rem 1.9rem 1.3rem; width: min(420px, calc(100vw - 2.5rem));
  font-family: var(--font-body, 'Nunito', sans-serif);
  transform: rotate(-1deg);
}
.dw-exp-head { display: flex; align-items: center; gap: 0.9rem; margin-bottom: 0.9rem; }
.dw-exp-badge {
  width: 58px; height: 58px; flex: none;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-display, 'Fredoka', sans-serif); font-weight: 700;
  font-size: 1.7rem; color: #fff;
  border: 2.5px solid var(--ink, #201a17); border-radius: 12px;
  box-shadow: 3px 3px 0 var(--ink, #201a17); transform: rotate(2deg);
  overflow: hidden;
}
.dw-exp-badge img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dw-exp-head h2 {
  font-family: var(--font-display, 'Fredoka', sans-serif);
  margin: 0; font-size: 1.4rem; line-height: 1.1;
}
.dw-exp-head .role { margin: 0.15rem 0 0; font-weight: 800; font-size: 0.95rem; }
.dw-exp-head .meta {
  margin: 0.1rem 0 0; font-family: var(--font-mono, monospace);
  font-size: 0.72rem; opacity: 0.7;
}
.dw-exp-card .blurb { margin: 0 0 0.4rem; font-size: 0.98rem; line-height: 1.45; }
.dw-exp-close {
  margin-top: 1.1rem; width: 100%;
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.95rem;
  background: var(--coral, #f0563e); color: #fff;
  border: 2.5px solid var(--ink, #201a17); border-radius: 10px;
  padding: 0.5rem; cursor: pointer; box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-exp-close:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
`

export interface ExperienceCard {
  show: (e: ExperienceEntry) => void
  hide: () => void
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function initExperienceCard(onDismiss: () => void): ExperienceCard {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const veil = document.createElement('div')
  veil.className = 'dw-exp-veil'
  document.body.appendChild(veil)

  const hide = (): void => {
    veil.classList.remove('open')
    onDismiss()
  }

  const render = (e: ExperienceEntry): void => {
    const meta = [e.years, e.location].filter(Boolean).join(' · ')
    const badge = e.logo
      ? `<div class="dw-exp-badge" style="background:${esc(e.mat ?? '#ffffff')}"><img src="${esc(e.logo)}" alt="${esc(e.company)} logo"></div>`
      : `<div class="dw-exp-badge" style="background:${esc(e.color)}">${esc(e.company[0])}</div>`
    veil.innerHTML = `
      <div class="dw-exp-card" role="dialog" aria-label="${esc(e.company)}">
        <div class="dw-exp-head">
          ${badge}
          <div>
            <h2>${esc(e.company)}</h2>
            <p class="role">${esc(e.role)}</p>
            <p class="meta">${esc(meta)}</p>
          </div>
        </div>
        <p class="blurb">${esc(e.blurb)}</p>
        <button class="dw-exp-close">back to the wall</button>
      </div>`
    veil.querySelector('.dw-exp-close')!.addEventListener('click', hide)
  }

  veil.addEventListener('pointerdown', (ev) => {
    if (ev.target === veil) hide() // click the dim = close
  })
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && veil.classList.contains('open')) hide()
  })

  return {
    show: (e: ExperienceEntry) => {
      render(e)
      veil.classList.add('open')
    },
    hide: () => veil.classList.remove('open'),
  }
}
