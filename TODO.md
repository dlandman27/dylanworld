# TODO

## Multiplayer — PartyKit
Host a table, friends join via room link (`?room=XXXX`), play together.
- [x] Deploy the site — LIVE at https://dylanworld-alpha.vercel.app (2026-07-20)
- [ ] PartyKit setup: party server in-repo, room create/join, `?room=` param
- [ ] Phase 1 — presence: broadcast cursor positions; render other players'
      cursors with their equipped cursor-arcade skin + name tag
- [ ] Phase 2 — board games as synced events (chess moves, scrabble placements,
      card flips)
- [ ] Phase 3 — shared physics: host-authoritative simulation, guests send
      inputs, host broadcasts snapshots (~20/s), guests interpolate

## Other open threads
- [x] Repo home: now dlandman27/dylanworld (full history; old dylan-chalkboard copy can be deleted)
- [x] Vercel hosting — deploy = git push
- [ ] Mobile/touch pass (links get opened on phones first)
- [ ] rsotw on the table: `/sites/random` page in rsotw + iPad object opening
      the live site in a framed modal
- [ ] Knuckles ring (marble game with a goal — first "winnable" toy)
- [ ] Dominoes: re-register when a spot opens up
