// Random Sites On The Web — the full site list, pulled from
// randomsitesontheweb.com/sitemap.xml. The CRT telly channel-surfs through
// these: spin the channel knob to land on a random site, click to visit it.

export const RSOTW_BASE = 'https://randomsitesontheweb.com'

export const rsotwSites: string[] = [
  '5oclock', 'affirmations', 'asciikeyboard', 'bad-art-museum', 'balancethestick',
  'binary-sudoku', 'binaryticker', 'birthdaycolor', 'board-game-generator',
  'brainrotengine', 'breathe', 'bubblewrap', 'camouflage', 'canttouchme',
  'chaosgame', 'charactercounter', 'chatgptwithanattitude', 'checkboxgrid',
  'chess-art', 'chicanery', 'christmaseve', 'clap-o-meter', 'coastline', 'colorle',
  'colortheory', 'comicmoves', 'confession', 'coolloaders', 'countasecond',
  'csstest', 'cursors', 'dailydoodle', 'do-you-like-me', 'dontpressthebutton',
  'doomscroll', 'drips', 'dummyfactory', 'duplicate', 'dvd', 'emojiprophunt',
  'eyesonme', 'fairdie', 'fallingkeys', 'fireflies', 'fontninja', 'fractal',
  'growyourgarden', 'happybirthday', 'hatchtheegg', 'hearingtest', 'horoscope',
  'howlonghaveyoubeenstaring', 'howmany', 'im-sorry', 'infinitemaze',
  'infinitenumbercasino', 'infinitepainting', 'infinitetictactoe', 'inkdrop',
  'interdimensionaldvr', 'kaleidoscope', 'largestnumber', 'leapyear',
  'library-of-everything', 'linguisticanomolies', 'localstorage-terminal', 'lyrics',
  'magic8ball', 'magicnumber', 'marble-race', 'meme-soundboard', 'metadata',
  'metronome', 'mirror', 'morse-code', 'murmuration', 'nameashape', 'namesinahat',
  'nicecursor', 'noise-machine', 'onhold', 'paint-by-number', 'parallel_lines',
  'passwordgenerator', 'passwordSecurity', 'perfectcircle', 'pi', 'piano', 'pong',
  'prefixsuffix', 'psychadelics', 'punctuation-cemetery', 'puzzle', 'quietest',
  'randomcolor', 'randomphotos', 'reactiontime', 'redlightgreenlight',
  'roman-numerals', 'rothkomachine', 'rubegoldberg', 'ruler', 'scoreboard',
  'scrollympics', 'severancedance', 'shakespeareinsultmaker', 'shapematch',
  'slot-machine', 'slowtv', 'snake', 'spinthebottle', 'static', 'tessellation',
  'the-last-time', 'thelastsurvivors', 'themap', 'thousandballs', 'timemeters',
  'timezones', 'todo', 'translatetolegalese', 'triangle', 'unmotivationalquotes',
  'visitcounter', 'weaver', 'welcomeback', 'wetpaint', 'what-to-do',
  'whatsmyresolution', 'wow', 'wreckroom', 'writemeastory', 'youarebeingwatched',
  'yourphonehasacrackinit',
]

/** Pretty label for a slug: 'morse-code' → 'Morse Code'. */
export const rsotwName = (slug: string): string =>
  slug.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (m) => m.toUpperCase())

export const rsotwUrl = (slug: string): string => `${RSOTW_BASE}/${slug}/`
