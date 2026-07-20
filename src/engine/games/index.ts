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
import { createOverhead } from './overhead'
import { createMail } from './mail'
import type { MailGame } from './mail'
import { initContactCard } from '../../ui/contactCard'
import { createCards } from './cards'
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
  mail = createMail(3050, 1690, () => card.show(), () => card.hide())
  return [
    mail,
    createChess(1000, 1050),
    createScrabble(1450, 2650),
    createShuffleboard(3400, 1800),
    createCards(4300, 1100),
    createDice(2650, 2700),
    createSpinner(4300, 2750),
    createTop(3550, 950),
    createTop(1500, 1700, GOLD),
    createTeeth(4250, 1900),
    createNotes(2250, 2050),
    createMagnifier(3000, 2350),
    // ambient cloud/bird shadows — draws only in drawAbove, so it shades every
    // game and prop; placed after the tops so shadows fall on standing pieces too
    createOverhead(),
    createBlocks(), // the hero title — drawn last, always on top of other games
  ]
}
