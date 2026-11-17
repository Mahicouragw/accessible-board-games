// Canonical catalog of every sound effect in the arcade.
// Shared by the sound engine (sound.ts), the Sound Studio upload page and the
// upload API (so names can never drift out of sync).
// Every effect is a REAL RECORDED file (public/sounds, CC0/CC-BY — see
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
  | "football_kick";

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
];

export const SFX_NAMES: Sfx[] = SFX_LIST.map((s) => s.name);
