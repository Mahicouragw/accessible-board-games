# 🔊 Sound & Music Sources — Accessible Board Games v1.9.3

**100% real royalty-free audio. No generated, procedural, or placeholder audio
anywhere in this app.** Every file below is a real recording from a trusted
free library.

## SFX — Kenney.nl (CC0, kenney.nl)

| File | Used for | Kenney pack |
|---|---|---|
| `click.wav` | UI click | Interface Sounds — `click_001` |
| `select.wav` | Menu select | Interface Sounds — `confirmation_001` |
| `turn.wav` | Turn change | Interface Sounds — `confirmation_002` |
| `realistic/dice-rolling.wav` | Ludo dice roll | Casino Audio — `die-throw-1` (REAL dice) |
| `realistic/token-wood-move.wav` | Ludo/checkers/chess piece move | Impact Sounds — `impactPlank_medium_000` (clean wooden tap, trimmed) |
| `realistic/tap-wood.wav` | Snakes & Ladders per-square move | Impact Sounds — `impactPlank_medium_001` (clean wooden tap, trimmed) |
| `realistic/capture-real.wav` | Piece capture | Impact Sounds — `impactPunch_medium_000` |
| `realistic/snake-bite-real.wav` | Snake bite | Impact Sounds — `impactPunch_medium_001` |
| `realistic/carrom-strike-real.wav` | Carrom striker | Impact Sounds — `impactPlank_medium_002` |
| `realistic/carrom-pocket-real.wav` | Carrom coin pocketed | Casino Audio — `chips-collide-1` |
| `realistic/card-shuffle-real.wav` | Card shuffle | Casino Audio — `card-shuffle` (REAL riffle) |
| `realistic/ladder-climb-real.wav` | Ladder climb | Impact Sounds — 4× `footstep_wood` sequenced (real wooden steps) |
| `coin-drop.wav` | Coin/point drop | Casino Audio — `chip-lay-2` |
| `realistic/win-fanfare-real.wav` | Victory | Music Jingles — `jingles_PIZZI01` (pizzicato fanfare) |
| `realistic/lose-sad-real.wav` | Game over | Digital Audio — `lowDown` (descending) |
| `cricket-bat.wav` | Cricket bat | Impact Sounds — `impactPunch_heavy_001` |
| `football-kick.wav` | Football kick | Impact Sounds — `impactPunch_heavy_000` |
| `basketball-bounce.wav` | Basketball bounce | Impact Sounds — `impactSoft_heavy_000` |

## SFX — OpenGameArt.org (CC0)

| File | Used for | Source |
|---|---|---|
| `bounce.wav` | Bounce | “18 random video game sound effects” — `boing.wav` (CC0) |
| `realistic/snake-hiss-real.wav` | Sliding down the snake | “Air whoosh” by qubodup — `whoosh2.wav` (CC0) |
| `realistic/dice-roll-wood.flac` | Dice (generic) | Wooden dice roll (CC0) |
| `realistic/dice-roll-wood-long.flac` | Snakes & Ladders dice | Wooden dice roll, long take (CC0) |

## SFX — Google Sound Library for apps (actions.google.com/sounds)

| File | Used for |
|---|---|
| `realistic/crowd-win.ogg` | Cricket boundary — crowd roar |
| `realistic/ui-tick.ogg` | Button tick |
| `realistic/slide-whistle.ogg` | Level-up slide whistle |
| `realistic/capture-pop.ogg` | Pop layer |
| `realistic/cricket-wicket.ogg` | Cricket wicket |
| `realistic/piece-place-wobble.ogg` | Board piece placed (legacy) |

## 🎵 Background music — OpenGameArt.org real loops

| File | Used for | Source track | Author | License |
|---|---|---|---|---|
| `music/hub-theme.mp3` | Default hub/arcade theme | Choro Bavario (happy loop) | qubodup (MSTR) | CC-BY 3.0 |
| `music/ludo-theme.mp3` | Ludo | La Spensierata (Polka Loop) | Bruno Belotti | CC-BY 3.0 |
| `music/snake-ladder-theme.mp3` | Snakes & Ladders | Dark Shrine Loop | qubodup | CC0 |
| `music/carrom-theme.mp3` | Carrom | Catchy Swing | doge | CC0 |

CC-BY attribution (as required by license): “Choro Bavario” loop by qubodup/MSTR
and “La Spensierata Polka Loop” by Bruno Belotti are used under the Creative
Commons Attribution 3.0 license via OpenGameArt.org. All other tracks are CC0.

## Why no generated audio?
Before v1.9.3 the app shipped “studio-crafted foley” (procedurally generated
tones). These were all replaced with the real recordings above. The sound
engine never synthesizes tones; if a file is missing it stays silent and logs a
warning rather than faking a sound.

## Regenerate
`bash scripts/install-royalty-audio.sh` (needs the source archives in
/var/tmp/abg-audio — see the script header for URLs).
