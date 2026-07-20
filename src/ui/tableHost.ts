import { hostRoom, netConnected, roomCode, peers, myName } from '../engine/net'

// The "host a table" chip (top-right). Not connected: click hosts a room and
// copies the invite link. Connected: shows the room code + live headcount;
// click re-copies the link.

const STYLE = `
.dw-host {
  position: fixed; top: 0.85rem; right: 0.85rem; z-index: 30;
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); box-shadow: 4px 4px 0 var(--ink, #201a17);
  border-radius: 12px; padding: 0.45rem 0.75rem; cursor: pointer;
  font-family: var(--font-display, 'Fredoka', sans-serif); font-weight: 800; font-size: 0.9rem;
}
.dw-host:hover { transform: translate(1px, 1px); box-shadow: 3px 3px 0 var(--ink, #201a17); }
.dw-host .code { font-family: var(--font-mono, monospace); background: var(--paper, #f5ecd6);
  border: 2px solid var(--ink, #201a17); border-radius: 6px; padding: 0.05rem 0.4rem; }
.dw-host .flash { color: var(--teal, #2fb0a3); }
`

export function initTableHost(): void {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.className = 'dw-host'
  document.body.appendChild(btn)

  let flashUntil = 0

  const copyInvite = (): void => {
    navigator.clipboard?.writeText(location.href).catch(() => { /* http fallback: none */ })
    flashUntil = performance.now() + 1500
  }

  btn.addEventListener('click', () => {
    if (!netConnected()) hostRoom()
    copyInvite()
  })

  const render = (): void => {
    if (!netConnected()) {
      btn.innerHTML = 'host a table'
    } else {
      const n = peers().size + 1
      const label = performance.now() < flashUntil
        ? '<span class="flash">link copied</span>'
        : `${n} at the table`
      const safeCode = (roomCode() ?? '').replace(/[^A-Z0-9]/gi, '')
      btn.innerHTML = `<span class="code">${safeCode}</span> ${label}`
      btn.title = `you are "${myName()}" — click to copy the invite link`
    }
    setTimeout(render, 500)
  }
  render()
}
