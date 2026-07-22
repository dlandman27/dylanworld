# TODO

## Multiplayer — PartyKit
Host a table, friends join via room link (`?room=XXXX`), play together.
- [x] Deploy the site — LIVE at https://dylanworld-alpha.vercel.app (2026-07-20)
- [x] Party server LIVE (2026-07-20) — Cloudflare Durable Object via partyserver
      at dylanworld-party.dylan-944.workers.dev (partykit.dev hosted platform is
      dead; ported). Abuse limits: 32 conns/table, 1KB msgs, 30/s rate.
- [x] Phase 1 — presence SHIPPED: host-a-table chip, `?room=` links, ghost
      cursors with equipped skins + name tags, live headcount
- [ ] Phase 2 — board games as synced events (chess moves, scrabble placements,
      card flips)
- [ ] Phase 3 — shared physics: host-authoritative simulation, guests send
      inputs, host broadcasts snapshots (~20/s), guests interpolate

## Easy button
- [ ] Replace the speech-bubble "That was easy." with the real voice clip —
      add an audio asset, play it on button release (see easybutton.ts)

## Other open threads
- [x] Repo home: now dlandman27/dylanworld (full history; old dylan-chalkboard copy can be deleted)
- [x] Vercel hosting — deploy = git push
- [ ] Mobile/touch pass (links get opened on phones first)
- [ ] rsotw on the table: `/sites/random` page in rsotw + iPad object opening
      the live site in a framed modal
- [ ] Knuckles ring (marble game with a goal — first "winnable" toy)
- [ ] Dominoes: re-register when a spot opens up
- [ ] Pennant bunting (triangle flag garland) strung across a wall — house palette,
      ink outlines, soft shadow, drawn in the wall's perspective (like the window)
