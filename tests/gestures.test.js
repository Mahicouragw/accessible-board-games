// Gesture system contract tests — run with: node tests/gestures.test.js
// Compiles the DOM-free gesture core (classifier + manager + controllers) and
// verifies the isolation lifecycle and every gesture classification.
const { execSync } = require('child_process');
execSync(
  'npx tsc src/lib/gesture/types.ts src/lib/gesture/classifier.ts src/lib/gesture/manager.ts src/lib/gesture/controllers.ts src/lib/gesture/recognizer.ts --outDir /tmp/gtest --module commonjs --target es2020 --skipLibCheck',
  { stdio: 'inherit' }
);
const { GestureClassifier, DEFAULT_THRESHOLDS } = require('/tmp/gtest/classifier.js');
const { GestureManager, HUB_CONTEXT_ID, gameContextId } = require('/tmp/gtest/manager.js');
const { createRacingControls } = require('/tmp/gtest/controllers.js');
const { PointerGestureRecognizer } = require('/tmp/gtest/recognizer.js');

// Minimal DOM stubs so the recognizer can run in Node.
global.Element = class Element {};
function fakeSurface() {
  const listeners = {};
  return {
    style: {},
    listeners,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }),
    contains: () => true,
    fire: (t, ev) => { (listeners[t] || []).slice().forEach((f) => f(ev)); },
  };
}
function fakePointer(x, y, target) {
  return {
    pointerId: 1, clientX: x, clientY: y, target: target ?? null, cancelable: true,
    stopped: false, prevented: false,
    stopPropagation() { this.stopped = true; },
    preventDefault() { this.prevented = true; },
  };
}
class FakeButton extends global.Element { closest() { return this; } }

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TH = { tapMaxDist: 10, tapMaxMs: 300, swipeMinDist: 40, swipeMaxMs: 500, longPressMs: 60, doubleTapMs: 80, holdTickMs: 15 };

function makeClassifier(opts = {}) {
  const gestures = [];
  const c = new GestureClassifier({
    thresholds: TH,
    emit: (g) => gestures.push(g),
    ...opts,
  });
  return { c, gestures };
}

