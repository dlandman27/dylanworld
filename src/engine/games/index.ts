import type { TableGame } from './shared'
import { createBlocks } from './blocks'
import { createChess } from './chess'
import { createScrabble } from './scrabble'
import { createShuffleboard } from './shuffleboard'
import { createDice } from './dice'
import { createSpinner } from './spinner'
import { createTop, GOLD } from './top'
import { createTeeth } from './teeth'
import { createNotes } from './notes'
import { createMagnifier } from './magnifier'
import { createHotwheels } from './hotwheels'
import { createEasyButton } from './easybutton'
import { createBackgammon } from './backgammon'
import { createIpad } from './ipad'
// import { createSandbox } from './sandbox' // parked — re-enable in createGames too
// import { createSoccer } from './soccer' // parked — re-enable in createGames too
import { createOverhead } from './overhead'
import { createFly } from './fly'
// import { createSwatter } from './swatter' // parked — re-enable in createGames too
import { createMail } from './mail'
import type { MailGame } from './mail'
import { initContactCard } from '../../ui/contactCard'
import { createCards } from './cards'
import { createBed } from './bed'
import { createDesk } from './desk'
import { createBookshelf } from './bookshelf'
import { createDresser } from './dresser'
import { createToyChest } from './toychest'
import { createPlant } from './plant'
// Dominoes are parked for now — module kept, re-register to bring them back.
// import { createDominoes } from './dominoes'

export type { TableGame } from './shared'

// Every game on the table. Draw order = array order; pointer hit-testing runs in
// REVERSE (topmost first). New games: create src/engine/games/<name>.ts with the
// TableGame interface and register it here — see .claude/skills/new-game.
export function createGames(): TableGame[] {
  // the envelope opens the contact card; dismissing the card closes the envelope
  let mail: MailGame | null = null
  const card = initContactCard(() => mail?.close())
  mail = createMail(3750, 2630, () => card.show(), () => card.hide())
  return [
    // bedroom furniture — drawn FIRST so every game piece sits on top of it;
    // hit-testing runs in reverse, so games and props win contested presses
    createBed(5900, 2350),   // head rail sits ON the east wall seam (6600)
    createDesk(2900, 4350),
    createBookshelf(4700, 210),
    createDresser(250, 1500),
    createToyChest(800, 4260),
    createPlant(6330, 320),
    mail,
    createChess(1700, 1990),
    createScrabble(2150, 3590),
    createShuffleboard(4100, 2740),
    createCards(5000, 2040),
    createDice(3350, 3640),
    createSpinner(5000, 3690),
    createTop(4250, 1890),
    createTop(2200, 2640, GOLD),
    createTeeth(4950, 2840),
    createNotes(2950, 2990),
    createEasyButton(5400, 4190),
    createBackgammon(4200, 4090),
    createIpad(5350, 1590),
    // createSandbox(1520, 3960), // parked — hidden for now
    // createSoccer(), // parked — bring back when the table's bigger
    createHotwheels(),
    // ambient cloud/bird shadows — draws only in drawAbove, so it shades every
    // game and prop; placed after the tops so shadows fall on standing pieces too
    createOverhead(),
    createBlocks(), // the hero title — drawn last, always on top of other games
    createFly(), createFly(), // a couple of ambient houseflies (more reads as "dirty")
    // createSwatter(2800, 2490), // parked — grab it and whack them
    // magnifier LAST so its lens covers the flies (and magnifies them — try it)
    createMagnifier(3000, 2350),
  ]
}
