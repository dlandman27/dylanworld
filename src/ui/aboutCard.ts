// The "About Me" card the desk laptop opens — Dylan's bio, education, and the
// toolbox (skills/tech-stack), pulled from config/story.ts. A single static card,
// sibling of the project / experience / contact cards.

import { story } from '../config/story'

const get = (id: string): { title: string; years?: string; body: string } =>
  story.find((s) => s.id === id) ?? { title: '', body: '' }

const STYLE = `
.dw-about-veil {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(32, 26, 23, 0.25);
  display: none; align-items: center; justify-content: center;
}
.dw-about-veil.open { display: flex; }
.dw-about-card {
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); border-radius: 16px;
  box-shadow: 8px 8px 0 var(--ink, #201a17);
  padding: 1.6rem 1.9rem 1.4rem; width: min(460px, calc(100vw - 2.5rem));
  max-height: calc(100vh - 3rem); overflow-y: auto;
  font-family: var(--font-body, 'Nunito', sans-serif);
  transform: rotate(-1deg);
}
.dw-about-card h2 {
  font-family: var(--font-display, 'Fredoka', sans-serif);
  margin: 0 0 0.2rem; font-size: 1.6rem; line-height: 1.1;
}
.dw-about-card .lede { margin: 0 0 1.1rem; font-size: 1rem; line-height: 1.5; }
.dw-about-sec { margin: 0 0 0.9rem; }
.dw-about-sec h3 {
  font-family: var(--font-display, 'Fredoka', sans-serif);
  margin: 0 0 0.15rem; font-size: 0.78rem; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--coral, #f0563e);
}
.dw-about-sec .row { display: flex; justify-content: space-between; gap: 0.6rem; align-items: baseline; }
.dw-about-sec .row .t { font-weight: 800; font-size: 0.98rem; }
.dw-about-sec .row .y { font-family: var(--font-mono, monospace); font-size: 0.72rem; opacity: 0.7; }
.dw-about-sec p { margin: 0.1rem 0 0; font-size: 0.92rem; line-height: 1.4; }
.dw-about-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
.dw-about-chips span {
  font-size: 0.76rem; font-weight: 700; padding: 0.15rem 0.5rem;
  background: #efe4c4; border: 2px solid var(--ink, #201a17); border-radius: 999px;
}
.dw-about-close {
  margin-top: 0.6rem; width: 100%;
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.95rem;
  background: var(--coral, #f0563e); color: #fff;
  border: 2.5px solid var(--ink, #201a17); border-radius: 10px;
  padding: 0.5rem; cursor: pointer; box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-about-close:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
`

export interface AboutCard { show: () => void; hide: () => void }

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function initAboutCard(onDismiss: () => void): AboutCard {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const veil = document.createElement('div')
  veil.className = 'dw-about-veil'
  document.body.appendChild(veil)

  const hide = (): void => { veil.classList.remove('open'); onDismiss() }

  const bio = get('bio'), edu = get('umass'), tools = get('skills'), place = get('hoboken')
  const chips = tools.body.split(/,\s*|\.\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 12)

  veil.innerHTML = `
    <div class="dw-about-card" role="dialog" aria-label="About Dylan">
      <h2>${esc(bio.title)}</h2>
      <p class="lede">${esc(bio.body)}</p>
      <div class="dw-about-sec">
        <h3>Education</h3>
        <div class="row"><span class="t">${esc(edu.title)}</span><span class="y">${esc(edu.years ?? '')}</span></div>
        <p>${esc(edu.body)}</p>
      </div>
      <div class="dw-about-sec">
        <h3>Toolbox</h3>
        <div class="dw-about-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      </div>
      <div class="dw-about-sec">
        <h3>Based in</h3>
        <div class="row"><span class="t">${esc(place.title)}</span></div>
        <p>${esc(place.body)}</p>
      </div>
      <button class="dw-about-close">close the laptop</button>
    </div>`
  veil.querySelector('.dw-about-close')!.addEventListener('click', hide)

  veil.addEventListener('pointerdown', (ev) => { if (ev.target === veil) hide() })
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && veil.classList.contains('open')) hide() })

  return {
    show: () => veil.classList.add('open'),
    hide: () => veil.classList.remove('open'),
  }
}
