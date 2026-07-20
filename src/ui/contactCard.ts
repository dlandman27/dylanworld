// The contact card that pops out of the envelope on the table — a paper card
// with real, clickable links. Dismissing it tells the envelope to close.

const STYLE = `
.dw-mail-veil {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(32, 26, 23, 0.25);
  display: none; align-items: center; justify-content: center;
}
.dw-mail-veil.open { display: flex; }
.dw-mail-card {
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); border-radius: 16px;
  box-shadow: 8px 8px 0 var(--ink, #201a17);
  padding: 1.6rem 2rem 1.4rem; width: min(400px, calc(100vw - 2.5rem));
  font-family: var(--font-body, 'Nunito', sans-serif);
  transform: rotate(-1deg);
}
.dw-mail-head { display: flex; align-items: center; gap: 0.9rem; margin-bottom: 0.85rem; }
.dw-mail-head img {
  width: 64px; height: 64px; image-rendering: pixelated;
  background: var(--paper, #f5ecd6);
  border: 2.5px solid var(--ink, #201a17); border-radius: 12px;
  box-shadow: 3px 3px 0 var(--ink, #201a17);
  transform: rotate(2deg);
}
.dw-mail-card h2 {
  font-family: var(--font-display, 'Fredoka', sans-serif);
  margin: 0; font-size: 1.6rem;
}
.dw-mail-card .sub { margin: 0 0 1rem; font-size: 0.92rem; opacity: 0.75; }
.dw-mail-links { display: flex; flex-direction: column; gap: 0.6rem; }
.dw-mail-links a {
  display: flex; align-items: center; gap: 0.65rem;
  text-decoration: none; color: var(--ink, #201a17); font-weight: 800;
  background: var(--paper, #f5ecd6); border: 2.5px solid var(--ink, #201a17);
  border-radius: 10px; padding: 0.55rem 0.8rem;
  box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-mail-links a:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
.dw-mail-links svg {
  width: 22px; height: 22px; flex: none;
  fill: var(--ink, #201a17);
}
.dw-mail-close {
  margin-top: 1.1rem; width: 100%;
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.95rem;
  background: var(--coral, #f0563e); color: #fff;
  border: 2.5px solid var(--ink, #201a17); border-radius: 10px;
  padding: 0.5rem; cursor: pointer; box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-mail-close:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
`

export interface ContactCard { show: () => void; hide: () => void }

export function initContactCard(onDismiss: () => void): ContactCard {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const veil = document.createElement('div')
  veil.className = 'dw-mail-veil'
  veil.innerHTML = `
    <div class="dw-mail-card" role="dialog" aria-label="Contact Dylan">
      <div class="dw-mail-head">
        <img src="/dylan-avatar.png" alt="Pixel-art Dylan">
        <h2>Hi, I'm Dylan</h2>
      </div>
      <p class="sub">Software developer in Jersey City, NJ. This table is my portfolio — thanks for playing on it.</p>
      <div class="dw-mail-links">
        <a href="mailto:dylandman287@gmail.com">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h17A1.5 1.5 0 0 1 22 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5v-13Zm2.2.5 7.2 6.1c.35.3.85.3 1.2 0L19.8 6H4.2ZM20 8.3l-6.1 5.2a2.9 2.9 0 0 1-3.8 0L4 8.3V18h16V8.3Z"/></svg>
          dylandman287@gmail.com</a>
        <a href="https://github.com/dlandman27" target="_blank" rel="noopener">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
          dlandman27</a>
        <a href="https://www.linkedin.com/in/dylanlandman" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0Z"/></svg>
          dylanlandman</a>
      </div>
      <button class="dw-mail-close">tuck the letter back in</button>
    </div>`

  const hide = (): void => {
    veil.classList.remove('open')
    onDismiss()
  }
  veil.addEventListener('pointerdown', (e) => {
    if (e.target === veil) hide() // click the dim = close
  })
  veil.querySelector('.dw-mail-close')!.addEventListener('click', hide)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && veil.classList.contains('open')) hide()
  })
  document.body.appendChild(veil)

  return {
    show: () => veil.classList.add('open'),
    hide: () => veil.classList.remove('open'),
  }
}
