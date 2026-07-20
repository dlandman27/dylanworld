# TODO

## Multiplayer — PartyKit
Host a table, friends join via room link (`?room=XXXX`), play together.
- [ ] Deploy the site (prerequisite — room links need a real URL)
- [ ] PartyKit setup: party server in-repo, room create/join, `?room=` param
- [ ] Phase 1 — presence: broadcast cursor positions; render other players'
      cursors with their equipped cursor-arcade skin + name tag
- [ ] Phase 2 — board games as synced events (chess moves, scrabble placements,
      card flips)
- [ ] Phase 3 — shared physics: host-authoritative simulation, guests send
      inputs, host broadcasts snapshots (~20/s), guests interpolate

## Other open threads
- [ ] Repo home: transfer dylan-chalkboard/dylanworld → dlandman27 (or decide to keep)
- [ ] Vercel hosting (deploy = git push, like rsotw)
- [ ] rsotw on the table: `/sites/random` page in rsotw + iPad object opening
      the live site in a framed modal
- [ ] Knuckles ring (marble game with a goal — first "winnable" toy)
- [ ] Dominoes: re-register when a spot opens up
