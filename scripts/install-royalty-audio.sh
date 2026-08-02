#!/usr/bin/env bash
# ============================================================================
# Install REAL royalty-free audio for Accessible Board Games (v1.9.3)
# Sources (all approved free libraries):
#   - Kenney.nl  : Interface / Impact / Casino / RPG / Digital / Music Jingles
#                  packs — CC0
#   - OpenGameArt: boing (CC0), air whoosh (CC0), 4 music loops (CC0/CC-BY)
#   - Google Sound Library for apps (kept, already real): crowd-win, ui-tick,
#     slide-whistle, capture-pop, cricket-wicket, dice-roll-wood*.flac,
#     piece-place-wobble.ogg
# Every generated/procedural file is REPLACED. Nothing synthesized remains.
# ============================================================================
set -euo pipefail
SRC=/var/tmp/abg-audio
OUT=/home/user/repos/accessible-board-games/public/sounds
FF=$(python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
mkdir -p "$OUT/realistic" "$OUT/music"

# mono 44.1k 16-bit wav (SFX)
wav() { "$FF" -y -loglevel error -i "$1" -ac 1 -ar 44100 -sample_fmt s16 "$OUT/$2"; echo "  ✓ $2"; }
# stereo 44.1k 128k mp3 (music loops)
mp3() { "$FF" -y -loglevel error -i "$1" -ac 2 -ar 44100 -b:a 128k "$OUT/$2"; echo "  ✓ $2"; }

echo "── UI / buttons ─────────────────────────────────────────────"
wav "$SRC/x_interface-sounds/Audio/click_001.ogg"        click.wav
wav "$SRC/x_interface-sounds/Audio/confirmation_001.ogg" select.wav
wav "$SRC/x_interface-sounds/Audio/confirmation_002.ogg" turn.wav
wav "$SRC/x_casino-audio/Audio/chip-lay-2.ogg"           coin-drop.wav

echo "── movement: clean board-game taps (Kenney impact planks) ──"
wav "$SRC/x_impact-sounds/Audio/impactPlank_medium_000.ogg" realistic/token-wood-move.wav
wav "$SRC/x_impact-sounds/Audio/impactPlank_medium_001.ogg" realistic/tap-wood.wav

echo "── dice: REAL dice throws (Kenney casino) ─────────────────"
wav "$SRC/x_casino-audio/Audio/die-throw-1.ogg"           realistic/dice-rolling.wav

echo "── actions / sports ────────────────────────────────────────"
wav "$SRC/x_impact-sounds/Audio/impactPunch_medium_000.ogg" realistic/capture-real.wav
wav "$SRC/x_impact-sounds/Audio/impactPunch_medium_001.ogg" realistic/snake-bite-real.wav
wav "$SRC/x_impact-sounds/Audio/impactPlank_medium_002.ogg"  realistic/carrom-strike-real.wav
wav "$SRC/x_casino-audio/Audio/chips-collide-1.ogg"       realistic/carrom-pocket-real.wav
wav "$SRC/x_casino-audio/Audio/card-shuffle.ogg"          realistic/card-shuffle-real.wav
wav "$SRC/x_impact-sounds/Audio/impactPunch_heavy_000.ogg" football-kick.wav
wav "$SRC/x_impact-sounds/Audio/impactPunch_heavy_001.ogg" cricket-bat.wav
wav "$SRC/x_impact-sounds/Audio/impactSoft_heavy_000.ogg"  basketball-bounce.wav
wav "$SRC/x_sfx/sound_effects/boing.wav"                  bounce.wav

echo "── snake: real whoosh slide (OGA CC0) ─────────────────────"
wav "$SRC/x_sfx/sound_effects/whoosh2.wav"                realistic/snake-hiss-real.wav

echo "── ladder: 4 real wooden footsteps sequenced ───────────────"
"$FF" -y -loglevel error \
  -i "$SRC/x_impact-sounds/Audio/footstep_wood_000.ogg" \
  -i "$SRC/x_impact-sounds/Audio/footstep_wood_001.ogg" \
  -i "$SRC/x_impact-sounds/Audio/footstep_wood_002.ogg" \
  -i "$SRC/x_impact-sounds/Audio/footstep_wood_003.ogg" \
  -filter_complex "[0:a][1:a][2:a][3:a]concat=n=4:v=0:a=1,adelay=0|120|240|360,pan=mono|c0=c0" \
  -ac 1 -ar 44100 -sample_fmt s16 "$OUT/realistic/ladder-climb-real.wav"
echo "  ✓ realistic/ladder-climb-real.wav"

echo "── results: real pizzicato fanfare + digital sad trombone ──"
wav "$SRC/x_music-jingles/Audio/Pizzicato jingles/jingles_PIZZI01.ogg" realistic/win-fanfare-real.wav
wav "$SRC/x_digital-audio/Audio/lowDown.ogg"              realistic/lose-sad-real.wav

echo "── music themes: real CC0/CC-BY loops ──────────────────────"
mp3 "$SRC/MSTR_-_MSTR_-_Choro_bavario_Loop.mp3"           music/hub-theme.mp3
mp3 "$SRC/Bruno_Belotti_-_La_Spensierata__Polka_Loop.mp3" music/ludo-theme.mp3
mp3 "$SRC/qubodup-yd-DarkShrineLoop-OpenGameArt.ogg"      music/snake-ladder-theme.mp3
mp3 "$SRC/catchyswing_0.mp3"                              music/carrom-theme.mp3

echo "── clean short taps (300ms with fade-out) ──────────────────"
"$FF" -y -loglevel error -i "$SRC/x_impact-sounds/Audio/impactPlank_medium_000.ogg" -t 0.32 -af "afade=t=out:st=0.18:d=0.14" -ac 1 -ar 44100 -sample_fmt s16 "$OUT/realistic/token-wood-move.wav"
"$FF" -y -loglevel error -i "$SRC/x_impact-sounds/Audio/impactPlank_medium_001.ogg" -t 0.32 -af "afade=t=out:st=0.18:d=0.14" -ac 1 -ar 44100 -sample_fmt s16 "$OUT/realistic/tap-wood.wav"

echo "── remove old generated music + unused generated roots ─────"
rm -f "$OUT/music/"*.wav
rm -f "$OUT/background-music.wav" "$OUT/capture.wav" "$OUT/card-shuffle.wav" \
      "$OUT/carrom-strike.wav" "$OUT/checkers-move.wav" "$OUT/chess-move.wav" \
      "$OUT/cricket-boundary.wav" "$OUT/dice-roll.wav" \
      "$OUT/ladder.wav" "$OUT/level-up.wav" "$OUT/lose.wav" "$OUT/snake.wav" \
      "$OUT/token-move.wav" "$OUT/win.wav" "$OUT/button.wav"
echo "── done ────────────────────────────────────────────────────"
