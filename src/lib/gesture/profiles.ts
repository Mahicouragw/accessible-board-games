/**
 * Per-game gesture profiles.
 *
 * Every game in the Game Hall has its OWN profile: which gestures it uses and
 * the spoken control instructions in English / Telugu / Hindi. A game's
 * gestures are only ever delivered while that game's context is active — the
 * GestureManager guarantees isolation, and each profile documents the mapping.
 *
 * Future games (e.g. Car Racing, Blackjack) add one entry here — see
 * controllers.ts for ready-made factories that implement the racing
 * (hold-accelerate / swipe-steer / tap-brake) and card-table gesture
 * semantics on top of the shared classifier.
 */

import type { GestureType } from "./types";
import type { Lang } from "@/lib/i18n";

export interface GameGestureProfile {
  gameId: string;
  name: string;
  /** Gestures this game actually consumes. */
  gestures: GestureType[];
  /** One-time spoken instructions when the game opens (announced once). */
  instructions: Record<Lang, string>;
}

function P(
  gameId: string,
  name: string,
  gestures: GestureType[],
  en: string,
  te: string,
  hi: string,
): GameGestureProfile {
  return { gameId, name, gestures, instructions: { en, te, hi } };
}

export const GAME_GESTURE_PROFILES: Record<string, GameGestureProfile> = {
  "tic-tac-toe": P(
    "tic-tac-toe", "Tic-Tac-Toe", ["tap", "double-tap"],
    "Tic-Tac-Toe. Tap a square to place your mark. With TalkBack, double-tap the focused square. Swipes are not used in this game.",
    "Tic-Tac-Toe — Ortiz square lo mark petti: tap cheyandi. TalkBack lo double-tap cheyandi. Swipes use cheyaru.",
    "Tic-Tac-Toe — square par apna mark lagane ke liye tap karein. TalkBack mein double-tap karein. Swipe ka istemaal nahi hota.",
  ),
  "connect-four": P(
    "connect-four", "Connect Four", ["tap", "double-tap"],
    "Connect Four. Tap a column to drop your disc. With TalkBack, double-tap the focused column. Swipes are not used in this game.",
    "Connect Four — disc drop cheyadaniki column meeda tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Connect Four — disc daalne ke liye column par tap karein. TalkBack mein double-tap. Swipe nahi use hota.",
  ),
  "rock-paper-scissors": P(
    "rock-paper-scissors", "Rock Paper Scissors", ["tap", "double-tap"],
    "Rock Paper Scissors. Tap Rock, Paper or Scissors to play. With TalkBack, double-tap the focused button. Swipes are not used here.",
    "Rock Paper Scissors — aadataniki Rock, Paper leda Scissors meeda tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Rock Paper Scissors — khelne ke liye Rock, Paper ya Scissors par tap karein. TalkBack mein double-tap. Swipe nahi.",
  ),
  memory: P(
    "memory", "Memory Match", ["tap", "double-tap"],
    "Memory Match. Tap a card to flip it, tap a second card to find the pair. With TalkBack, double-tap the focused card. Swipes are not used here.",
    "Memory Match — card flip cheyadaniki tap cheyandi, pair kosam inkoti tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Memory Match — card flip karne ke liye tap, pair ke liye dusra tap. TalkBack mein double-tap. Swipe nahi.",
  ),
  "2048": P(
    "2048", "2048", ["swipe-left", "swipe-right", "swipe-up", "swipe-down", "tap"],
    "2048. Swipe left, right, up or down to slide the tiles. Tap New Game to restart. Arrow keys also work. These swipes only move tiles — never the world.",
    "2048 — tiles slide cheyadaniki swipe cheyandi: left, right, up, down. Restart ki New Game tap. Arrow keys kuda work avuthayi.",
    "2048 — tiles slide karne ke liye swipe karein: left, right, up, down. Restart ke liye New Game tap. Arrow keys bhi chalte hain.",
  ),
  snake: P(
    "snake", "Snake", ["swipe-left", "swipe-right", "swipe-up", "swipe-down", "tap"],
    "Snake. Swipe up, down, left or right to steer the snake. Tap the board to start or restart. Arrow keys also work. Swipes only steer the snake — never the world.",
    "Snake — pāmnunna steer cheyadaniki swipe cheyandi: up, down, left, right. Start/restart ki board meeda tap cheyandi. Arrow keys kuda work avuthayi.",
    "Snake — saamp ko steer karne ke liye swipe karein: up, down, left, right. Start/restart ke liye board par tap. Arrow keys bhi.",
  ),
  ludo: P(
    "ludo", "Ludo", ["tap", "swipe-down"],
    "Ludo. Tap the Roll button — or swipe down — to roll the dice. Then tap a token button to move it. With TalkBack, double-tap a control to activate it. Gestures only affect Ludo.",
    "Ludo — dice roll cheyadaniki Roll button tap cheyandi leda swipe down cheyandi. Tarvata token button meeda tap cheyandi move cheyadaniki. TalkBack lo double-tap.",
    "Ludo — dice roll ke liye Roll button tap karein ya swipe down. Phir token button tap karke move karein. TalkBack mein double-tap.",
  ),
  "snake-ladder": P(
    "snake-ladder", "Snake & Ladder", ["tap", "swipe-down"],
    "Snake and Ladder. Tap the dice — or swipe down on the board — to roll. Your token moves automatically with spoken square announcements. Gestures only affect this board.",
    "Snake & Ladder — roll cheyadaniki dice meeda tap cheyandi leda board meeda swipe down cheyandi. Token automatic ga move avuthundi. Gestures ee board ki matrame.",
    "Snake & Ladder — roll ke liye dice par tap karein ya board par swipe down. Token automatically move hota hai. Gestures sirf isi board ke liye.",
  ),
  carrom: P(
    "carrom", "Carrom", ["drag-start", "drag", "drag-end", "swipe-left", "swipe-right", "double-tap", "tap"],
    "Carrom. Drag on the board to aim and release to flick the striker. Swipe left or right to move the striker along the baseline, double-tap to shoot straight, or use the Shoot button. Gestures only affect the board.",
    "Carrom — aim cheyadaniki board meeda drag cheyandi, release cheste striker shoot avuthundi. Striker move cheyadaniki swipe left/right, shoot ki double-tap leda Shoot button. Gestures board ki matrame.",
    "Carrom — aim ke liye board par drag karein, release par striker shoot hota hai. Striker move ke liye swipe left/right, shoot ke liye double-tap ya Shoot button. Gestures sirf board ke liye.",
  ),
  chess: P(
    "chess", "Chess", ["tap", "double-tap", "swipe-left", "swipe-right", "swipe-up", "swipe-down", "long-press"],
    "Chess. Tap a piece to select it — its legal squares are announced and shown. Tap a legal square to move. Swipe to scan squares, long-press a square for details. With TalkBack, double-tap to activate. Gestures only affect the board.",
    "Chess — piece select cheyadaniki tap cheyandi; legal squares announce avuthayi. Move cheyadaniki legal square meeda tap. Squares scan ki swipe, details ki long-press. TalkBack lo double-tap. Gestures board ki matrame.",
    "Chess — piece select karne ke liye tap karein; legal squares announce hoti hain. Move ke liye legal square tap. Squares scan ke liye swipe, details ke liye long-press. TalkBack mein double-tap. Sirf board.",
  ),
  cricket: P(
    "cricket", "Cricket", ["tap", "double-tap"],
    "Cricket. Tap a shot button to bat. With TalkBack, double-tap the focused button. Swipes are not used here.",
    "Cricket — bat cheyadaniki shot button tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Cricket — batting ke liye shot button tap. TalkBack mein double-tap. Swipe nahi.",
  ),
  "hand-cricket": P(
    "hand-cricket", "Hand Cricket", ["tap", "double-tap"],
    "Hand Cricket. Tap a number button to play your shot. With TalkBack, double-tap the focused button. Swipes are not used here.",
    "Hand Cricket — shot veyadaniki number button tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Hand Cricket — shot khelne ke liye number button tap. TalkBack mein double-tap. Swipe nahi.",
  ),
  checkers: P(
    "checkers", "Checkers", ["tap", "double-tap"],
    "Checkers. Tap one of your pieces to select it, then tap a highlighted square to move. With TalkBack, double-tap to activate. Gestures only affect the board.",
    "Checkers — piece select ki tap, move ki highlighted square meeda tap. TalkBack lo double-tap. Gestures board ki matrame.",
    "Checkers — piece select karne ke liye tap, move ke liye highlighted square tap. TalkBack mein double-tap. Sirf board.",
  ),
  dominoes: P(
    "dominoes", "Dominoes", ["tap", "double-tap"],
    "Dominoes. Tap a domino to place it. With TalkBack, double-tap the focused domino. Swipes are not used here.",
    "Dominoes — domino place cheyadaniki tap cheyandi. TalkBack lo double-tap. Swipes use cheyaru.",
    "Dominoes — domino rakhne ke liye tap. TalkBack mein double-tap. Swipe nahi.",
  ),
  sudoku: P(
    "sudoku", "Sudoku", ["tap", "double-tap"],
    "Sudoku. Tap a cell to select it, then tap a number to fill it. With TalkBack, double-tap to activate. Swipes are not used here.",
    "Sudoku — cell select ki tap, number fill ki tap. TalkBack lo double-tap. Swipes use cheyaru.",
    "Sudoku — cell select karne ke liye tap, number daalne ke liye tap. TalkBack mein double-tap. Swipe nahi.",
  ),
  minesweeper: P(
    "minesweeper", "Minesweeper", ["tap", "long-press", "double-tap"],
    "Minesweeper. Tap a cell to reveal it, long-press a cell to flag it. With TalkBack, double-tap to reveal. Gestures only affect the grid.",
    "Minesweeper — cell reveal ki tap, flag ki long-press. TalkBack lo reveal ki double-tap. Gestures grid ki matrame.",
    "Minesweeper — reveal ke liye tap, flag ke liye long-press. TalkBack mein double-tap. Sirf grid.",
  ),
  "football-penalty": P(
    "football-penalty", "Football Penalty", ["tap", "double-tap", "swipe-left", "swipe-right", "swipe-up"],
    "Football Penalty. Tap a direction to shoot, or swipe left, right or up. With TalkBack, double-tap the focused direction. Gestures only affect the pitch.",
    "Football Penalty — shoot ki direction tap leda swipe (left, right, up). TalkBack lo double-tap. Gestures pitch ki matrame.",
    "Football Penalty — shoot ke liye direction tap ya swipe (left, right, up). TalkBack mein double-tap. Sirf pitch.",
  ),
  tetris: P(
    "tetris", "Tetris", ["tap", "swipe-left", "swipe-right", "swipe-up", "swipe-down"],
    "Tetris. Swipe left or right to move the piece, swipe down to soft drop, swipe up for hard drop, tap to rotate. Gestures only affect the well.",
    "Tetris — piece move ki swipe left/right, soft drop ki swipe down, hard drop ki swipe up, rotate ki tap. Gestures well ki matrame.",
    "Tetris — move ke liye swipe left/right, soft drop swipe down, hard drop swipe up, rotate tap. Sirf well.",
  ),
  basketball: P(
    "basketball", "Basketball", ["tap", "double-tap", "swipe-up"],
    "Basketball. Tap Shoot to take a shot, or swipe up to shoot. With TalkBack, double-tap the focused button. Gestures only affect the court.",
    "Basketball — shot veyadaniki Shoot tap leda swipe up. TalkBack lo double-tap. Gestures court ki matrame.",
    "Basketball — shot ke liye Shoot tap ya swipe up. TalkBack mein double-tap. Sirf court.",
  ),
  "monster-battle": P(
    "monster-battle", "Monster Battle", ["tap", "double-tap", "swipe-left", "swipe-right"],
    "Monster Battle. Tap Attack, Magic or an item to use it. Swipe left or right to switch monster. With TalkBack, double-tap the focused control. Gestures only affect the battle.",
    "Monster Battle — Attack, Magic leda item use ki tap. Monster switch ki swipe left/right. TalkBack lo double-tap. Gestures battle ki matrame.",
    "Monster Battle — Attack, Magic ya item ke liye tap. Monster badalne ke liye swipe left/right. TalkBack mein double-tap. Sirf battle.",
  ),

  // ---- Future-game templates: register a controller + these instructions and
  // the isolation lifecycle applies automatically. ----
  "car-racing": P(
    "car-racing", "Car Racing", ["hold-start", "hold", "hold-end", "swipe-left", "swipe-right", "tap"],
    "Car Racing. Press and hold the accelerator to speed up — keep holding to go faster. Swipe right to steer right, swipe left to steer left. Tap the brake to slow down. Gestures only steer the car — never the world.",
    "Car Racing — speed ki accelerator press-and-hold (hold chesthe speed peruguthundi). Right ki steer ki swipe right, left ki swipe left. Slow ki brake tap. Gestures car ki matrame.",
    "Car Racing — speed ke liye accelerator press-and-hold (pakde rakho, speed badhti hai). Right steer swipe right, left swipe left. Slow ke liye brake tap. Sirf car.",
  ),
  blackjack: P(
    "blackjack", "Blackjack", ["tap", "double-tap"],
    "Blackjack. Tap Hit to take a card, Stand to hold, Double Down or Split when offered. With TalkBack, double-tap the focused action. Gestures only affect the table.",
    "Blackjack — card teesukodaniki Hit tap, nilabadataniki Stand, Double Down/Split offer aithe tap. TalkBack lo double-tap. Gestures table ki matrame.",
    "Blackjack — card lene ke liye Hit tap, Stand nilabdhne ke liye, Double Down/Split par tap. TalkBack mein double-tap. Sirf table.",
  ),
};

/** Profile for a game, falling back to a generic accessible profile. */
export function getGameProfile(gameId: string): GameGestureProfile {
  return (
    GAME_GESTURE_PROFILES[gameId] ?? {
      gameId,
      name: gameId,
      gestures: ["tap", "double-tap"],
      instructions: {
        en: `${gameId}. Tap or double-tap a control to use it. Swipes are not used in this game. Gestures only affect this game.`,
        te: `${gameId} — control use ki tap leda double-tap. Swipes use cheyaru. Gestures ee game ki matrame.`,
        hi: `${gameId} — control ke liye tap ya double-tap. Swipe nahi. Sirf yeh game.`,
      },
    }
  );
}
