# 🔊 Sound & Music Sources (v1.3.0)

## Web-sourced effects — Google Sound Library for apps (actions.google.com/sounds)
| File | Used for |
|---|---|
| `realistic/crowd-win.ogg` | Cricket boundary crowd roar |
| `realistic/ui-tick.ogg` | Button tick |
| `realistic/slide-whistle.ogg` | Level-up rising whistle |
| `realistic/capture-pop.ogg` | Pop layer |

## Studio-crafted foley (unique per action — no duplicates, verified via checksums)
Created procedurally for this app and shipped as real WAV files:
`dice-rolling`, `token-wood-move`, `capture-real`, `carrom-strike-real`, `carrom-pocket-real`,
`ladder-climb-real`, `snake-hiss-real`, `card-shuffle-real`, `win-fanfare-real`, `lose-sad-real`

## 🎵 Per-game background music (original loops composed for this app)
| Game | Tune | Feel |
|---|---|---|
| Ludo | `music/ludo-theme.wav` | playful bounce |
| Snakes & Ladders | `music/snake-ladder-theme.wav` | mysterious waltz |
| Carrom | `music/carrom-theme.wav` | lounge swing |
| All other 16 games | `music/hub-theme.wav` | cheerful arcade hub |

Music auto-switches per game (see `src/lib/useGameMusic.ts` + `src/app/play/[game]/page.tsx`)
and only plays when the user's Music toggle is ON.

## 🧹 Cleanup
Removed 13 duplicate OGGs that made different actions sound identical
(ladder==snake, win==level-up==card-shuffle, etc.) and one broken file that was
an HTML error page saved as `.ogg`. Every remaining file is md5-unique.
