// Canonical catalog of every sound effect in the arcade.
// Shared by the sound engine (sound.ts), the Sound Studio upload page and the
// upload API (so names can never drift out of sync).
// Every effect is a REAL RECORDED file (public/sounds, CC0/MIT — see
// public/sounds/ATTRIBUTION.md); players can replace any of them with their
// own recording from /sound-studio and it publishes to everyone via the DB.

export type Sfx =
  | "click"
  | "select"
  | "dice"
  | "move"
  | "capture"
  | "pocket"
  | "ladder"
  | "snake"
  | "snake_bite"
  | "turn"
  | "win"
  | "lose"
  | "carrom_strike"
  | "snake_ladder_roll"
  | "ludo_dice"
  | "ludo_token"
  | "background_music"
  | "cricket_bat"
  | "cricket_boundary"
  | "cricket_wicket"
  | "checkers_move"
  | "chess_move"
  | "card_shuffle"
  | "coin_drop"
  | "level_up"
  | "bounce"
  | "button"
  | "basketball_bounce"
  | "football_kick"
  | "swipe"
  | "press"
  // 🎵 Game Hall SFX pack additions (real recordings, public/sounds/pack/, CC0 + MIT)
  | "carrom_wood_strike"
  | "carrom_rebound"
  | "carrom_pocket"
  | "ludo_capture"
  | "dice_roll_wood"
  | "chess_capture"
  | "chess_piece_move"
  | "ladder_climb"
  | "snake_hit"
  | "cricket_ball"
  | "cricket_run1"
  | "cricket_run2"
  | "cricket_run3"
  | "cricket_run4"
  | "cricket_run5"
  | "cricket_run6"
  | "cricket_win"
  | "cricket_lose"
  | "cricket_defeat"
  | "cricket_whistle"
  | "sneak_hit"
  | "victory_applause"
  | "victory_fanfare"
  | "defeat_trombone";

export const SFX_LIST: { name: Sfx; label: string; emoji: string }[] = [
  { name: "click", label: "UI click", emoji: "👆" },
  { name: "select", label: "Select / confirm", emoji: "✅" },
  { name: "button", label: "Button tick", emoji: "🔘" },
  { name: "dice", label: "Dice roll (wood)", emoji: "🎲" },
  { name: "ludo_dice", label: "Ludo dice throw", emoji: "🎲" },
  { name: "snake_ladder_roll", label: "Snake & Ladder roll", emoji: "🎲" },
  { name: "move", label: "Board piece move", emoji: "🪵" },
  { name: "ludo_token", label: "Ludo token move", emoji: "🔴" },
  { name: "checkers_move", label: "Checkers move", emoji: "♟️" },
  { name: "chess_move", label: "Chess move", emoji: "♞" },
  { name: "capture", label: "Capture", emoji: "💥" },
  { name: "pocket", label: "Carrom pocket", emoji: "🕳️" },
  { name: "carrom_strike", label: "Carrom strike", emoji: "💥" },
  { name: "ladder", label: "Climb ladder", emoji: "🪜" },
  { name: "snake", label: "Snake slide", emoji: "🐍" },
  { name: "snake_bite", label: "Snake bite", emoji: "😖" },
  { name: "turn", label: "Your turn", emoji: "🔔" },
  { name: "win", label: "Win fanfare", emoji: "🏆" },
  { name: "lose", label: "Lose", emoji: "😞" },
  { name: "level_up", label: "Level up", emoji: "⬆️" },
  { name: "card_shuffle", label: "Card shuffle", emoji: "🃏" },
  { name: "coin_drop", label: "Coin drop", emoji: "🪙" },
  { name: "bounce", label: "Bounce", emoji: "🏀" },
  { name: "basketball_bounce", label: "Basketball bounce", emoji: "🏀" },
  { name: "football_kick", label: "Football kick", emoji: "⚽" },
  { name: "cricket_bat", label: "Cricket bat crack", emoji: "🏏" },
  { name: "cricket_boundary", label: "Cricket boundary crowd", emoji: "📣" },
  { name: "cricket_wicket", label: "Cricket wicket", emoji: "🪵" },
  { name: "background_music", label: "Background music", emoji: "🎵" },
  { name: "swipe", label: "Swipe gesture", emoji: "👆" },
  { name: "press", label: "Press / tap", emoji: "👆" },
  { name: "carrom_wood_strike", label: "Carrom wood strike", emoji: "💥" },
  { name: "carrom_rebound", label: "Carrom rebound", emoji: "🔄" },
  { name: "carrom_pocket", label: "Carrom coin pocket", emoji: "🕳️" },
  { name: "ludo_capture", label: "Ludo token capture", emoji: "💥" },
  { name: "dice_roll_wood", label: "Wood dice shuffle", emoji: "🎲" },
  { name: "chess_capture", label: "Chess capture", emoji: "⚔️" },
  { name: "chess_piece_move", label: "Chess piece place", emoji: "♟️" },
  { name: "ladder_climb", label: "Ladder footsteps", emoji: "🪜" },
  { name: "snake_hit", label: "Snake hit", emoji: "🐍" },
  { name: "cricket_ball", label: "Cricket ball hit", emoji: "🏏" },
  { name: "cricket_run1", label: "Cricket run 1", emoji: "1️⃣" },
  { name: "cricket_run2", label: "Cricket run 2", emoji: "2️⃣" },
  { name: "cricket_run3", label: "Cricket run 3", emoji: "3️⃣" },
  { name: "cricket_run4", label: "Cricket run 4", emoji: "4️⃣" },
  { name: "cricket_run5", label: "Cricket run 5", emoji: "5️⃣" },
  { name: "cricket_run6", label: "Cricket run 6", emoji: "6️⃣" },
  { name: "cricket_win", label: "Cricket win jingle", emoji: "🏆" },
  { name: "cricket_lose", label: "Cricket lose", emoji: "😞" },
  { name: "cricket_defeat", label: "Cricket defeat", emoji: "🎺" },
  { name: "cricket_whistle", label: "Cricket whistle", emoji: "🫰" },
  { name: "sneak_hit", label: "Sneaky out hit", emoji: "🤫" },
  { name: "victory_applause", label: "Victory applause", emoji: "👏" },
  { name: "victory_fanfare", label: "Victory fanfare", emoji: "🎺" },
  { name: "defeat_trombone", label: "Defeat trombone", emoji: "📉" },
];

export const SFX_NAMES: Sfx[] = SFX_LIST.map((s) => s.name);
