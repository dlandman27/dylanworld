// A little controls cheat-sheet that pops up while you're driving a car or
// flying the drone, so you always know the keys. Shown on hop-in, hidden on
// hop-out. Paper-card house style, pinned bottom-centre.

const STYLE = `
.dw-vhelp {
  position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%) translateY(140%);
  z-index: 32; display: flex; align-items: center; gap: 0.7rem;
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); box-shadow: 5px 5px 0 var(--ink, #201a17);
  border-radius: 14px; padding: 0.5rem 0.9rem;
  font-family: var(--font-body, 'Nunito', sans-serif); font-size: 0.82rem; font-weight: 700;
  transition: transform 0.22s ease; pointer-events: none; white-space: nowrap;
}
.dw-vhelp.open { transform: translateX(-50%) translateY(0); }
.dw-vhelp b { font-family: var(--font-display, sans-serif); font-size: 0.9rem; margin-right: 0.2rem; }
.dw-vhelp kbd {
  font-family: var(--font-mono, monospace); font-size: 0.72rem; font-weight: 700;
  background: var(--paper, #f5ecd6); border: 2px solid var(--ink, #201a17); border-radius: 6px;
  padding: 0.05rem 0.35rem; box-shadow: 2px 2px 0 var(--ink, #201a17);
}
`

const CONTENT: Record<'car' | 'drone', string> = {
  car: `<b>🏎️ Driving</b><span><kbd>WASD</kbd> steer · <kbd>Shift</kbd> nitro · <kbd>Esc</kbd> hop out</span>`,
  drone: `<b>🚁 Flying</b><span><kbd>WASD</kbd> move · <kbd>Space</kbd> up · <kbd>C</kbd> down · <kbd>Shift</kbd> boost · <kbd>G</kbd> grab · <kbd>Esc</kbd> land</span>`,
}

let panel: HTMLDivElement | null = null

function ensure(): void {
  if (panel) return
  const style = document.createElement('style'); style.textContent = STYLE; document.head.appendChild(style)
  panel = document.createElement('div'); panel.className = 'dw-vhelp'; document.body.appendChild(panel)
}

export function showVehicleHelp(kind: 'car' | 'drone'): void {
  ensure()
  panel!.innerHTML = CONTENT[kind]
  panel!.classList.add('open')
}
export function hideVehicleHelp(): void { panel?.classList.remove('open') }
