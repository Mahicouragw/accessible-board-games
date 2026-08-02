# 🔊 Sound & Music Sources (v1.9.3)

All audio is REAL royalty-free audio — see `ATTRIBUTION.md` for the full
per-file source table.

## Quick summary
- **Kenney.nl packs (CC0):** Interface, Impact, Casino, Digital, Music Jingles
- **OpenGameArt (CC0/CC-BY):** boing, air whoosh, wooden dice rolls, 4 music loops
- **Google Sound Library for apps:** crowd roar, UI tick, slide whistle, pop, wicket

## Synchronization design (v1.9.3)
- Every `sound.play()` runs through ONE serialized queue → no overlapping audio.
- `sound.playAndWait(name)` resolves after the real audio duration ends.
- `src/lib/stepMove.ts` moves tokens square-by-square:
  move 1 square → exactly ONE tap → announce that square → next square.
  Roll N ⇒ exactly N taps, never more.
- Snakes & Ladders: dice sound → “You rolled a N.” → N×(tap + square announce)
  → ladder (4 real wood steps) or snake (bite strike + whoosh slide), each
  announced after its sound finishes.
- Ludo: dice sound → “rolled N” → N×(tap + step announce) → capture/win sounds
  sequenced the same way.
