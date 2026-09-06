/* ==========================================================================
   carrom.js — Accessible Carrom. Aim the striker with the arrow keys/buttons,
   set power and shoot. Physics on a canvas, coins, pockets, queens. Spatial
   audio lets you “hear” the board (Free-Fire style sound orientation).
   ========================================================================== */
(function (global) {
  'use strict';

  const G = global.HeroGames;
  const U = global.HeroUI;
  const sfx = U.sfx;
  const COLORS = ['#ffffff', '#20242f', '#e5b04b'];

  const META = {
    id: 'carrom',
    title: 'Carrom',
    emoji: '🎯',
    desc: 'Strike the striker, pocket your coins first, and use spatial sound to line up your shot. 2 players or vs AI.',
    tags: ['Physics', 'Spatial sound', 'MP'],
  };
  const OPTIONS = [
    { key: 'players', label: 'Players', type: 'select', default: '2', options: [['2', '2 players (local)'], ['1', '1 player vs AI']] },
    { key: 'coins', label: 'Coins each', type: 'select', default: '6', options: [['6', '6'], ['9', '9']] },
  ];

  function start(hostEl, cfg, api) {
    const net = api.net;
    const online = cfg.online || null;
    const players = parseInt(cfg.players || '2', 10) || 2;
    const vsAI = players === 1;
    const perSide = parseInt(cfg.coins || '6', 10);

    const state = {
      players: [{ name: 'White', color: COLORS[0] }, { name: 'Black', color: COLORS[1] }],
      turn: 0, phase: 'aim', winner: null, done: false,
    };
    let canvas, ctx, W, H, cx, cy, R;

    // World objects
    const striker = { x: 0, y: 0, vx: 0, vy: 0, r: 17, live: true, inPlay: true };
    let coins = [];
    let queen = null;
    let aim = 90;   // degrees, 90 = up (canvas y-down)
    let power = 0.5;
    let running = false;
    let pocketedThisTurn = [];
    let active = true;

    function initWorld() {
      coins = [];
      // place coins around center in a ring
      const n = perSide;
      const cradius = 14;
      const ring = R * 0.42;
      // white and black coins alternate in a circle, queen center
      queen = { x: cx, y: cy, vx: 0, vy: 0, r: cradius + 1, color: COLORS[2], queen: true, owner: null };
      const count = 3 * n; // 2 sides + queen
      const angles = [];
      for (let i = 0; i < count; i++) angles.push((i / count) * Math.PI * 2);
      // white coins: many around center + outer; simple: 3 rings of coins
      const ringRads = [0.12, 0.24, 0.34].map((k) => R * k);
      let ai = 0;
      for (let ring = 0; ring < Math.min(3, n / 3 >= 1 ? 3 : 2); ring++) {
        const items = ring === 0 ? 6 : ring === 1 ? 12 : 12;
        for (let j = 0; j < items; j++) {
          const a = (j / items) * Math.PI * 2 + ring * 0.2;
          const color = ((ai++) % 2 === 0) ? COLORS[0] : COLORS[1];
          if (coins.length >= 2 * n) break;
          coins.push({ x: cx + Math.cos(a) * ringRads[ring], y: cy + Math.sin(a) * ringRads[ring], vx: 0, vy: 0, r: cradius, color, owner: color === COLORS[0] ? 0 : 1 });
        }
      }
      // ensure exactly 2*n (+queen). fill if short
      let idx = 0;
      while (coins.length < 2 * n) coins.push({ x: cx + Math.cos(idx) * R * 0.2, y: cy + Math.sin(idx) * R * 0.2, vx: 0, vy: 0, r: cradius, color: (idx % 2 ? COLORS[1] : COLORS[0]), owner: idx % 2 ? 1 : 0, });
      placeStriker();
    }

    function placeStriker() {
      striker.x = cx;
      striker.y = cy + R * 0.62;
      striker.vx = 0; striker.vy = 0;
      striker.live = true;
    }

    function setup() {
      canvas = U.el('canvas');
      canvas.className = 'carrom-board';
      canvas.setAttribute('aria-label', 'Carrom board');
      canvas.tabIndex = 0;
      hostEl.appendChild(canvas);
      const avail = (window.innerWidth || 480) - 24;
      W = canvas.width = Math.min(520, Math.max(300, avail));
      H = canvas.height = W;
      ctx = canvas.getContext('2d');
      cx = W / 2; cy = H / 2; R = W / 2 - 8;
      canvas.addEventListener('keydown', onKey);
      initWorld();
      render();
    }

    /* --- input --- */
    function aimStep(dir) {
      // panner sound at the aim direction so you can hear where you aim.
      const rad = aim * Math.PI / 180;
      const pan = Math.cos(rad); // -1 left .. +1 right
      sfx('ping', { pan });
      aim = (aim + dir * 15 + 360) % 360;
      U.say('Aiming ' + Math.round(aim) + ' degrees.');
      render();
    }
    function powerStep(dir) {
      power = Math.max(0.15, Math.min(1, power + dir * 0.1));
      U.sfx('click', { pan: power - 0.5 });
      U.say('Power ' + Math.round(power * 100) + ' percent.');
      render();
    }
    function shoot() {
      if (state.done) return;
      if (online && state.turn !== (online.myIndex != null ? online.myIndex : 0)) { U.say('Wait — not your turn.'); return; }
      const rad = aim * Math.PI / 180;
      // canvas y-down: angle 90 = up (negative y)
      const speed = power * (R / 1.5);
      striker.vx = -Math.sin(rad) * speed;
      striker.vy = -Math.cos(rad) * speed;
      sfx('thud');
      U.say(state.players[state.turn].name + ' shoots.');
      state.phase = 'sim';
      running = true;
      requestAnimationFrame(tick);
    }

    function tick() {
      if (!running) return;
      step();
      render();
      // check stopped
      if (striker.speed() < 1.2 && allSlow()) { running = false; resolveTurn(); }
      else requestAnimationFrame(tick);
    }
    function allSlow() { return striker.speed() < 1.2 && coins.every((c) => Math.hypot(c.vx, c.vy) < 1.2); }

    function step() {
      const dt = 0.9;
      if (striker.live) {
        striker.x += striker.vx * dt; striker.y += striker.vy * dt;
        striker.vx *= 0.99; striker.vy *= 0.99;
      }
      coins.forEach((c) => { c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.988; c.vy *= 0.988; });
      if (queen) { queen.x += queen.vx * dt; queen.y += queen.vy * dt; queen.vx *= 0.988; queen.vy *= 0.988; }
      // collisions
      collide(striker, true);
      coins.forEach((c) => collide(c, false));
      if (queen) collide(queen, false);
      // pockets
      checkPockets();
    }

    function collide(o, isStriker) {
      if (!o) return;
      const bodies = [striker.live ? striker : null, ...coins.filter((c) => !c.pocketed), queen && !queen.pocketed ? queen : null].filter(Boolean);
      bodies.forEach((b) => {
        if (b === o) return;
        const dx = o.x - b.x, dy = o.y - b.y;
        const d = Math.hypot(dx, dy);
        const minD = o.r + b.r;
        if (d > 0 && d < minD) {
          const nx = dx / d, ny = dy / d;
          const overlap = minD - d;
          o.x += nx * overlap * 0.5; o.y += ny * overlap * 0.5;
          b.x -= nx * overlap * 0.5; b.y -= ny * overlap * 0.5;
          // simple impulse
          const rel = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.82;
            o.vx += nx * imp; o.vy += ny * imp;
            b.vx -= nx * imp; b.vy -= ny * imp;
          }
          if (Math.abs(rel) > 0.5) sfx('thud');
        }
      });
      // keep striker inside board (slide along edge) unless near pocket center
      constrain(o);
    }

    function constrain(o) {
      const d = Math.hypot(o.x - cx, o.y - cy);
      const maxR = R - o.r;
      if (d > maxR) {
        const nx = (o.x - cx) / d, ny = (o.y - cy) / d;
        o.x = cx + nx * maxR; o.y = cy + ny * maxR;
        // reflect a bit
        const dot = o.vx * nx + o.vy * ny;
        if (dot > 0) { o.vx -= 2 * dot * nx; o.vy -= 2 * dot * ny; }
        o.vx *= 0.98; o.vy *= 0.98;
      }
    }

    function pockets() {
      const pr = R * 0.75 * 5;
      const pts = [];
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, r: R * 0.055 });
      }
      return pts;
    }
    function checkPockets() {
      const ps = pockets();
      const pucker = (o) => ps.some((p) => Math.hypot(o.x - p.x, o.y - p.y) < p.r);
      if (striker.live && pucker(striker)) { striker.live = false; sfx('whoosh'); }
      coins.forEach((c) => { if (!c.pocketed && pucker(c)) { c.pocketed = true; pocketedThisTurn.push(c.owner); sfx('thud'); } });
      if (queen && !queen.pocketed && pucker(queen)) { queen.pocketed = true; pocketedThisTurn.push('queen'); sfx('thud'); }
    }

    function resolveTurn() {
      const p = state.players[state.turn];
      const pock = pocketedThisTurn;
      let msg;
      if (striker.live === false) {
        sfx('error');
        msg = p.name + ' sunk the striker — a foul! The turn passes.';
        state.turn = (state.turn + 1) % 2;
        if (online) broadcast();
      } else {
        const owned = pock.filter((k) => typeof k === 'number' && k === state.turn).length;
        const opp = pock.filter((k) => typeof k === 'number' && k !== state.turn).length;
        if (pock.length) {
          sfx('chime');
          msg = p.name + ' pocketed ' + pock.length + ' piece' + (pock.length > 1 ? 's' : '') + (queen && pock.includes('queen') ? ' including the queen!' : '') + '. They shoot again.';
          state.phase = 'aim';
          placeStriker();
          if (opp > 0) { /* opponent coins pocketed count toward opponent but only own coins truly capture for own—simplify: each scores own */ }
          // queen bonus handling simplified
        } else {
          msg = p.name + ' missed. ' + state.players[(state.turn + 1) % 2].name + ' is up.';
          state.turn = (state.turn + 1) % 2;
        }
      }
      pocketedThisTurn = [];
      placeStriker();
      striker.live = true;
      broadcast();
      U.say(msg);
      checkWin();
      render();
    }

    function remaining(player) { return coins.filter((c) => !c.pocketed && c.owner === player).length; }
    function checkWin() {
      if (remaining(0) === 0) win(0); else if (remaining(1) === 0) win(1);
    }
    function win(i) {
      if (state.done) return;
      state.winner = i; state.done = true; sfx('chime');
      U.say(state.players[i].name + ' has cleared all their coins and wins Carrom!');
      broadcast();
      render();
    }

    /* --- rendering --- */
    function render() {
      if (!active) return;
      const head = hostEl.querySelector('.screen-head');
      // Rebuild controls + status above canvas.
      if (head) head.remove();
      const headEl = U.el('div', { class: 'screen-head' });
      headEl.appendChild(U.el('h2', null, ['Carrom' + (vsAI ? ' · vs AI' : online ? ' · online' : ' · local')]));
      const cur = state.players[state.turn];
      const isMyTurn = online ? state.turn === (online.myIndex != null ? online.myIndex : 0) : true;
      headEl.appendChild(U.el('p', { class: 'muted' }, [(online ? (state.turn === (online.myIndex != null ? online.myIndex : 0) ? 'You' : cur.name) : cur.name) + (state.done ? ' — ' + state.players[state.winner].name + ' wins!' : ' to shoot')]));
      hostEl.insertBefore(headEl, hostEl.firstChild);

      const controls = hostEl.querySelector('.carrom-controls');
      if (!controls) { initControls(); }
      if (!canvas) return;
      draw();
    }

    function initControls() {
      const ctrl = U.el('div', { class: 'carrom-controls panel', style: 'margin-top:14px;' });
      ctrl.appendChild(U.el('h3', null, ['Controls']));
      const row = U.el('div', { class: 'roll-row' });
      const wrap = (label, fn) => { const b = U.el('button', { class: 'btn', type: 'button' }, [label]); b.addEventListener('click', (e) => { e.currentTarget.blur(); fn(); }); row.appendChild(b); return b; };
      wrap('↩️ Left', () => aimStep(-1));
      wrap('Right ↗️', () => aimStep(1));
      wrap('Power −', () => powerStep(-1));
      wrap('Power +', () => powerStep(1));
      const shootB = wrap('🔥 Shoot', shoot);
      ctrl.appendChild(row);
      ctrl.appendChild(U.el('p', { class: 'hint' }, ['Use the on-screen buttons or your arrow keys. Left/Right aim, Up/Down power, Space to shoot. Listen for the directional pings.']));
      hostEl.appendChild(ctrl);
    }
    function onKey(e) {
      if (e.key === 'ArrowLeft') { aimStep(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { aimStep(1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { powerStep(1); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { powerStep(-1); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { shoot(); e.preventDefault(); }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // board
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#8a5a2b'; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = '#4a3014'; ctx.stroke();
      // pockets
      pockets().forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = '#1a1208'; ctx.fill(); });
      // center circle
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.12, 0, Math.PI * 2); ctx.strokeStyle = '#6d451d'; ctx.lineWidth = 3; ctx.stroke();
      // queen
      if (queen && !queen.pocketed) drawCoin(queen);
      coins.forEach((c) => { if (!c.pocketed) drawCoin(c); });
      // striker
      if (striker.live) drawStriker();
    }
    function drawCoin(c) {
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = c.color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
      if (c.queen) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.4, 0, Math.PI * 2); ctx.fillStyle = '#7a2d2d'; ctx.fill(); }
    }
    function drawStriker() {
      const rad = aim * Math.PI / 180;
      ctx.beginPath(); ctx.arc(striker.x, striker.y, striker.r, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e8ea'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#333'; ctx.stroke();
      // aim arrow
      const ax = striker.x - Math.sin(rad) * striker.r * 1.6;
      const ay = striker.y - Math.cos(rad) * striker.r * 1.6;
      ctx.beginPath(); ctx.moveTo(striker.x, striker.y); ctx.lineTo(ax, ay);
      ctx.strokeStyle = '#33e0c8'; ctx.lineWidth = 4; ctx.stroke();
      // power bar
      ctx.fillStyle = '#33e0c8';
      ctx.fillRect(striker.x - 20, striker.y + striker.r + 6, 40 * power, 5);
    }

    /* --- online sync --- */
    function snapshot() {
      return {
        players: state.players.map((p) => p.name), turn: state.turn, winner: state.winner, done: state.done,
        queue: pocketedThisTurn, phase: state.phase,
      };
    }
    function broadcast() {
      if (!online) return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state) return;
      room.state.carrom = snapshot();
      net.roomState(room.state);
    }
    const onStateFn = function () { applyRemote(); render(); };
    function applyRemote() {
      if (!online) return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state || !room.state.carrom) return;
      const st = room.state.carrom;
      state.turn = st.turn; state.winner = st.winner; state.done = st.done;
    }
    net.on('state', onStateFn);

    function destroy() {
      active = false; running = false;
      try { net.off('state', onStateFn); } catch (e) {}
      if (canvas) canvas.removeEventListener('keydown', onKey);
      U.clear(hostEl);
    }

    U.say('Carrom. ' + (vsAI ? 'You play White against the AI.' : 'White and Black take turns.') + ' Aim with left and right, set power with up and down, then shoot. Pocket all your coins to win.');
    setup();

    return { destroy, state, render, shoot, aimStep, powerStep };
  }

  G[META.id] = { meta: META, start, options: OPTIONS };
})(window);
