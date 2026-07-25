import { CURSORS } from '../config/cursors'
import { cursorUrl, equipCursor, equippedId, onCursorChange } from '../engine/cursor'

// The cursor drawer: browse the hand-drawn cursors and click one to equip it.
// It's opened by pulling the dresser's middle drawer — no button, no economy,
// every cursor is free. (The panel keeps the class `dw-shop` so the equipped
// custom cursor still shows while hovering it.)

const STYLE = `
.dw-shop {
  position: fixed; left: 0.85rem; bottom: 0.85rem; z-index: 31;
  width: min(390px, calc(100vw - 1.7rem)); max-height: 74vh; overflow-y: auto;
  background: var(--card, #fefaf0); border: 3px solid var(--ink, #201a17);
  box-shadow: 6px 6px 0 var(--ink, #201a17); border-radius: 16px; padding: 1rem;
  display: none;
}
.dw-shop.open { display: block; }
.dw-shop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.dw-shop-head h3 { font-family: var(--font-display, sans-serif); font-size: 1.15rem; margin: 0; }
.dw-shop-close {
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.9rem;
  border: 2.5px solid var(--ink, #201a17); border-radius: 8px; padding: 0.15rem 0.5rem;
  background: var(--coral, #f0563e); color: #fff; cursor: pointer;
  box-shadow: 2px 2px 0 var(--ink, #201a17);
}
.dw-shop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.55rem; }
.dw-tile {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  background: var(--paper, #f5ecd6); border: 2.5px solid var(--ink, #201a17);
  border-radius: 12px; padding: 0.6rem 0.4rem; text-align: center; cursor: pointer;
  box-shadow: 3px 3px 0 var(--ink, #201a17);
}
.dw-tile:hover { transform: translate(1px, 1px); box-shadow: 2px 2px 0 var(--ink, #201a17); }
.dw-tile.equipped { background: #fff2c6; }
.dw-tile img { width: 40px; height: 40px; image-rendering: pixelated; }
.dw-tile .name { font-family: var(--font-body, sans-serif); font-size: 0.72rem; font-weight: 700; line-height: 1.1; }
.dw-tile .tag {
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.66rem;
  text-transform: uppercase; letter-spacing: 0.03em; opacity: 0.55;
}
.dw-tile.equipped .tag { opacity: 1; color: var(--orange, #f47b28); }
`

let panel: HTMLDivElement | null = null

export function initCursorShop(): void {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  panel = document.createElement('div')
  panel.className = 'dw-shop'
  panel.innerHTML = `
    <div class="dw-shop-head">
      <h3>Pick a cursor</h3>
      <button class="dw-shop-close">done</button>
    </div>
    <div class="dw-shop-grid"></div>`
  const grid = panel.querySelector('.dw-shop-grid') as HTMLDivElement

  function render(): void {
    grid.innerHTML = ''
    for (const cur of CURSORS) {
      const eq = equippedId() === cur.id
      const tile = document.createElement('button')
      tile.className = 'dw-tile' + (eq ? ' equipped' : '')
      tile.innerHTML =
        `<img src="${cursorUrl(cur, 40)}" alt="${cur.name}">` +
        `<span class="name">${cur.name}</span>` +
        `<span class="tag">${eq ? 'equipped' : 'equip'}</span>`
      tile.addEventListener('click', () => equipCursor(cur.id))
      grid.appendChild(tile)
    }
  }

  panel.querySelector('.dw-shop-close')!.addEventListener('click', () => setCursorShopOpen(false))
  onCursorChange(render)
  render()
  document.body.appendChild(panel)

  // tap anywhere off the panel to close it — but not the dresser press that just
  // opened it (that fires on the same pointerdown, moments before this)
  document.addEventListener('pointerdown', (e) => {
    if (!isCursorShopOpen()) return
    if (panel && panel.contains(e.target as Node)) return
    if (performance.now() - lastDresserToggle < 80) return
    setCursorShopOpen(false)
  })
}

let lastDresserToggle = -1
/** The dresser calls this when its drawer toggles the shop, so the tap-off
 * handler doesn't immediately re-close what the drawer just opened. */
export function notifyDresserToggle(): void { lastDresserToggle = performance.now() }

export function setCursorShopOpen(open: boolean): void { panel?.classList.toggle('open', open) }
export function isCursorShopOpen(): boolean { return !!panel?.classList.contains('open') }
export function toggleCursorShop(): boolean {
  const open = !isCursorShopOpen()
  setCursorShopOpen(open)
  return open
}
