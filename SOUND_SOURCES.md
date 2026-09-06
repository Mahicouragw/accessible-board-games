# Sound sources — 100% royalty-free, generated live

Every sound in HeroBoard is **synthesised in the browser** with the Web Audio
API (`js/audio.js`). There are **no audio files** in the repository, so there is
nothing to license, nothing to attribute and nothing to host.

## SFX catalogue (all built from oscillators + filtered noise)

| Sound | How it’s made | Used by |
|---|---|---|
| `diceShake` / `diceRoll` | Short triangle blips + filtered noise | Snakes & Ladders, Ludo |
| `click(n)` (1–6) | Ascending sine pitches | Board moves, number picks |
| `thud` / `wood` | Low sine pitch + noise burst | Carrom striker, chess-style pieces |
| `bat` | Square-wave crack + wood resonance | Hand Cricket |
| `four` / `six` | Bat crack + crowd roar | Hand Cricket boundaries |
| `wicket` | Crowd roar + umpire call | Hand Cricket wicket |
| `umpire` | Band-passed sawtooth blips | Hand Cricket |
| `crowd` | Band-passed noise swell | Hand Cricket |
| `shuffle` | High-frequency triangle taps | Deck-derived games |
| `snake` | Descending saw sweep | Snakes |
| `steps(n)` | Ascending triangle blips | Ladders |
| `ping(pan)` | 3D-panned sine | Carrom sound-orientation aiming |
| `chime`, `bell`, `select`, `back`, `error`, `whoosh` | Tone utilities | General UI |

**Spatial audio** (`settings → Spatial sound`) uses an `AudioPannerNode` with
`equalpower` panning so left/right placement maps to direction — letting players
aim the Carrom striker, or find events, by ear.

## Speech
Narration uses the browser’s built-in **`window.speechSynthesis`** (an English
voice where available). No TTS assets are bundled.
