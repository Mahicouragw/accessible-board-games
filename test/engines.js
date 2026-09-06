/* Engine tests — bootstrap each game in jsdom and exercise its core logic. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'dangerously' });
const w = dom.window, d = w.document;
w.onerror = (m) => console.log('WINERROR', m);
w.requestAnimationFrame = (cb) => setTimeout(() => cb(), 0);
w.speechSynthesis = { getVoices: () => [], speak: () => {}, cancel: () => {} };
w.SpeechSynthesisUtterance = function (t) { this.text = t; };
if (!w.BroadcastChannel) w.BroadcastChannel = class { constructor() {} postMessage() {} set onmessage(f) {} };
for (const f of ['js/audio.js', 'js/store.js', 'js/net.js', 'js/common.js', 'js/cricket.js', 'js/snakes.js', 'js/ludo.js', 'js/carrom.js', 'js/rooms.js', 'js/app.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const G = w.HeroGames;
const api = { profile: { id: 'HB-X', name: 'Tester' }, store: w.HeroStore, net: w.HeroNet, audio: w.HeroAudio, ui: w.HeroUI };
function mk(cfg) { const el = d.createElement('div'); d.body.appendChild(el); const c = G[cfg.game].start(el, cfg.cfg, api); return { el, c }; }
let pass = true;
const jobs = [];
const T = (n, f) => {
  jobs.push(Promise.resolve().then(f).then(() => console.log('PASS', n)).catch((e) => { pass = false; console.log('FAIL', n, '->', e && e.message); }));
};

T('cricket AI start', () => { const { el, c } = mk({ game: 'cricket', cfg: { mode: 'ai', level: 2, overs: 2, squad: 1, youBatFirst: true } }); if (!el.querySelector('.numpad')) throw new Error('no numpad'); c.destroy(); });
T('cricket AI bat pick works', () => { const { c } = mk({ game: 'cricket', cfg: { mode: 'ai', level: 2, overs: 2, squad: 1, youBatFirst: true } }); c.submit('bat', 3, 'nor'); if (!(c.state.hist.length >= 1)) throw new Error('no ball'); c.destroy(); });
T('cricket AI bowl pick works', () => { const { c } = mk({ game: 'cricket', cfg: { mode: 'ai', level: 2, overs: 2, squad: 1, youBatFirst: false } }); c.submit('bowl', 4, 'agg'); if (!(c.state.hist.length >= 1)) throw new Error('no ball'); c.destroy(); });
T('cricket squad roster', () => { const { c } = mk({ game: 'cricket', cfg: { mode: 'ai', level: 3, overs: 2, squad: 3, youBatFirst: true } }); c.submit('bat', 5, 'agg'); if (c.state.sides.A.roster.length !== 3) throw new Error('roster'); c.destroy(); });

T('snakes local start', () => { const { el, c } = mk({ game: 'snakes', cfg: { mode: 'local', players: '2', ai: '0' } }); if (!el.querySelector('.board')) throw new Error('no board'); c.destroy(); });
T('snakes roll advances', async () => { const { c } = mk({ game: 'snakes', cfg: { mode: 'local', players: '2', ai: '0' } }); c.roll(); await new Promise(r => setTimeout(r, 3200)); if (!c.state.players.some(p => p.pos > 0)) throw new Error('no move'); c.destroy(); });

T('ludo local start', () => { const { el, c } = mk({ game: 'ludo', cfg: { mode: 'local', players: '2' } }); if (!el.querySelector('.board')) throw new Error('no board'); c.destroy(); });
T('ludo roll', async () => { const { c } = mk({ game: 'ludo', cfg: { mode: 'local', players: '2' } }); c.roll(); await new Promise(r => setTimeout(r, 700)); if (c.state.lastRoll < 1 || c.state.lastRoll > 6) throw new Error('bad roll'); c.destroy(); });

T('carrom start', async () => { const { el, c } = mk({ game: 'carrom', cfg: { mode: 'local', players: '2', coins: '6' } }); await new Promise(r => setTimeout(r, 30)); if (!el.querySelector('canvas')) throw new Error('no canvas'); c.destroy(); });
T('carrom aim & power', () => { const { c } = mk({ game: 'carrom', cfg: { mode: 'local', players: '2', coins: '6' } }); c.aimStep(1); c.powerStep(1); c.destroy(); });

T('local room create+join', async () => {
  const res = await w.HeroNet.createRoom({ game: 'cricket', meta: { seats: 2 }, adminId: 'HB-A', members: [{ id: 'HB-A', name: 'A', role: 'player', slot: 0 }], state: {} });
  if (res.error || !res.room.code) throw new Error('create failed');
  const res2 = await w.HeroNet.joinRoom(res.room.code, { id: 'HB-B', name: 'B', role: 'spectator', slot: null });
  if (res2.error) throw new Error('join failed ' + res2.error);
  if (!w.HeroNet.currentRoom() || w.HeroNet.currentRoom().members.length < 2) throw new Error('members not joined');
});

Promise.all(jobs).then(() => {
  console.log(pass ? '\nENGINES ALL PASS' : '\nENGINES SOME FAIL');
  process.exit(pass ? 0 : 1);
});
