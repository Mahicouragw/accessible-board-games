// Local game-logic contract tests — run with: node tests/localGames.test.js
// Covers the shared Tic-Tac-Toe / Connect Four rules + AI used by the offline
// game modes (OnlineMatch local matches) and the API.
const { execSync } = require('child_process');
execSync(
  'npx tsc src/lib/games.ts --outDir /tmp/lgtest --module commonjs --target es2020 --skipLibCheck',
  { stdio: 'inherit' }
);
const {
  checkTicTacToe,
  bestTicTacToeMove,
  c4DropRow,
  checkConnectFour,
  bestConnectFourMove,
  getGame,
  GAMES,
} = require('/tmp/lgtest/games.js');

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name); } };

// ---- every game in the arcade resolves to a real entry ----
check('all 23 games registered in the arcade', GAMES.length === 23);
check('new games present', ['dice-race', 'sound-simon', 'reaction-rush'].every(id => !!getGame(id)));
check('every game id unique', new Set(GAMES.map(g => g.id)).size === GAMES.length);
check('chess / tic-tac-toe / connect-four present and marked online-capable',
  ['chess', 'tic-tac-toe', 'connect-four'].every(id => getGame(id)?.online === true));

// ---- tic-tac-toe ----
check('ttt detects X win', checkTicTacToe([1, 1, 1, 0, 2, 0, 0, 2, 0]) === 1);
check('ttt detects O win', checkTicTacToe([2, 2, 2, 1, 1, 0, 0, 0, 0]) === 2);
check('ttt detects draw', checkTicTacToe([1, 2, 1, 1, 2, 2, 2, 1, 1]) === 0);
check('ttt ongoing → null', checkTicTacToe([1, 0, 0, 0, 2, 0, 0, 0, 0]) === null);
{
  // AI must take an immediate win
  const b = [1, 1, 0, 2, 2, 0, 0, 0, 0];
  check('ttt AI takes the winning move (col 3)', bestTicTacToeMove([...b], 1) === 2);
}
{
  // AI must block opponent's immediate win
  const b = [2, 2, 0, 1, 0, 0, 0, 0, 1];
  check('ttt AI blocks the block (col 3)', bestTicTacToeMove([...b], 1) === 2);
}
{
  // never returns an occupied square
  const b = [1, 2, 1, 1, 2, 2, 2, 1, 0];
  check('ttt AI picks the only free square', bestTicTacToeMove([...b], 1) === 8);
}

// ---- connect four ----
check('c4 drop lands on bottom row', c4DropRow(Array.from({ length: 6 }, () => Array(7).fill(0)), 3) === 5);
{
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  b[5][0] = 1; b[4][0] = 1; b[3][0] = 1;
  check('c4 detects vertical win', checkConnectFour(b) === null); // only 3
  b[2][0] = 1;
  check('c4 detects vertical 4', checkConnectFour(b) === 1);
}
{
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  b[5][0] = 2; b[5][1] = 2; b[5][2] = 2;
  check('c4 detects horizontal 3 not yet win', checkConnectFour(b) === null);
  b[5][3] = 2;
  check('c4 detects horizontal 4', checkConnectFour(b) === 2);
}
{
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  b[5][0] = 1; b[4][1] = 1; b[3][2] = 1; b[2][3] = 1;
  check('c4 detects diagonal 4', checkConnectFour(b) === 1);
}
{
  // AI takes immediate win in column 4
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  b[5][3] = 2; b[4][3] = 2; b[3][3] = 2;
  check('c4 AI takes the winning column', bestConnectFourMove(b, 2) === 3);
}
{
  // AI blocks opponent's immediate win
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  b[5][5] = 1; b[4][5] = 1; b[3][5] = 1;
  check('c4 AI blocks the winning column', bestConnectFourMove(b, 2) === 5);
}
{
  const b = Array.from({ length: 6 }, () => Array(7).fill(0));
  const mv = bestConnectFourMove(b, 1);
  check('c4 AI opens in the center column', mv === 3);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
