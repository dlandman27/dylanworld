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
// import { createBasketball } from './basketball'
import { createDrone } from './drone' // parked — module kept
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
import type { BookshelfGame } from './bookshelf'
import { createTv } from './tv'
import { initProjectCard } from '../../ui/projectCard'
import { createGallery } from './gallery'
import type { GalleryGame } from './gallery'
import { initExperienceCard } from '../../ui/experienceCard'
import { createDresser } from './dresser'
import { createToyChest } from './toychest'
import { createPlant } from './plant'
// Dominoes are parked for now — module kept, re-register to bring them back.
// import { createDominoes } from './dominoes'

import type { Prop } from '../../types'
export type { TableGame } from './shared'

// Every game on the table. Draw order = array order; pointer hit-testing runs in
// REVERSE (topmost first). New games: create src/engine/games/<name>.ts with the
// TableGame interface and register it here — see .claude/skills/new-game.
export function createGames(props: Prop[]): TableGame[] {
  // the envelope opens the contact card; dismissing the card closes the envelope
  let mail: MailGame | null = null
  const card = initContactCard(() => mail?.close())
  mail = createMail(3750, 2630, () => card.show(), () => card.hide())
  // the bookshelf pulls a book out to open its project card; dismissing the card
  // (or pressing the book again) shelves it
  let shelf: BookshelfGame | null = null
  const projCard = initProjectCard(() => shelf?.closeBook())
  shelf = createBookshelf(4700, 210, (p) => projCard.show(p), () => projCard.hide())
  const tv = createTv(5620, 290)   // the rsotw CRT, back against the top wall
  // the career gallery on the west wall: press a framed job to open its card
  let gallery: GalleryGame | null = null
  const expCard = initExperienceCard(() => gallery?.closeFrame())
  gallery = createGallery((e) => expCard.show(e), () => expCard.hide())
  return [
    // bedroom furniture — drawn FIRST so every game piece sits on top of it;
    // hit-testing runs in reverse, so games and props win contested presses
    createBed(5900, 2350),   // head rail sits ON the east wall seam (6600)
    createDesk(2900, 4350),
    shelf,
    tv,
    gallery,
    createDresser(250, 1500),
    createToyChest(800, 4260),
    createPlant(6330, 320),
    mail,
    // 🎲 board-game corner — clustered on the game rug (lower-left)
    createChess(750, 2680),
    createScrabble(820, 3520),
    createCards(1860, 2700),
    createDice(1310, 3110),
    createBackgammon(1860, 3500),
    createShuffleboard(6150, 3750),   // bottom-right
    createSpinner(5000, 3690),
    createTop(4250, 1890),
    createTop(2200, 2640, GOLD),
    createTeeth(4950, 2840),
    createNotes(2500, 4300),   // sitting on the desk (left of the laptop)
    createEasyButton(5400, 4190),
    createIpad(5650, 2300),   // sitting on the bed
    // createBasketball(6100, 3350), // parked — the sports corner, hidden for now
    // createSandbox(1520, 3960), // parked — hidden for now
    // createSoccer(), // parked — bring back when the table's bigger
    createHotwheels(),
    createDrone(3300, 1450, props),   // 🚁 RC quadcopter on its helipad (upper-centre)
    // ambient cloud/bird shadows — draws only in drawAbove, so it shades every
    // game and prop; placed after the tops so shadows fall on standing pieces too
    createOverhead(),
    createBlocks(), // the hero title — drawn last, always on top of other games
    createFly(), createFly(), // a couple of ambient houseflies (more reads as "dirty")
    // createSwatter(2800, 2490), // parked — grab it and whack them
    // magnifier LAST so its lens covers the flies (and magnifies them — try it)
    createMagnifier(4150, 2720),   // moved into the spot the shuffleboard vacated
  ]
}
