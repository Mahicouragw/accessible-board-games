/* Smoke test — boot the app in jsdom and drive the key UI flows. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:5500/', pretendToBeVisual: true, runScripts: 'dangerously' });
const { window, window: w } = dom;
const { document: d } = window;

window.onerror = (m) => console.log('WINERROR', m);
window.requestAnimationFrame = (cb) => setTimeout(() => cb(), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
if (window.HTMLCanvasElement) window.HTMLCanvasElement.prototype.getContext = function () { return window.__ctx || (window.__ctx = new Proxy({ canvas: {} }, { get: (t, k) => k in t ? t[k] : (t[k] = () => {}), set: (t, k, v) => (t[k] = v, true) })); };
window.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {} };
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
if (!window.BroadcastChannel) window.BroadcastChannel = class { constructor() {} postMessage() {} set onmessage(f) {} };

const order = ['js/audio.js', 'js/store.js', 'js/net.js', 'js/common.js', 'js/cricket.js', 'js/snakes.js', 'js/ludo.js', 'js/carrom.js', 'js/rooms.js', 'js/app.js'];
for (const f of order) { window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
d.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const $ = (id) => d.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let allPass = true;
const T = async (n, fn) => { try { await fn(); console.log('PASS', n); } catch (e) { allPass = false; console.log('FAIL', n, '->', e && e.message); } };

(async () => {
  await T('welcome visible', () => { if ($('screen-welcome').hidden) throw new Error('welcome hidden'); });

  await T('play → auth', () => { click($('btn-play')); if ($('screen-auth').hidden) throw new Error('auth hidden'); });

  await T('create hero (unique name)', async () => {
    const nm = $('auth-name'); nm.value = 'Goldfish'; nm.dispatchEvent(new window.Event('input', { bubbles: true }));
    $('auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await sleep(60);
    if ($('screen-hub').hidden) throw new Error('hub not shown');
  });

  await T('hub lists 4 games', () => {
    const n = d.querySelectorAll('#game-grid .game-card').length;
    if (n !== 4) throw new Error('expected 4, got ' + n);
  });

  await T('duplicate name warning', async () => {
    // sign out, try creating the same name → warning
    click($('btn-settings'));
    click($('btn-signout'));
    click($('btn-play'));
    const nm = $('auth-name'); nm.value = 'Goldfish'; nm.dispatchEvent(new window.Event('input', { bubbles: true }));
    $('auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await sleep(40);
    const msg = $('auth-msg');
    if (!msg || msg.hidden || !/already used/i.test(msg.textContent)) throw new Error('no duplicate warning: ' + (msg && msg.textContent));
  });

  // sign back in with existing id
  await T('sign in with existing name', async () => {
    const nm = $('auth-name'); nm.value = 'Goldfish';
    click($('auth-signin'));
    await sleep(40);
    if ($('screen-hub').hidden) throw new Error('hub not shown');
  });

  await T('cricket vs AI end-to-end', async () => {
    const card = [...d.querySelectorAll('#game-grid .game-card')].find((c) => c.textContent.includes('Hand Cricket'));
    click(card);
    if ($('screen-setup').hidden) throw new Error('setup not shown');
    const start = [...d.querySelectorAll('#screen-setup .btn-primary')].find((b) => b.textContent.includes('Start'));
    click(start);
    if ($('screen-game').hidden) throw new Error('game not shown');
    if (d.querySelectorAll('#game-stage .numpad button').length !== 6) throw new Error('numpad wrong');
    click(d.querySelector('#game-stage .numpad button'));
    await sleep(40);
    const st = d.querySelector('#game-stage .run-announce');
    if (!st || !st.textContent) throw new Error('no status');
    click($('btn-back'));
  });

  await T('snakes local end-to-end', async () => {
    const card = [...d.querySelectorAll('#game-grid .game-card')].find((c) => c.textContent.includes('Snakes'));
    click(card);
    click([...d.querySelectorAll('#screen-setup .seg .seg-btn')].find((b) => b.textContent.includes('pass')));
    click([...d.querySelectorAll('#screen-setup .btn-primary')].find((b) => b.textContent.includes('Start')));
    if (!d.querySelector('#game-stage .board')) throw new Error('no board');
    const roll = [...d.querySelectorAll('#game-stage button')].find((b) => b.textContent.includes('Roll'));
    click(roll);
    await sleep(200);
    click($('btn-back'));
  });

  await T('ludo local end-to-end', async () => {
    const card = [...d.querySelectorAll('#game-grid .game-card')].find((c) => c.textContent.includes('Ludo'));
    click(card);
    click([...d.querySelectorAll('#screen-setup .seg .seg-btn')].find((b) => b.textContent.includes('pass')));
    click([...d.querySelectorAll('#screen-setup .btn-primary')].find((b) => b.textContent.includes('Start')));
    if (!d.querySelector('#game-stage .board')) throw new Error('no board');
    click($('btn-back'));
  });

  await T('carrom local end-to-end', async () => {
    const card = [...d.querySelectorAll('#game-grid .game-card')].find((c) => c.textContent.includes('Carrom'));
    click(card);
    click([...d.querySelectorAll('#screen-setup .seg .seg-btn')].find((b) => b.textContent.includes('pass')));
    click([...d.querySelectorAll('#screen-setup .btn-primary')].find((b) => b.textContent.includes('Start')));
    await sleep(60);
    const shot = [...d.querySelectorAll('#game-stage button')].find((b) => b.textContent.includes('Shoot'));
    if (!shot) throw new Error('no shoot btn');
    click(shot);
  });

  await T('settings toggles persist', async () => {
    click($('btn-back'));
    click($('btn-settings'));
    click($('sw-music'));
    if (window.HeroStore.getSettings().music !== true) throw new Error('music not toggled');
  });

  await T('stats API works', () => {
    const id = window.HeroStore.current().id;
    const st = window.HeroStore.getStats(id);
    if (typeof st !== 'object') throw new Error('no stats object');
    window.HeroStore.recordGame(id, 'cricket', 'win', { runs: 12, wickets: 0, balls: 6, best: 12 });
    if (window.HeroStore.getStats(id).cricket.played !== 1) throw new Error('recordGame failed');
  });

  console.log(allPass ? '\nSMOKE ALL PASS' : '\nSMOKE SOME FAIL');
  process.exit(allPass ? 0 : 1);
})();
