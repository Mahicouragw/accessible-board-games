/* ==========================================================================
   ludo.js — Ludo. 2–4 players. Roll 6 to release, move around the track,
   capture opponents, climb the home column and win with an exact roll.
   Audio-first and keyboard/touch friendly.
   ========================================================================== */
(function (global) {
  'use strict';

  const G = global.HeroGames;
  const U = global.HeroUI;
  const sfx = U.sfx;
  const COLORS = ['#e5484d', '#2fbf71', '#ffd23f', '#5b7cfa'];
  const CNAMES = ['Red', 'Green', 'Yellow', 'Blue'];
  const OFFSETS = [0, 13, 26, 39];
  const SAFE = new Set([0, 13, 26, 39, 8, 21, 34, 47]);
  const FINISH = 56;

  const META = {
    id: 'ludo',
    title: 'Ludo',
    emoji: '🎲',
    desc: 'Classic race. Release your tokens with a 6, capture rivals and be first to bring all four home.',
    tags: ['Race', '2–4 players', 'MP'],
  };
  const OPTIONS = [
    { key: 'players', label: 'Players', type: 'select', default: '2', options: [['2', '2 players'], ['3', '3 players'], ['4', '4 players']] },
  ];

  function start(hostEl, cfg, api) {
    const net = api.net;
    const online = cfg.online || null;
    const players = parseInt(cfg.players || '2', 10);
    const state = {
      players: [], turn: 0, rolling: false, sixChain: 0, winner: null, done: false, lastRoll: 0,
    };
    for (let i = 0; i < players; i++) {
      state.players.push({
        name: 'Player ' + (i + 1), color: COLORS[i], cname: CNAMES[i], offset: OFFSETS[i],
        tokens: [0, 0, 0, 0].map(() => -1), // -1 base
        ai: false, freshSix: false,
      });
    }
    if (cfg.roster) {
      state.players = cfg.roster.slice(0, players).map((r, i) => ({
        name: r.name, color: COLORS[i], cname: CNAMES[i], offset: OFFSETS[i],
        tokens: [0, 0, 0, 0].map(() => -1), ai: !!r.ai, id: r.id,
      }));
    }
    const whoAmI = online ? (online.myIndex != null ? online.myIndex : state.players.findIndex((p) => p.id && api.profile && p.id === api.profile.id)) : null;

    let active = true;

    function boardCell(offset, prog) { return (offset + prog) % 52; }
    function isHomeToken(prog) { return prog >= 51 && prog <= FINISH; }
    function finishedToken(prog) { return prog === FINISH; }

    // Capture: find opponent tokens on same main cell (non-safe, non-home).
    function captureIfNeeded(playerIdx, prog) {
      const cell = boardCell(state.players[playerIdx].offset, prog);
      if (SAFE.has(cell)) return;
      state.players.forEach((p, j) => {
        if (j === playerIdx) return;
        p.tokens.forEach((t, k) => {
          if (t >= 0 && t <= 50 && boardCell(p.offset, t) === cell) {
            p.tokens[k] = -1;
            sfx('whoosh');
            U.say(p.name + ' is captured and sent back to the base!');
            broadcast();
          }
        });
      });
    }

    function render() {
      if (!active) return;
      U.clear(hostEl);
      const head = U.el('div', { class: 'screen-head' });
      head.appendChild(U.el('h2', null, ['Ludo']));
      head.appendChild(U.el('p', { class: 'muted' }, [players + ' players · bring all four tokens home to win']));
      hostEl.appendChild(head);

      const cur = state.players[state.turn];
      const isMyTurn = online ? state.turn === whoAmI : true;
      const rollRow = U.el('div', { class: 'roll-row' });
      rollRow.appendChild(U.el('span', { class: 'muted' }, [(online ? (state.turn === whoAmI ? 'You' : cur.name) : cur.name) + ' to roll']));
      const dice = U.el('div', { class: 'dice' }, [state.lastRoll ? String(state.lastRoll) : '?']);
      rollRow.appendChild(dice);
      const rollBtn = U.el('button', { class: 'btn btn-primary', type: 'button' }, ['🎲 Roll']);
      rollBtn.disabled = !isMyTurn || state.rolling || state.done;
      rollBtn.addEventListener('click', roll);
      rollRow.appendChild(rollBtn);
      hostEl.appendChild(rollRow);

      // Players tray
      const tray = U.el('div', { class: 'player-tray' });
      state.players.forEach((p, i) => {
        const pill = U.el('div', { class: 'player-pill' + (i === state.turn ? ' active' : '') });
        const home = p.tokens.filter((t) => t === FINISH).length;
        pill.appendChild(U.el('span', { class: 'dot', style: 'background:' + p.color + ';' }));
        pill.appendChild(U.el('span', null, [p.name + ' · ' + home + '/4 home']));
        tray.appendChild(pill);
      });
      hostEl.appendChild(tray);

      if (state.done) { renderWinner(); return; }

      // Board — folded main track (4 rows × 13) + home columns.
      const board = U.el('div', { class: 'board' });
      board.style.gap = '6px';
      const main = U.el('div', { class: 'board', style: 'grid-template-columns:repeat(13,1fr);gap:4px;' });
      for (let prog = 0; prog <= 50; prog++) {
        main.appendChild(cellFor(prog));
      }
      board.appendChild(main);
      // Home columns
      const homeRow = U.el('div', { class: 'board', style: 'grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;' });
      state.players.forEach((p, i) => {
        const col = U.el('div', { style: 'border:2px solid ' + p.color + ';border-radius:12px;padding:6px;' });
        col.appendChild(U.el('div', { class: 'hint' }, [p.name + ' home column']));
        for (let prog = 51; prog <= FINISH; prog++) {
          const c = U.el('div', { style: 'background:var(--surface-2);border:1px solid var(--border);border-radius:6px;height:34px;display:flex;align-items:center;justify-content:center;position:relative;' });
          p.tokens.forEach((t) => { if (t === prog) { c.appendChild(U.el('span', { class: 'dot', style: 'background:' + p.color + ';' })); } });
          if (prog === FINISH) c.appendChild(U.el('span', { class: 'hint' }, ['🏠']));
          col.appendChild(c);
        }
        homeRow.appendChild(col);
      });
      board.appendChild(homeRow);
      hostEl.appendChild(board);

      // Token controls for current player
      const movable = movableTokens(state.players[state.turn], state.lastRoll);
      if (movable.length && state.lastRoll) {
        const tp = state.players[state.turn];
        const trow = U.el('div', { class: 'roll-row' });
        trow.appendChild(U.el('span', { class: 'muted' }, ['Move a token']));
        movable.forEach((ti) => {
          const b = U.el('button', { class: 'btn', type: 'button' }, ['Token ' + (ti + 1)]);
          b.addEventListener('click', () => { moveToken(tp, ti, state.lastRoll); });
          trow.appendChild(b);
        });
        hostEl.appendChild(trow);
      }
    }

    function cellFor(prog) {
      const c = U.el('div', { class: 'ludo-cell tile' });
      c.style.background = 'var(--surface-2)';
      c.style.border = '1px solid var(--border)';
      c.style.borderRadius = '6px';
      c.style.display = 'flex'; c.style.alignItems = 'flex-end'; c.style.justifyContent = 'center';
      c.style.position = 'relative'; c.style.minHeight = '30px';
      c.style.fontSize = '0.6rem'; c.style.color = 'var(--ink-faint)';
      c.textContent = String(prog);
      if (SAFE.has(prog)) c.style.borderColor = 'var(--accent)';
      // place tokens for each player occupying this main cell
      state.players.forEach((p) => {
        p.tokens.forEach((t) => { if (t >= 0 && t <= 50 && boardCell(p.offset, t) === prog) { c.appendChild(tokensFor(p)); } });
      });
      return c;
    }
    let tokenSeq = 0;
    function tokensFor(p) {
      const dn = U.el('span', { class: 'dot', style: 'background:' + p.color + ';position:absolute;top:2px;' + (tokenSeq++ % 2 ? 'right:2px;' : 'left:2px;') });
      return dn;
    }

    function movableTokens(p, roll) {
      if (!roll) return [];
      const res = [];
      p.tokens.forEach((t, i) => {
        if (t === -1) {
          if (roll === 6 && p.tokens.filter((x) => x === -1).length > 0) res.push(i);
        } else if (t + roll <= FINISH) res.push(i);
      });
      return res;
    }

    function roll() {
      if (state.done || state.rolling) return;
      if (online && state.turn !== whoAmI) { U.say('Wait — not your turn.'); return; }
      const p = state.players[state.turn];
      state.rolling = true;
      sfx('diceShake');
      const value = Math.floor(Math.random() * 6) + 1;
      setTimeout(() => {
        state.lastRoll = value;
        sfx('diceRoll');
        sfx('click', { });
        U.say(p.name + ' rolled a ' + value + '.');
        const movables = movableTokens(p, value);
        if (!movables.length) {
          U.say('No moves available.');
          if (value === 6) { U.say('Rolling a 6... ' + (++state.sixChain) + ' in a row.'); if (state.sixChain >= 3) { U.say('Three sixes — turn forfeited!'); state.sixChain = 0; broadcast(); nextTurn(); return; } }
          // A 6 grants another roll if there are moves; else pass.
          if (value !== 6) { endTurn(); return; }
          render(); return;
        }
        state.sixChain = 0;
        render();
      }, 550);
    }

    function moveToken(p, ti, roll) {
      let t = p.tokens[ti];
      if (t === -1) { t = 0; U.say(p.name + ' releases a token onto the ' + boardCellFor(p, 0) + ' start square.'); p.tokens[ti] = t; animateTo(p, ti, 0); return; }
      // step-by-step movement
      const target = t + roll;
      stepMove(p, ti, t, target);
    }
    function boardCellFor(p, prog) { return boardCell(p.offset, prog); }

    function stepMove(p, ti, from, target) {
      let cur = from;
      const step = () => {
        if (cur === target) {
          // landing
          if (cur === FINISH) {
            U.sfx('chime');
            U.say(p.name + ' brings token ' + (ti + 1) + ' home!');
            if (p.tokens.every((x) => x === FINISH)) { state.done = true; state.winner = p; broadcast(); U.say(p.name + ' wins Ludo!'); render(); return; }
          } else if (cur >= 51) {
            U.sfx('wood');
            U.say(p.name + ' enters the home column.');
          } else {
            U.sfx('click', { pan: (cur % 13 - 6.5) / 6 });
            captureIfNeeded(state.turn, cur);
          }
          broadcast();
          render();
          endTurn();
          return;
        }
        cur += 1;
        p.tokens[ti] = cur;
        render();
        setTimeout(step, 200);
      };
      step();
    }

    function endTurn() {
      state.rolling = false;
      nextTurn();
    }
    function nextTurn() {
      state.turn = (state.turn + 1) % state.players.length;
      broadcast();
      render();
    }

    function renderWinner() {
      const wrap = U.el('div', { class: 'panel', style: 'margin-top:16px;text-align:center;' });
      wrap.appendChild(U.el('h2', { class: 'flash' }, [state.winner.name + ' wins! 🏆']));
      const again = U.el('button', { class: 'btn btn-primary' }, ['Play again']);
      again.addEventListener('click', () => { destroy(); start(hostEl, cfg, api); });
      wrap.appendChild(again);
      hostEl.appendChild(wrap);
    }

    /* --- online sync --- */
    function snapshot() {
      return {
        players: state.players.map((p) => ({ name: p.name, color: p.color, tokens: p.tokens.slice(), id: p.id, ai: p.ai })),
        turn: state.turn, lastRoll: state.lastRoll, winner: state.winner, done: state.done,
      };
    }
    function broadcast() {
      if (!online) return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state) return;
      room.state.ludo = snapshot();
      net.roomState(room.state);
    }
    function applyRemote() {
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state || !room.state.ludo) return;
      const st = room.state.ludo;
      state.players = st.players.map((p) => ({ name: p.name, color: p.color, cname: CNAMES[COLORS.indexOf(p.color) >= 0 ? COLORS.indexOf(p.color) : 0], offset: OFFSETS[COLORS.indexOf(p.color) >= 0 ? COLORS.indexOf(p.color) : 0], tokens: p.tokens.slice(), ai: !!p.ai, id: p.id }));
      state.turn = st.turn; state.lastRoll = st.lastRoll; state.winner = st.winner; state.done = st.done;
    }
    const onStateFn = function () { applyRemote(); render(); };
    net.on('state', onStateFn);

    function destroy() { active = false; try { net.off('state', onStateFn); } catch (e) {} U.clear(hostEl); }

    U.say('Ludo. ' + players + ' players. Roll a six to release a token. Get all four home to win. Three sixes in a row forfeit your turn.');
    render();
    return { destroy, state, render, roll };
  }

  G[META.id] = { meta: META, start, options: OPTIONS };
})(window);
