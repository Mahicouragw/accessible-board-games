export type GameId =
  | "tic-tac-toe"
  | "connect-four"
  | "rock-paper-scissors"
  | "memory"
  | "2048"
  | "snake"
  | "ludo"
  | "snake-ladder"
  | "carrom"
  | "chess"
  | "cricket"
  | "checkers"
  | "dominoes"
  | "sudoku"
  | "minesweeper"
  | "football-penalty"
  | "tetris"
  | "basketball"
  | "monster-battle";

export type GameInfo = {
  id: GameId;
  name: string;
  emoji: string;
  tagline: string;
  color: string;
  online: boolean; // supports online / AI matchmaking
  scoreLabel: string;
};

export const GAMES: GameInfo[] = [
  {
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    emoji: "⭕",
    tagline: "Classic 3-in-a-row. Play online or vs AI. Enhanced: 4x4, 5x5 variants, advanced AI",
    color: "from-sky-500 to-indigo-600",
    online: true,
    scoreLabel: "Wins",
  },
  {
    id: "connect-four",
    name: "Connect Four",
    emoji: "🔴",
    tagline: "Drop discs, connect four to win. Enhanced: Power-ups, 3D mode, advanced",
    color: "from-rose-500 to-pink-600",
    online: true,
    scoreLabel: "Wins",
  },
  {
    id: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    emoji: "✊",
    tagline: "Best of luck vs the AI. Enhanced: Lizard Spock variant, best of 5",
    color: "from-amber-500 to-orange-600",
    online: false,
    scoreLabel: "Best streak",
  },
  {
    id: "memory",
    name: "Memory Match",
    emoji: "🧠",
    tagline: "Flip and match all the pairs. Enhanced: 6x6, themes, timer, advanced",
    color: "from-emerald-500 to-teal-600",
    online: false,
    scoreLabel: "Best score",
  },
  {
    id: "2048",
    name: "2048",
    emoji: "🔢",
    tagline: "Merge tiles to reach 2048. Enhanced: 5x5, 6x6, undo, advanced",
    color: "from-violet-500 to-purple-600",
    online: false,
    scoreLabel: "High score",
  },
  {
    id: "snake",
    name: "Snake",
    emoji: "🐍",
    tagline: "Eat, grow, don't crash. Enhanced: Obstacles, levels, power-ups, advanced",
    color: "from-lime-500 to-green-600",
    online: false,
    scoreLabel: "High score",
  },
  {
    id: "ludo",
    name: "Ludo",
    emoji: "🎲",
    tagline: "Classic 4-player Ludo vs AI. Enhanced: 4 phones, 4 colours, invite, match request, realistic sounds",
    color: "from-red-500 to-yellow-500",
    online: false,
    scoreLabel: "Wins",
  },
  {
    id: "snake-ladder",
    name: "Snake & Ladder",
    emoji: "🪜",
    tagline: "Climb ladders, dodge snakes. Enhanced: 4 phones, colours, invite, 3D board",
    color: "from-green-500 to-emerald-600",
    online: false,
    scoreLabel: "Wins",
  },
  {
    id: "carrom",
    name: "Carrom",
    emoji: "⚫",
    tagline: "Flick the striker and pot the coins vs AI. Enhanced: 4-player, phone invite, realistic physics",
    color: "from-amber-600 to-yellow-700",
    online: false,
    scoreLabel: "Best pot",
  },
  {
    id: "chess",
    name: "Chess",
    emoji: "♟️",
    tagline: "Full rules chess. Enhanced: Hints, undo, 3 difficulty levels, advanced",
    color: "from-slate-400 to-slate-700",
    online: true,
    scoreLabel: "Wins",
  },
  {
    id: "cricket",
    name: "Cricket",
    emoji: "🏏",
    tagline: "Team vs Team! 3,4,5,11 players, 5-50 overs, score 345 vs 45, 50/3. Player vs Computer!",
    color: "from-emerald-600 to-green-700",
    online: false,
    scoreLabel: "Highest Score",
  },
  {
    id: "checkers",
    name: "Checkers",
    emoji: "♟️",
    tagline: "Classic Draughts - Advanced: Forced captures, king crown, realistic wood sounds",
    color: "from-amber-700 to-red-700",
    online: false,
    scoreLabel: "Wins",
  },
  {
    id: "dominoes",
    name: "Dominoes",
    emoji: "🀄",
    tagline: "Double-six domino set - Advanced: 28 tiles, score tracking, realistic shuffle sound",
    color: "from-slate-600 to-slate-800",
    online: false,
    scoreLabel: "Score",
  },
  {
    id: "sudoku",
    name: "Sudoku",
    emoji: "🔢",
    tagline: "9x9 Hard Sudoku - Advanced: Row/col highlight, error tracking, realistic number sound",
    color: "from-violet-600 to-indigo-700",
    online: false,
    scoreLabel: "Wins",
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    emoji: "💣",
    tagline: "10x10, 15 mines - Advanced: Flood reveal, flag, realistic click sounds",
    color: "from-amber-600 to-orange-700",
    online: false,
    scoreLabel: "Wins",
  },
  {
    id: "football-penalty",
    name: "Football Penalty",
    emoji: "⚽",
    tagline: "Penalty shootout - Advanced: Power + Angle, keeper AI, crowd cheer sounds, team vs team",
    color: "from-emerald-600 to-green-800",
    online: false,
    scoreLabel: "Goals",
  },
  {
    id: "tetris",
    name: "Tetris",
    emoji: "🧱",
    tagline: "Stack and clear lines - Advanced: 7 tetrominoes, line clear, level-up sound",
    color: "from-violet-600 to-purple-700",
    online: false,
    scoreLabel: "High Score",
  },
  {
    id: "basketball",
    name: "Basketball Shoot",
    emoji: "🏀",
    tagline: "Power + Angle shooting - Advanced: Realistic bounce sound, streak, team vs team 3-4-5 players",
    color: "from-orange-500 to-red-600",
    online: false,
    scoreLabel: "Goals",
  },
  {
    id: "monster-battle",
    name: "Monster Battle RPG",
    emoji: "⚔️",
    tagline: "1-6 monsters: Goblin 10 dmg hits back 10, Goblin Mage, Arch Magician! Light 30/40 dmg, MP 3+, spell fail 15%, multiple strikes!",
    color: "from-red-600 to-orange-700",
    online: false,
    scoreLabel: "Wins",
  },
];

