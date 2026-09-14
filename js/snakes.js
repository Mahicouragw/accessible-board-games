/* ==========================================================================
   snakes.js — Snakes & Ladders. 2–4 players, dice, step-by-step tile
   movement with per-tile announcements, snakes, ladders, wins.
   ========================================================================== */
(function (global) {
  'use strict';

  const G = global.HeroGames;
  const U = global.HeroUI;
  const sfx = U.sfx;
  const COLORS = ['#33e0c8', '#ff7a59', '#ffd23f', '#8b8bf0'];

  const META = {
    id: 'snakes',
    title: 'Snakes & Ladders',
    emoji: '🐍',
    desc: 'Roll the dice and climb the ladders, dodge the snakes. 2–4 players, pass-and-play or online.',
    tags: ['Dice', '2–4 players', 'MP'],
  };

  const OPTIONS = [
    { key: 'players', label: 'Players', type: 'select', default: '2', options: [['2', '2 players'], ['3', '3 players'], ['4', '4 players']] },
    { key: 'ai', label: 'Fill empty seats with AI', type: 'select', default: '0', options: [['0', 'No AI'], ['1', 'Yes']] },
  ];

  const LADDERS = { 3: 22, 8: 30, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
  const SNAKES = { 16: 6, 47: 26, 62: 19, 64: 60, 87: 24, 93: 73, 98: 78 };

  function start(hostEl, cfg, api) {
    const net = api.net;
    const online = cfg.online || null;
    const players = parseInt(cfg.players || '2', 10);
    const state = {
      players: [],
      turn: 0,
      dice: 0,
      rolling: false,
      winner: null,
      done: false,
    };
    const aiEnabled = (cfg.ai === '1' || cfg.ai === true) && !online;
    // Build roster: local players, with optional AI seats for "vs AI" play.
    for (let i = 0; i < players; i++) {
      // When playing against AI, seat 0 is the human; every other seat is AI.
      const isAI = aiEnabled ? i > 0 : false;
      state.players.push({ name: (aiEnabled && i > 0) ? 'AI ' + (i) : 'Player ' + (i + 1), pos: 0, color: COLORS[i], ai: isAI });
    }
    // In online mode the roster derives from the room's players set in rooms.js
    // via cfg.roster; fall back to Player i names otherwise.
    if (online && cfg.roster) {
      state.players = cfg.roster.map((r, i) => ({ name: r.name, pos: 0, color: COLORS[i % 4], ai: false, id: r.id }));
    } else if (cfg.roster) {
      state.players = cfg.roster.map((r, i) => ({ name: r.name, pos: 0, color: COLORS[i % 4], ai: !!r.ai, id: r.id }));
    }
    const nPlayers = state.players.length;
    const myIndex = online ? state.players.findIndex((p) => api.profile && p.id === api.profile.id) : -1;
    const whoAmI = online ? (online.myIndex != null ? online.myIndex : myIndex) : null;

    getStateRemote();

    let active = true;
    function getStateRemote() {
      const room = net.currentRoom ? net.currentRoom() : null;
      if (room && room.state) {
        // Rehydrate from shared state (used on join and after remote moves).
        const st = room.state.snxs;
        if (st) Object.assign(state, {
          players: st.players.map((p) => ({ name: p.name, pos: p.pos || 0, color: p.color, ai: false, id: p.id })),
          turn: st.turn || 0, dice: st.dice || 0, winner: st.winner || null, done: !!st.done,
        });
      }
    }
    function broadcast() {
      if (!online) return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state) return;
      const st = room.state;
      st.snxs = { players: state.players.map((p) => ({ name: p.name, pos: p.pos || 0, color: p.color, id: p.id })), turn: state.turn, dice: state.dice, winner: state.winner, done: state.done };
      net.roomState(st);
    }
    const onStateFn = function () { getStateRemote(); render(); };
    net.on('state', onStateFn);

    function render() {
      if (!active) return;
      U.clear(hostEl);
      const head = U.el('div', { class: 'screen-head' });
      head.appendChild(U.el('h2', null, ['Snakes & Ladders']));
      head.appendChild(U.el('p', { class: 'muted' }, [players + ' player' + (players > 1 ? 's' : '') + ' · reach square 100 to win']));
      hostEl.appendChild(head);

      // Roll control + current turn
      const current = state.players[state.turn];
      const rollRow = U.el('div', { class: 'roll-row' });
      const isMyTurn = online ? state.turn === whoAmI : true;
      const who = online ? (state.turn === whoAmI ? 'You' : current.name) : current.name;
      rollRow.appendChild(U.el('span', { class: 'muted' }, [who + ' to roll']));
      const dice = U.el('div', { class: 'dice' }, [state.dice ? String(state.dice) : '?']);
      rollRow.appendChild(dice);
      const isAiPlayer = !online && current && current.ai;
      const rollBtn = U.el('button', { class: 'btn btn-primary', type: 'button' }, [isAiPlayer ? '🤖 AI rolls…' : '🎲 Roll']);
      rollBtn.disabled = !isMyTurn || state.rolling || state.done || (isAiPlayer && !online);
      rollBtn.addEventListener('click', roll);
      rollRow.appendChild(rollBtn);
      hostEl.appendChild(rollRow);

      // Player tray
      const tray = U.el('div', { class: 'player-tray' });
      state.players.forEach((p, i) => {
        const pill = U.el('div', { class: 'player-pill' + (i === state.turn ? ' active' : '') });
        pill.appendChild(U.el('span', { class: 'dot', style: 'background:' + p.color + ';' }));
        pill.appendChild(U.el('span', null, [p.name + ' · ' + p.pos]));
        tray.appendChild(pill);
      });
      hostEl.appendChild(tray);

      if (state.done) { renderWinner(); return; }

      // Board
      const board = U.el('div', { class: 'board', role: 'group', 'aria-label': 'Snakes and ladders board' });
      board.style.gridTemplateColumns = 'repeat(10, 1fr)';
      for (let n = 100; n >= 1; n--) {
        const cell = U.el('div', { class: 'ludo-cell tile' });
        cell.style.background = tileColor(n);
        cell.style.border = '1px solid var(--border)';
        cell.style.borderRadius = '6px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
        cell.style.position = 'relative';
        cell.style.fontSize = '0.7rem';
        cell.style.color = '#0a0f1e';
        cell.textContent = String(n);
        // tokens
        state.players.forEach((p) => {
          if (p.pos === n) {
            const dot = U.el('span', { class: 'dot', style: 'background:' + p.color + ';position:absolute;right:4px;bottom:4px;width:12px;height:12px;' });
            cell.appendChild(dot);
          }
        });
        board.appendChild(cell);
      }
      hostEl.appendChild(board);
    }

    function tileColor(n) {
      return (n % 2 === 0) ? '#efe3c8' : '#d9c9a3';
    }

    function roll() {
      if (state.done || state.rolling) return;
      if (online && state.turn !== whoAmI) { U.say('Wait — it is not your turn.'); return; }
      const p = state.players[state.turn];
      state.rolling = true;
      broadcast();
      sfx('diceShake');
      let steps = Math.floor(Math.random() * 6) + 1;
      const from = p.pos;
      const target = Math.min(100, from + steps);
      U.say(p.name + ' rolled a ' + steps + '. Moving from square ' + from + ' to square ' + target + '.');
      diceAnimate(steps, () => {
        moveToken(p, steps, () => {
          state.rolling = false;
          nextTurn();
        });
      });
    }

    function diceAnimate(steps, cb) {
      const dice = hostEl.querySelector('.dice');
      let i = 0;
      const iv = setInterval(() => {
        if (dice) dice.textContent = String(Math.floor(Math.random() * 6) + 1);
        i++;
        if (i >= 8) {
          clearInterval(iv);
          if (dice) dice.textContent = String(steps);
          setTimeout(cb, 250);
        }
      }, 70);
    }

    // Step-by-step movement — one synchronized "tick" per square (audio-first).
    function moveToken(p, steps, cb) {
      let cur = p.pos;
      const step = (i) => {
        if (i >= steps) {
          // landing resolution
          if (LADDERS[cur]) {
            sfx('steps', { });
            U.say(p.name + ' lands on ' + cur + ' and climbs the ladder to ' + LADDERS[cur] + '!');
            cur = LADDERS[cur];
            p.pos = cur;
            cb();
            return;
          }
          if (SNAKES[cur]) {
            sfx('snake');
            U.say(p.name + ' lands on ' + cur + ' and slides down the snake to ' + SNAKES[cur] + '!');
            cur = SNAKES[cur];
            p.pos = cur;
            cb();
            return;
          }
          p.pos = cur;
          decideWin(p, cb);
          return;
        }
        cur = Math.min(100, cur + 1);
        sfx('stepTick');            // crisp tick synced to each square
        render();                   // token visually lands one square at a time
        setTimeout(() => step(i + 1), 340);
      };
      step(0);
    }

    function decideWin(p, cb) {
      if (p.pos === 100) { state.winner = p; state.done = true; broadcast(); sfx('winFanfare'); U.say(p.name + ' reaches 100 and wins!'); render(); cb(); return; }
      cb();
    }

    function nextTurn() {
      state.turn = (state.turn + 1) % state.players.length;
      state.rolling = false;
      broadcast();
      const p = state.players[state.turn];
      if (!online && p && p.ai) {
        setTimeout(() => { roll(); }, 900); // AI thinks then rolls
      }
      render();
    }

    function renderWinner() {
      const wrap = U.el('div', { class: 'panel', style: 'margin-top:16px;text-align:center;' });
      wrap.appendChild(U.el('h2', { class: 'flash' }, [state.winner.name + ' wins! 🏆']));
      const again = U.el('button', { class: 'btn btn-primary', type: 'button' }, ['Play again']);
      again.addEventListener('click', () => { destroy(); start(hostEl, cfg, api); });
      wrap.appendChild(again);
      hostEl.appendChild(wrap);
    }

    function destroy() { active = false; try { net.off('state', onStateFn); } catch (e) {} U.clear(hostEl); }

    U.say('Snakes and Ladders. ' + players + ' players. First to square 100 wins. Roll the dice when it is your turn.');
    render();
    return { destroy, state, render, roll };
  }

  G[META.id] = { meta: META, start, options: OPTIONS };
})(window);
