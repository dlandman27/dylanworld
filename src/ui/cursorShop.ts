import { CURSORS } from '../config/cursors'
import { cursorUrl, buyEquip, isOwned, equippedId, getWallet, onCursorChange } from '../engine/cursor'

// The Cursor Shop: browse hand-drawn cursors as wares and buy/equip them.
// Prices are 0 for now, so everything equips for free; the wallet + buy flow
// are real so pricing can switch on later.

const STYLE = `
.dw-shop-btn {
  position: fixed; left: 0.85rem; bottom: 0.85rem; z-index: 30;
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--card, #fefaf0); color: var(--ink, #201a17);
  border: 3px solid var(--ink, #201a17); box-shadow: 4px 4px 0 var(--ink, #201a17);
  border-radius: 12px; padding: 0.4rem 0.7rem; font-weight: 800;
  font-family: var(--font-display, 'Fredoka', sans-serif); font-size: 0.9rem; cursor: pointer;
}
.dw-shop-btn:hover { transform: translate(1px, 1px); box-shadow: 3px 3px 0 var(--ink, #201a17); }
.dw-shop-btn img { width: 22px; height: 22px; }
.dw-shop {
  position: fixed; left: 0.85rem; bottom: 4.2rem; z-index: 31;
  width: min(340px, calc(100vw - 1.7rem)); max-height: 68vh; overflow-y: auto;
  background: var(--card, #fefaf0); border: 3px solid var(--ink, #201a17);
  box-shadow: 6px 6px 0 var(--ink, #201a17); border-radius: 16px; padding: 1rem;
  display: none;
}
.dw-shop.open { display: block; }
.dw-shop-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.75rem; }
.dw-shop-head h3 { font-family: var(--font-display, sans-serif); font-size: 1.15rem; margin: 0; }
.dw-shop-coins { font-family: var(--font-mono, monospace); font-size: 0.8rem; font-weight: 700; }
.dw-shop-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
.dw-tile {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  background: var(--paper, #f5ecd6); border: 2.5px solid var(--ink, #201a17);
  border-radius: 12px; padding: 0.6rem 0.4rem; text-align: center;
}
.dw-tile.equipped { background: #fff2c6; }
.dw-tile img { width: 40px; height: 40px; image-rendering: pixelated; }
.dw-tile .name { font-family: var(--font-body, sans-serif); font-size: 0.72rem; font-weight: 700; line-height: 1.1; }
.dw-tile button {
  font-family: var(--font-display, sans-serif); font-weight: 800; font-size: 0.72rem;
  border: 2px solid var(--ink, #201a17); border-radius: 8px; padding: 0.2rem 0.55rem;
  background: var(--lime, #b7ce3c); color: var(--ink, #201a17); cursor: pointer;
}
.dw-tile button[disabled] { background: var(--card, #fefaf0); cursor: default; opacity: 0.9; }
.dw-tile button:not([disabled]):hover { background: var(--orange, #f47b28); }
`

export function initCursorShop(): void {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.className = 'dw-shop-btn'
  btn.innerHTML = `<img src="${cursorUrl(CURSORS[0], 32)}" alt=""> cursor shop`

  const panel = document.createElement('div')
  panel.className = 'dw-shop'
  panel.innerHTML = `
    <div class="dw-shop-head">
      <h3>Cursor Shop</h3>
      <span class="dw-shop-coins"></span>
    </div>
    <div class="dw-shop-grid"></div>`
  const grid = panel.querySelector('.dw-shop-grid') as HTMLDivElement
  const coinsEl = panel.querySelector('.dw-shop-coins') as HTMLSpanElement

  function render(): void {
    coinsEl.textContent = `${getWallet().coins} coins`
    grid.innerHTML = ''
    for (const cur of CURSORS) {
      const eq = equippedId() === cur.id
      const owned = isOwned(cur.id)
      const tile = document.createElement('div')
      tile.className = 'dw-tile' + (eq ? ' equipped' : '')
      const label = eq ? 'equipped' : owned ? 'equip' : cur.price === 0 ? 'free — get' : `${cur.price} coins`
      tile.innerHTML =
        `<img src="${cursorUrl(cur, 40)}" alt="${cur.name}">` +
        `<span class="name">${cur.name}</span>` +
        `<button ${eq ? 'disabled' : ''}>${label}</button>`
      const b = tile.querySelector('button') as HTMLButtonElement
      b.addEventListener('click', () => { buyEquip(cur.id) })
      grid.appendChild(tile)
    }
  }

  btn.addEventListener('click', () => panel.classList.toggle('open'))
  onCursorChange(render)
  render()

  document.body.appendChild(btn)
  document.body.appendChild(panel)
}