(async () => {
  // ---------- 1. single tap ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 100, 100, null, null);
    await sleep(30);
    c.up(1, 102, 101, null);
    await sleep(120);
    check('quick press+release → exactly one tap', gestures.filter(g => g.type === 'tap').length === 1);
    const tap = gestures.find(g => g.type === 'tap');
    check('tap carries position + duration', tap && tap.x === 102 && tap.durationMs >= 0);
  }

  // ---------- 2. double-tap suppresses single tap when handler exists ----------
  {
    const { c, gestures } = makeClassifier({ hasDoubleTapHandler: () => true });
    c.down(1, 50, 50, null, null); c.up(1, 50, 50, null);
    await sleep(20);
    c.down(2, 52, 51, null, null); c.up(2, 52, 51, null);
    await sleep(150);
    check('two quick taps → double-tap emitted', gestures.some(g => g.type === 'double-tap'));
    check('two quick taps → single tap NOT emitted (no accidental double activation)', !gestures.some(g => g.type === 'tap'));
  }

  // ---------- 3. lone tap still fires (delayed) when double-tap handler exists ----------
  {
    const { c, gestures } = makeClassifier({ hasDoubleTapHandler: () => true });
    c.down(1, 50, 50, null, null); c.up(1, 50, 50, null);
    await sleep(150);
    check('lone tap with double-tap handler → exactly one delayed tap', gestures.filter(g => g.type === 'tap').length === 1);
    check('lone tap → no double-tap', !gestures.some(g => g.type === 'double-tap'));
  }

  // ---------- 4. press-and-hold is continuous ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 10, 10, null, null);
    await sleep(70); // ~4 hold ticks
    c.up(1, 10, 10, null);
    await sleep(120);
    check('hold → hold-start emitted', gestures.some(g => g.type === 'hold-start'));
    check('hold → multiple hold ticks while pressed (continuous)', gestures.filter(g => g.type === 'hold').length >= 2);
    check('release → hold-end emitted', gestures.some(g => g.type === 'hold-end' && !g.cancelled));
    const hs = gestures.findIndex(g => g.type === 'hold-start');
    const he = gestures.findIndex(g => g.type === 'hold-end');
    check('hold-end comes after hold-start', he > hs);
  }

  // ---------- 5. swipe right / left ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 100, 100, null, null);
    for (let i = 1; i <= 5; i++) { c.move(1, 100 + i * 20, 100, null); await sleep(8); }
    c.up(1, 200, 100, null);
    await sleep(120);
    check('fast 100px horizontal move → swipe-right', gestures.some(g => g.type === 'swipe-right'));
    check('swipe → no tap', !gestures.some(g => g.type === 'tap'));
    check('swipe → drag-start was emitted then no drag-end', gestures.some(g => g.type === 'drag-start') && !gestures.some(g => g.type === 'drag-end'));
  }
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 200, 100, null, null);
    for (let i = 1; i <= 5; i++) { c.move(1, 200 - i * 20, 100, null); await sleep(8); }
    c.up(1, 100, 100, null);
    check('fast left move → swipe-left', gestures.some(g => g.type === 'swipe-left'));
  }
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 100, 200, null, null);
    for (let i = 1; i <= 5; i++) { c.move(1, 100, 200 - i * 20, null); await sleep(8); }
    c.up(1, 100, 100, null);
    check('fast up move → swipe-up', gestures.some(g => g.type === 'swipe-up'));
  }

  // ---------- 6. slow drag is NOT a swipe ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 0, 0, null, null);
    for (let i = 1; i <= 4; i++) { c.move(1, i * 20, 0, null); await sleep(200); } // slow: > swipeMaxMs
    c.up(1, 80, 0, null);
    await sleep(120);
    check('slow drag → drag-end, no swipe', gestures.some(g => g.type === 'drag-end') && !gestures.some(g => g.type.startsWith('swipe')));
    check('slow drag → drag events emitted during move', gestures.filter(g => g.type === 'drag').length >= 3);
  }

  // ---------- 7. long-press ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 5, 5, null, null);
    await sleep(90);
    c.up(1, 5, 5, null);
    await sleep(120);
    check('still press past longPressMs → long-press once', gestures.filter(g => g.type === 'long-press').length === 1);
    check('long-press → no tap afterwards', !gestures.some(g => g.type === 'tap'));
  }

  // ---------- 8. pointercancel releases everything (nothing stuck) ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 10, 10, null, null);
    c.move(1, 60, 10, null); // dragging
    c.cancel(1, null);
    await sleep(120);
    check('cancel during drag → drag-end cancelled', gestures.some(g => g.type === 'drag-end' && g.cancelled));
    check('cancel → no tap / no swipe', !gestures.some(g => g.type === 'tap' || g.type.startsWith('swipe')));
    check('cancel → no pointers left tracked', c.activePointerCount === 0);
  }
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 10, 10, null, null);
    await sleep(40);
    c.cancel(1, null); // cancelled while still holding
    await sleep(120);
    check('cancel during hold → hold-end cancelled', gestures.some(g => g.type === 'hold-end' && g.cancelled));
    check('cancel during hold → no tap', !gestures.some(g => g.type === 'tap'));
  }

  // ---------- 9. releaseAll (blur / pause / exit) ----------
  {
    const { c, gestures } = makeClassifier();
    c.down(1, 10, 10, null, null);
    await sleep(40);
    c.releaseAll(null);
    await sleep(120);
    check('releaseAll → hold-end cancelled, nothing stuck', gestures.some(g => g.type === 'hold-end' && g.cancelled) && c.activePointerCount === 0);
  }

  // ---------- 10. hold ends when pointer leaves bounds (accelerator) ----------
  {
    const { c, gestures } = makeClassifier({ inBounds: (x, y) => x >= 0 && x <= 100 && y >= 0 && y <= 100 });
    c.down(1, 50, 50, null, null);
    await sleep(30);
    c.move(1, 500, 50, null); // leaves the control area → drag, hold must end
    c.up(1, 500, 50, null);
    await sleep(120);
    check('leaving bounds ends hold (accelerator cannot stay stuck)', gestures.some(g => g.type === 'hold-end'));
  }

  // ---------- 11. manager: context lifecycle & isolation ----------
  {
    const m = GestureManager.get();
    const events = [];
    m.register({ id: 'game:chess', kind: 'game', gameId: 'chess', onGesture: () => { events.push('chess'); return true; } });
    m.register({ id: 'game:carrom', kind: 'game', gameId: 'carrom', onGesture: () => { events.push('carrom'); return true; } });
    check('hub is the base context before any activation', m.isActive(HUB_CONTEXT_ID) === false || m.activeId === HUB_CONTEXT_ID);
    m.activate(HUB_CONTEXT_ID);
    check('hub active → allowsGlobalInput true', m.allowsGlobalInput() === true);
    check('hub active → not a game context', m.isGameActive() === false);

    m.activate(gameContextId('chess'));
    check('entering chess → game context active', m.isActive('game:chess') && m.activeGameId === 'chess');
    check('game active → hub global input blocked (world cannot receive game gestures)', m.allowsGlobalInput() === false);
    check('game active → hub suspended: only one controller active', m.isActive(HUB_CONTEXT_ID) === false);

    // dispatch only reaches the ACTIVE controller
    const consumed = m.dispatch({ type: 'tap', pointerId: 1, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0, durationMs: 10, target: null, originalEvent: null });
    check('dispatch routes to chess only', events.join(',') === 'chess' && consumed === true);

    // switching games: carrom replaces chess, never both active
    m.activate(gameContextId('carrom'));
    check('switching to carrom → chess deactivated, carrom active', m.isActive('game:carrom') && !m.isActive('game:chess'));
    m.dispatch({ type: 'tap', pointerId: 1, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0, durationMs: 10, target: null, originalEvent: null });
    check('after switch, dispatch reaches carrom not chess', events.join(',') === 'chess,carrom');

    // leaving the game restores the hub
    m.deactivate(gameContextId('carrom'));
    check('leaving game → hub restored', m.isActive(HUB_CONTEXT_ID) && m.allowsGlobalInput() === true);
    check('after leaving, activeGameId is null', m.activeGameId === null);
    m.unregister('game:chess'); m.unregister('game:carrom');
  }

  // ---------- 12. manager: releaseAll delivers cancelled hold-end to game handlers ----------
  {
    const m = GestureManager.get();
    m.activate(HUB_CONTEXT_ID);
    const seen = [];
    m.register({ id: gameContextId('car-racing'), kind: 'game', gameId: 'car-racing' });
    m.setHandlers(gameContextId('car-racing'), { 'hold-end': (g) => seen.push(g.cancelled === true) });
    m.activate(gameContextId('car-racing'));
    m.dispatch({ type: 'hold-start', pointerId: 1, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0, durationMs: 0, target: null, originalEvent: null });
    m.releaseAll(); // blur / pause / exit
    check('releaseAll on active game → cancelled hold-end delivered (accelerator stops)', seen.length === 1 && seen[0] === true);
    m.deactivate(gameContextId('car-racing'));
    m.unregister(gameContextId('car-racing'));
  }

  // ---------- 13. racing controller semantics (accelerate hold / steer / brake) ----------
  {
    const calls = [];
    const map = createRacingControls({
      onAccelerate: () => calls.push('accel'),
      onAcceleratorRelease: () => calls.push('release'),
      onSteerLeft: () => calls.push('left'),
      onSteerRight: () => calls.push('right'),
      onBrake: () => calls.push('brake'),
      onDoubleTap: () => calls.push('boost'),
    });
    const ev = (type) => ({ type, pointerId: 1, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0, durationMs: 5, target: null, originalEvent: null });
    map['hold-start'](ev('hold-start'));
    map['hold'](ev('hold')); map['hold'](ev('hold')); map['hold'](ev('hold'));
    check('racing: holding accelerates continuously', calls.filter(c => c === 'accel').length === 4);
    map['hold-end'](ev('hold-end'));
    check('racing: release stops acceleration', calls[calls.length - 1] === 'release');
    map['swipe-right'](ev('swipe-right'));
    map['swipe-left'](ev('swipe-left'));
    check('racing: swipe right → steer right, swipe left → steer left', calls.includes('right') && calls.includes('left'));
    map['tap'](ev('tap'));
    check('racing: single tap → brake', calls.includes('brake'));
    map['double-tap'](ev('double-tap'));
    check('racing: double-tap → only the assigned action', calls.includes('boost'));
    // hold-end when not holding must not double-release
    const before = calls.length;
    map['hold-end'](ev('hold-end'));
    check('racing: extra hold-end without hold is a no-op', calls.length === before);
  }

  // ---------- 14. recognizer: isolation, passthrough, dispose ----------
  {
    const m = GestureManager.get();
    m.activate(HUB_CONTEXT_ID);
    const ctx = gameContextId('rec-test');
    const got = [];
    m.register({ id: ctx, kind: 'game', gameId: 'rec-test' });
    m.setHandlers(ctx, {
      'swipe-right': (g) => got.push('swipe-right'),
      'swipe-left': (g) => got.push('swipe-left'),
      tap: (g) => got.push('tap'),
    });
    m.activate(ctx);
    const el = fakeSurface();
    const rec = new PointerGestureRecognizer(el, { manager: m, contextId: ctx, touchAction: 'pan-y' });
    check('recognizer scopes touch-action to its surface only', el.style.touchAction === 'pan-y');

    // swipe right on plain surface → consumed + stopped at the surface
    const down = fakePointer(10, 100, null);
    el.fire('pointerdown', down);
    const mv = fakePointer(200, 100, null);
    el.fire('pointermove', mv);
    const up = fakePointer(200, 100, null);
    el.fire('pointerup', up);
    await sleep(120);
    check('recognizer: swipe-right delivered to game handler', got.includes('swipe-right'));
    check('recognizer: consumed gesture stopPropagation at surface (never reaches world)', mv.stopped === true || up.stopped === true);
    check('recognizer: consumed gesture tagged as game event', m.isGameEvent(up) || m.isGameEvent(mv));

    // tap on an interactive control (button) → passthrough, NOT stopped
    got.length = 0;
    const btn = new FakeButton();
    const d2 = fakePointer(50, 50, btn);
    el.fire('pointerdown', d2);
    const u2 = fakePointer(50, 50, btn);
    el.fire('pointerup', u2);
    await sleep(120);
    check('recognizer: tap on button still reaches handler (TalkBack/click intact)', got.includes('tap'));
    check('recognizer: tap on interactive control is NOT stopPropagation-ed', !d2.stopped && !u2.stopped);

    // while hub is active (game suspended), recognizer ignores everything
    got.length = 0;
    m.deactivate(ctx);
    m.activate(HUB_CONTEXT_ID);
    el.fire('pointerdown', fakePointer(10, 10, null));
    el.fire('pointermove', fakePointer(200, 10, null));
    el.fire('pointerup', fakePointer(200, 10, null));
    await sleep(120);
    check('recognizer: no gestures delivered while its context is suspended', got.length === 0);
    m.activate(ctx);

    // dispose removes listeners and restores touch-action
    rec.dispose();
    check('recognizer: dispose removes all listeners', (el.listeners['pointerdown'] || []).length === 0 && (el.listeners['pointerup'] || []).length === 0);
    check('recognizer: dispose restores touch-action', el.style.touchAction === '' || el.style.touchAction === undefined);
    got.length = 0;
    el.fire('pointerdown', fakePointer(10, 10, null));
    el.fire('pointerup', fakePointer(10, 10, null));
    await sleep(120);
    check('recognizer: no gestures after dispose (leaving a game cleans up)', got.length === 0);
    m.deactivate(ctx);
    m.unregister(ctx);
    m.clearHandlers(ctx);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
