/* Online Hand Cricket — host-authoritative resolution test (single window). */
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

const G = w.HeroGames, net = w.HeroNet, store = w.HeroStore;
const api = { profile: { id: 'HB-HOST', name: 'Host' }, store, net, audio: w.HeroAudio, ui: w.HeroUI };

async function main() {
  const res = await net.createRoom({ game: 'cricket', meta: { seats: 2 }, adminId: 'HB-HOST', members: [{ id: 'HB-HOST', name: 'Host', role: 'player', slot: 0 }], state: { running: false } });
  if (res.error) throw new Error('create failed ' + res.error);
  if (!net.currentRoom()) throw new Error('currentRoom undefined after create');

  const el = d.createElement('div'); d.body.appendChild(el);
  const c = G.cricket.start(el, { mode: 'online', online: { code: res.room.code, mySide: 'A', myIndex: 0 }, roster: [{ id: 'HB-HOST', name: 'Host', slot: 0 }, { id: 'HB-GUEST', name: 'Guest', slot: 1 }], level: 2, overs: 1, squad: 1 }, api);

  c.submit('bat', 4, 'agg');
  const st0 = net.currentRoom().state;
  if (!st0.mailbox || !st0.mailbox.bat) throw new Error('host bat pick not in mailbox');

  const room = net.currentRoom();
  room.state.mailbox.bowl = { n: 3, delivery: 'nor' };
  net.roomState(room.state);

  await new Promise((r) => setTimeout(r, 250));
  if (c.state.hist.length < 1) throw new Error('host did not resolve the ball: hist=' + c.state.hist.length);
  const snap = net.currentRoom().state.snap;
  if (!snap || snap.ballNo !== 1) throw new Error('snapshot not advanced: ' + JSON.stringify(snap && snap.ballNo));
  if (net.currentRoom().state.mailbox.bat || net.currentRoom().state.mailbox.bowl) throw new Error('mailbox not cleared');

  // Guest hydrates from the snapshot the host broadcast.
  const el2 = d.createElement('div'); d.body.appendChild(el2);
  const g2 = G.cricket.start(el2, { mode: 'online', online: { code: res.room.code, mySide: 'B', myIndex: 1 }, roster: [{ id: 'HB-HOST', name: 'Host', slot: 0 }, { id: 'HB-GUEST', name: 'Guest', slot: 1 }], level: 2, overs: 1, squad: 1 }, api);
  await new Promise((r) => setTimeout(r, 50));
  if (g2.state.ballNo !== c.state.ballNo) throw new Error('guest did not hydrate: ' + g2.state.ballNo + ' vs ' + c.state.ballNo);

  console.log('ONLINE CRICKET PASS');
  c.destroy(); g2.destroy();
  process.exit(0);
}
main().catch((e) => { console.log('ONLINE CRICKET FAIL', e.message); process.exit(1); });
