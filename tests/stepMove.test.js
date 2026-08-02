// stepMove contract tests — run with: node tests/stepMove.test.js
const { execSync } = require('child_process');
execSync('npx tsc src/lib/stepMove.ts --outDir /tmp/steptest --module commonjs --target es2020 --skipLibCheck', { stdio: 'inherit' });
const { stepMove } = require('/tmp/steptest/stepMove.js');

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name); } };

async function run(steps) {
  const events = [];
  let taps = 0;
  await stepMove({
    steps,
    onStep: (i) => events.push(`move${i}`),
    announceStep: (i) => events.push(`announce${i}`),
    tap: async () => { taps++; events.push(`tap${taps}`); await new Promise(r => setTimeout(r, 5)); },
    gapMs: 2,
  });
  return { events, taps };
}

(async () => {
  let r = await run(1);
  check('roll 1 → exactly 1 tap', r.taps === 1);
  check('roll 1 → order move1→tap1→announce1', JSON.stringify(r.events) === JSON.stringify(['move1','tap1','announce1']));

  r = await run(6);
  check('roll 6 → exactly 6 taps', r.taps === 6);
  const expected6 = [];
  for (let i = 1; i <= 6; i++) expected6.push(`move${i}`, `tap${i}`, `announce${i}`);
  check('roll 6 → strict per-square order', JSON.stringify(r.events) === JSON.stringify(expected6));

  r = await run(4);
  check('roll 4 → exactly 4 taps', r.taps === 4);
  check('roll 4 → announce AFTER each tap', r.events.filter(e => e.startsWith('announce')).every((_, i) => r.events.indexOf(`announce${i+1}`) > r.events.indexOf(`tap${i+1}`)));

  r = await run(0);
  check('roll 0 → zero taps', r.taps === 0 && r.events.length === 0);

  for (let k = 0; k < 20; k++) {
    const steps = 1 + Math.floor(Math.random() * 6);
    r = await run(steps);
    if (r.taps !== steps) { check(`random roll ${steps} → exactly ${steps} taps`, false); break; }
    if (k === 19) check('20 random rolls → taps always == squares', true);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
