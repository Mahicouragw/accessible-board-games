/* ==========================================================================
   rooms.js — Room lobby, admin slot assignment, spectators, live chat and
   the hook that boots an online game with a roster.
   ========================================================================== */
(function (global) {
  'use strict';

  const U = global.HeroUI;
  const sfx = U.sfx;
  const R = {};
  const net = global.HeroNet;

  // How many player seats each game needs (host chooses; default).
  function defaultSeats(game, meta) {
    if (game === 'cricket') return 2;
    if (game === 'carrom') return 2;
    // snakes / ludo
    const p = meta && meta.players ? parseInt(meta.players, 10) : 2;
    return p;
  }
  function seatLabels(game, n) {
    if (game === 'cricket') return ['Team A', 'Team B'];
    if (game === 'carrom') return ['White', 'Black'];
    return Array.from({ length: n }, (_, i) => 'Player ' + (i + 1));
  }

  /* -----------------------------------------------------------------
     mount(hostEl, opts)
       opts: { game, meta, me:{id,name}, isAdmin, code?, onStart(cfg), onLeave() }
     ----------------------------------------------------------------- */
  R.mount = function (hostEl, opts) {
    const game = opts.game;
    const seats = defaultSeats(game, opts.meta);
    if (game !== 'cricket' && game !== 'carrom') seats = Math.max(seats, 2);

    let room = null;      // current room object (from net)
    let myRole = opts.isAdmin ? 'admin' : 'player';
    let chatEl = null;

    function meMember() { return { id: opts.me.id, name: opts.me.name }; }

    /* --- create or join --- */
    function boot() {
      if (opts.isAdmin) {
        // host creates: occupies seat 0, others automatic.
        return net.createRoom({
          game,
          meta: Object.assign({ seats }, opts.meta || {}),
          adminId: opts.me.id,
          members: [Object.assign({ id: opts.me.id, name: opts.me.name, role: 'player', slot: 0 }, {})],
          state: { running: false },
        }).then((res) => { if (res.error) { fail(res.error); return; } room = res.room; wire(); render(); });
      } else {
        // guest joins as spectator, waits for assignment.
        return net.joinRoom(opts.code, { id: opts.me.id, name: opts.me.name, role: 'spectator', slot: null })
          .then((res) => { if (res.error) { fail(res.error); return; } room = res.room; wire(); render(); });
      }
    }

    function fail(msg) { U.alertSay(msg); renderError(msg); }

    function wire() {
      net.on('room:update', (r) => { if (r && r.code === opts.code) { room = r; render(); } });
      net.on('state', (st) => { /* room-level game state; app handles */ });
      net.on('chat', (msgs) => { appendChat(msgs); });
      net.on('presence', () => {});
    }

    /* --- rendering --- */
    function render() {
      U.clear(hostEl);
      if (!room) return;
      const isAdmin = room.adminId === opts.me.id;

      const head = U.el('div', { class: 'room-head' });
      const t = U.el('div');
      t.appendChild(U.el('h2', null, ['Room ' + (opts.code || room.code)]));
      t.appendChild(U.el('p', { class: 'muted' }, [gameName(game) + ' · ' + (isAdmin ? 'You are the host' : 'Joined as ' + myRole)]));
      head.appendChild(t);
      const codeBox = U.el('div', { class: 'room-code' });
      codeBox.appendChild(U.el('span', { class: 'hint' }, ['Share code']));
      const codeBtn = U.el('button', { class: 'code', id: 'room-code' }, [room.code]);
      codeBtn.addEventListener('click', () => { copyCode(); });
      codeBox.appendChild(codeBtn);
      const copyBtn = U.el('button', { class: 'btn btn-ghost btn-sm' }, ['Copy']);
      copyBtn.addEventListener('click', copyCode);
      codeBox.appendChild(copyBtn);
      head.appendChild(codeBox);
      hostEl.appendChild(head);

      const body = U.el('div', { class: 'room-body' });
      const left = U.el('div', { class: 'col' });
      left.appendChild(renderSlots(isAdmin));
      left.appendChild(renderSpectators(isAdmin));
      body.appendChild(left);
      const right = U.el('div', { class: 'col' });
      right.appendChild(renderChat(isAdmin));
      body.appendChild(right);
      hostEl.appendChild(body);

      const actions = U.el('div', { class: 'room-actions' });
      const startBtn = U.el('button', { class: 'btn btn-primary btn-lg', type: 'button' }, ['▶ Start game']);
      startBtn.disabled = !isAdmin || !playersReady();
      startBtn.addEventListener('click', start);
      actions.appendChild(startBtn);
      const leaveBtn = U.el('button', { class: 'btn btn-ghost', type: 'button' }, ['Leave']);
      leaveBtn.addEventListener('click', () => { net.leave(); if (opts.onLeave) opts.onLeave(); });
      actions.appendChild(leaveBtn);
      hostEl.appendChild(actions);
    }

    function renderError(msg) {
      U.clear(hostEl);
      hostEl.appendChild(U.el('h2', null, ['Could not join room']));
      hostEl.appendChild(U.el('p', { class: 'muted' }, [msg]));
      const back = U.el('button', { class: 'btn', type: 'button' }, ['Back']);
      back.addEventListener('click', () => { if (opts.onLeave) opts.onLeave(); });
      hostEl.appendChild(back);
    }

    function playersReady() {
      // at least 2 players assigned (for a match) — or as many as seats.
      return room.members.filter((m) => m.role === 'player').length >= Math.min(2, seats);
    }

    function slots() {
      const arr = [];
      const label = seatLabels(game, seats);
      for (let i = 0; i < seats; i++) arr.push({ index: i, label: label[i], member: room.members.find((m) => m.role === 'player' && m.slot === i) });
      return arr;
    }

    function renderSlots(isAdmin) {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h3', null, ['Player seats']));
      const list = U.el('ul', { class: 'slot-list' });
      slots().forEach((sk) => {
        const li = U.el('li', { class: 'slot ' + (sk.member ? 'filled' : 'empty') });
        li.appendChild(U.el('span', null, [sk.label + ':']));
        if (sk.member) {
          const nm = U.el('span', { class: 'slot-name' }, [U.esc(sk.member.name)]);
          nm.addEventListener('click', () => inspect(sk.member));
          li.appendChild(nm);
          if (isAdmin && sk.member.id !== opts.me.id) li.appendChild(adminButtons(sk.member));
        } else {
          li.appendChild(U.el('span', { class: 'slot-name' }, [ 'Empty' ]));
          if (isAdmin) {
            const pending = unassigned();
            if (pending.length) {
              const pick = pending[0];
              const b = U.el('button', { class: 'btn btn-sm' }, ['Assign ' + U.esc(pick.name)]);
              b.addEventListener('click', () => net.admit(pick.id, { role: 'player', slot: sk.index }));
              li.appendChild(b);
            }
          }
        }
        list.appendChild(li);
      });
      wrap.appendChild(list);
      return wrap;
    }

    function unassigned() { return room.members.filter((m) => m.role === 'spectator'); }

    function renderSpectators(isAdmin) {
      const wrap = U.el('div', { id: 'spectator-wrap' });
      wrap.appendChild(U.el('h3', null, ['Spectators / audience']));
      const list = U.el('ul', { class: 'slot-list muted-list' });
      const specs = room.members.filter((m) => m.role === 'spectator');
      if (!specs.length) { list.appendChild(U.el('li', { class: 'slot empty' }, [U.el('span', { class: 'slot-name' }, ['No spectators yet. Share the code!']) ])); }
      specs.forEach((m) => {
        const li = U.el('li', { class: 'slot' });
        li.appendChild(U.el('span', { class: 'slot-emoji' }, ['👀']));
        const nm = U.el('span', { class: 'slot-name' }, [U.esc(m.name)]);
        nm.addEventListener('click', () => inspect(m));
        li.appendChild(nm);
        if (isAdmin && m.id !== opts.me.id) li.appendChild(adminButtons(m));
        list.appendChild(li);
      });
      wrap.appendChild(list);
      return wrap;
    }

    function adminButtons(m) {
      const c = U.el('div', { class: 'slot-controls' });
      if (m.role === 'spectator') {
        const promote = U.el('button', { class: 'mini-btn' }, ['Add to seat']);
        promote.addEventListener('click', () => { const free = slots().find((s) => !s.member); if (free) net.admit(m.id, { role: 'player', slot: free.index }); else U.say('No free seats. Move someone to the audience first.'); });
        c.appendChild(promote);
      } else {
        const spect = U.el('button', { class: 'mini-btn' }, ['Move to audience']);
        spect.addEventListener('click', () => net.admit(m.id, { role: 'spectator', slot: null }));
        c.appendChild(spect);
      }
      return c;
    }

    /* --- profile inspection (audio friendly) --- */
    function inspect(member) {
      const p = apiStore().getStats ? apiStore().getStats(member.id) : {};
      const tot = apiStore().totals ? apiStore().totals({ id: member.id }) : { played: 0 };
      U.say(member.name + '. Level ' + (member.id === opts.me.id ? apiStore().level({ id: member.id }) : estimateLevel(member.id)) + '. Games played ' + (tot.played || 0) + '.');
    }
    function estimateLevel(id) { const t = apiStore().totals({ id }); return Math.max(1, 1 + Math.floor((t.played || 0) / 4)); }
    function apiStore() { return global.HeroStore; }

    /* --- chat --- */
    function renderChat() {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h3', null, ['Live chat']));
      chatEl = U.el('div', { class: 'chat', 'aria-live': 'polite' });
      wrap.appendChild(chatEl);
      const form = U.el('form', { class: 'chat-form' });
      const input = U.el('input', { id: 'chat-input', type: 'text', placeholder: 'Say something…', maxlength: 200 });
      input.setAttribute('aria-label', 'Chat message');
      const send = U.el('button', { class: 'btn btn-primary', type: 'submit' }, ['Send']);
      form.appendChild(input); form.appendChild(send);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const t = input.value.trim();
        if (!t) return;
        net.sendChat(t);
        input.value = '';
      });
      wrap.appendChild(form);
      return wrap;
    }

    function appendChat(msgs) {
      if (!chatEl) return;
      const arr = Array.isArray(msgs) ? msgs : [msgs];
      arr.forEach((m) => {
        const mine = (m.user_id === opts.me.id);
        const div = U.el('div', { class: 'chat-msg' + (mine ? ' mine' : '') });
        div.appendChild(U.el('span', { class: 'who' }, [U.esc(m.name || 'Anonymous')]));
        div.appendChild(U.el('span', { class: 'body' }, [U.esc(m.text)]));
        chatEl.appendChild(div);
        // speak incoming messages for audio-first chat
        if (!mine) U.say((m.name || '') + ' says: ' + m.text);
        else U.say('Message sent.');
        sfx('select');
      });
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    function copyCode() {
      const code = room ? room.code : opts.code;
      global.HeroStore.copy(code).then((ok) => { U.say(ok ? 'Room code copied' : 'Copy the code manually: ' + code); });
    }

    function start() {
      if (!playersReady()) { U.say('Assign at least two players to seats.'); return; }
      const playerSeats = slots().filter((s) => s.member).sort((a, b) => a.index - b.index);
      const roster = playerSeats.map((sk) => ({ id: sk.member.id, name: sk.member.name, slot: sk.index }));
      // Determine this client's membership.
      let mySide = 'A', myIndex = 0;
      if (game === 'cricket' || game === 'carrom') {
        mySide = roster.findIndex((r) => r.id === opts.me.id) === 1 ? 'B' : 'A';
      }
      myIndex = roster.findIndex((r) => r.id === opts.me.id);
      if (myIndex < 0) myIndex = 0;
      const cfg = {
        mode: 'online',
        online: { code: room.code, mySide, myIndex },
        roster,
        // carry game-specific options
        level: (opts.meta && opts.meta.level) || 1,
        overs: (opts.meta && opts.meta.overs) || 2,
        squad: (opts.meta && opts.meta.squad) || 1,
        players: (opts.meta && opts.meta.players) || String(roster.length) || '2',
        coins: (opts.meta && opts.meta.coins) || '6',
      };
      net.startGame();
      if (opts.onStart) opts.onStart(cfg);
    }

    function gameName(id) {
      const map = { cricket: 'Hand Cricket', snakes: 'Snakes & Ladders', ludo: 'Ludo', carrom: 'Carrom' };
      return map[id] || id;
    }

    boot();
    return { leave: function () {}, render };
  };

  global.HeroRooms = R;
})(window);