export function getGame(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}

// ---- Tic-Tac-Toe helpers ----
export function checkTicTacToe(b: number[]): number | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, c, d] of lines) {
    if (b[a] !== 0 && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  if (b.every((x) => x !== 0)) return 0; // draw
  return null;
}

export function bestTicTacToeMove(b: number[], me: number): number {
  const opp = me === 1 ? 2 : 1;
  const minimax = (board: number[], player: number): { score: number; move: number } => {
    const w = checkTicTacToe(board);
    if (w === me) return { score: 10, move: -1 };
    if (w === opp) return { score: -10, move: -1 };
    if (w === 0) return { score: 0, move: -1 };
    let best = player === me ? { score: -Infinity, move: -1 } : { score: Infinity, move: -1 };
    for (let i = 0; i < 9; i++) {
      if (board[i] === 0) {
        board[i] = player;
        const res = minimax(board, player === 1 ? 2 : 1);
        board[i] = 0;
        if (player === me) {
          if (res.score > best.score) best = { score: res.score, move: i };
        } else {
          if (res.score < best.score) best = { score: res.score, move: i };
        }
      }
    }
    return best;
  };
  return minimax([...b], me).move;
}

// ---- Connect Four helpers ----
export const C4_ROWS = 6;
export const C4_COLS = 7;

export function c4DropRow(board: number[][], col: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

export function checkConnectFour(board: number[][]): number | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const p = board[r][c];
      if (p === 0) continue;
      for (const [dr, dc] of dirs) {
        let count = 1;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= C4_ROWS || nc < 0 || nc >= C4_COLS) break;
          if (board[nr][nc] === p) count++;
          else break;
        }
        if (count >= 4) return p;
      }
    }
  }
  if (board.every((row) => row.every((cell) => cell !== 0))) return 0;
  return null;
}

export function bestConnectFourMove(board: number[][], me: number): number {
  const opp = me === 1 ? 2 : 1;
  const valid: number[] = [];
  for (let c = 0; c < C4_COLS; c++) if (board[0][c] === 0) valid.push(c);
  // 1. win now
  for (const c of valid) {
    const r = c4DropRow(board, c);
    board[r][c] = me;
    if (checkConnectFour(board) === me) {
      board[r][c] = 0;
      return c;
    }
    board[r][c] = 0;
  }
  // 2. block opponent
  for (const c of valid) {
    const r = c4DropRow(board, c);
    board[r][c] = opp;
    if (checkConnectFour(board) === opp) {
      board[r][c] = 0;
      return c;
    }
    board[r][c] = 0;
  }
  // 3. prefer center
  const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => valid.includes(c));
  return order[0] ?? valid[0];
}
