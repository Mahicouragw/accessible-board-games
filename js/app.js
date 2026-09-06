/* ==========================================================================
   app.js — HeroBoard shell: router, auth, hub, settings, profile, setup,
   room and game launch. Binds the game registry to the UI.
   ========================================================================== */
(function (global) {
  'use strict';

  const store = global.HeroStore;
  const audio = global.HeroAudio;
  const ui = global.HeroUI;
  const net = global.HeroNet;
  const U = ui;

  const screens = {};
  let current = null;
  let profile = null;
  let pendingOnline = null; // { game, cfg } for guest auto-launch
  let activeGameController = null;
  let currentGame = null;

  /* ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function show(id) {
    Object.keys(screens).forEach((k) => { screens[k].hidden = k !== id; });
    current = id;
    if (id === 'game' && $('btn-back')) $('btn-back').hidden = false;
    if (id !== 'welcome') { if ($('btn-back')) $('btn-back').hidden = (id === 'game') ? false : (id === 'hub' ? true : true); }
    try { $('main').focus(); } catch (e) {}
    // speak the screen
    if (id === 'welcome') audio.announce('Welcome to HeroBoard. Choose an option to begin.');
  }

  function goBack() {
    audio.play('back');
    if (current === 'game') { exitGame(); }
    else if (current === 'room') { net.leave(); show('setup'); }
    else if (current === 'setup') show('hub');
    else if (current === 'settings' || current === 'profile') show('hub');
    else show('welcome');
  }

  /* ------------------------------------------------------------------ */
  function wireAppbar() {
    $('btn-back').addEventListener('click', goBack);
    $('btn-settings').addEventListener('click', () => { renderSettings(); show('settings'); });
  }

  /* ------------------------- WELCOME ------------------------------- */
  function wireWelcome() {
    $('btn-play').addEventListener('click', () => {
      audio.play('select');
      profile = store.current();
      if (profile) { updatePlayerChip(); show('hub'); renderHub(); }
      else { show('auth'); $('auth-name').focus(); }
    });
    $('btn-about').addEventListener('click', () => {
      audio.unlock();
      const p = $('about-panel'); p.hidden = !p.hidden;
      audio.play('select');
      if (!p.hidden) audio.announce('About HeroBoard. A zero copyright, audio first multiplayer board games hub.');
    });
    // update stats on welcome
    refreshWelcomeStats();
  }

  function refreshWelcomeStats() {
    const p = store.current();
    const st = store.getStats(p && p.id);
    $('stat-hc').textContent = String((st.cricket && st.cricket.played) || 0);
    let total = 0;
    Object.keys(st).forEach((g) => total += st[g].played || 0);
    $('stat-games').textContent = String(total);
    $('stat-rooms').textContent = '0';
  }

  /* ------------------------------------------------------------------ */
  function updatePlayerChip() {
    const chip = $('player-chip');
    if (profile) {
      chip.textContent = '🦸 ' + profile.name;
      chip.hidden = false; chip.title = 'Level ' + store.level(profile);
      $('btn-settings').hidden = false;
    } else {
      chip.hidden = true; $('btn-settings').hidden = true;
    }
  }

  /* ------------------------- AUTH ---------------------------------- */
  function wireAuth() {
    const form = $('auth-form');
    const name = $('auth-name');
    const msg = $('auth-msg');
    const submitBtn = $('auth-submit');

    async function handleSubmit(signinMode) {
      audio.unlock();
      const val = name.value.trim();
      const err = store.nameError(val);
      if (err) { showMsg(err, true); audio.play('error'); name.focus(); return; }
      submitBtn.disabled = true;
      showMsg('Checking name…', false);
      try {
        if (!signinMode) await store.checkUnique(val);
        // Create or re-claim profile.
        profile = { id: store.getProfile() && store.getProfile().name === val ? store.getProfile().id : genProfileId(val), name: val, created: Date.now() };
        if (store.getProfile() && store.getProfile().name === val) {
          // sign-in: reuse existing id
          profile.id = store.getProfile().id;
        } else {
          // ensure new id not colliding locally
        }
        store.signIn(profile);
        audio.play('chime');
        U.say('Welcome, ' + val + '. Your hero is ready. Choose a game.');
        showMsg('', false);
        updatePlayerChip();
        show('hub'); renderHub();
      } catch (e) {
        audio.play('error');
        showMsg(e.message, true);
      } finally { submitBtn.disabled = false; }
    }

    function genProfileId(name) {
      // deterministic-ish unique id
      const base = 'HB-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      return base;
    }
    function showMsg(t, err) {
      if (!t) { msg.hidden = true; return; }
      msg.hidden = false; msg.textContent = t; msg.className = 'msg ' + (err ? 'error' : 'ok');
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(false); });
    $('auth-signin').addEventListener('click', () => { audio.play('select'); handleSubmit(true); });
    name.addEventListener('input', () => {
      const v = name.value.trim();
      if (v && !store.nameValid(v)) { showMsg('Names use letters, numbers, hyphens or underscores and must be 3–24 characters.', true); }
      else showMsg('', false);
    });
  }

  /* ------------------------- HUB ----------------------------------- */
  function renderHub() {
    const grid = $('game-grid');
    U.clear(grid);
    Object.keys(global.HeroGames).forEach((id) => {
      const g = global.HeroGames[id];
      const card = U.el('div', { class: 'game-card', role: 'button', tabindex: '0', 'aria-label': 'Play ' + g.meta.title });
      card.appendChild(U.el('span', { class: 'gc-emoji' }, [g.meta.emoji]));
      card.appendChild(U.el('div', { class: 'gc-title' }, [g.meta.title]));
      card.appendChild(U.el('p', { class: 'gc-desc' }, [g.meta.desc]));
      const tags = U.el('div', { class: 'gc-tags' });
      (g.meta.tags || []).forEach((t) => tags.appendChild(U.el('span', { class: 'tag ' + (t === 'MP' ? 'hot' : '') }, [t])));
      card.appendChild(tags);
      const open = () => { audio.play('select'); openSetup(id); };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      grid.appendChild(card);
    });
  }

  /* ------------------------- SETUP --------------------------------- */
  function openSetup(gameId) {
    currentGame = gameId;
    const g = global.HeroGames[gameId];
    $('setup-title').textContent = 'New match · ' + g.meta.title;
    const body = $('setup-body');
    U.clear(body);

    // game options
    const cfg = {};
    (g.options || []).forEach((o) => cfg[o.key] = o.default);
    const optsBox = U.el('div');
    (g.options || []).forEach((o) => optsBox.appendChild(renderOption(o, cfg)));
    body.appendChild(U.el('h3', null, ['Match setup']));
    body.appendChild(optsBox);

    // mode selector
    body.appendChild(U.el('h3', null, ['Play mode']));
    const modeSeg = U.el('div', { class: 'seg' });
    const modeChoices = [
      { id: 'ai', label: '🤖 vs AI' },
      { id: 'local', label: '🖐 Local pass-&-play' },
      { id: 'online', label: '🌐 Online multiplayer' },
    ];
    let mode = 'ai';
    modeChoices.forEach((m) => {
      const b = U.el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': m.id === mode ? 'true' : 'false' }, [m.label]);
      b.addEventListener('click', () => {
        mode = m.id; audio.play('select');
        modeSeg.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        toggleOnlineControls();
      });
      modeSeg.appendChild(b);
    });
    body.appendChild(modeSeg);

    // online controls (hidden unless online)
    const onlineBox = U.el('div', { id: 'online-box' });
    const row = U.el('div', { class: 'roll-row' });
    const createBtn = U.el('button', { class: 'btn btn-primary', type: 'button' }, ['Create room']);
    createBtn.addEventListener('click', () => {
      profile = store.current(); if (!profile) { needAuth(); return; }
      audio.play('select');
      openRoom(gameId, cfg, true, null);
    });
    const joinBtn = U.el('button', { class: 'btn btn-ghost', type: 'button' }, ['Join a room']);
    joinBtn.addEventListener('click', () => {
      profile = store.current(); if (!profile) { needAuth(); return; }
      promptJoin(gameId, cfg);
    });
    row.appendChild(createBtn); row.appendChild(joinBtn);
    onlineBox.appendChild(U.el('p', { class: 'hint' }, ['Host a room and share the code, or enter a friend’s code. Up to ' + numSeats(gameId, cfg) + ' players.']));
    onlineBox.appendChild(row);
    onlineBox.hidden = true;
    body.appendChild(onlineBox);

    function toggleOnlineControls() { onlineBox.hidden = mode !== 'online'; }

    // Start (AI / local)
    const startBtn = U.el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button' }, ['▶ Start']);
    startBtn.addEventListener('click', () => {
      profile = store.current(); if (!profile) { needAuth(); return; }
      audio.play('select');
      launchGame(gameId, Object.assign({ mode }, cfg), profile);
    });
    body.appendChild(startBtn);

    show('setup');
    audio.announce('Set up ' + g.meta.title + '. Choose play mode and settings.');
  }

  function numSeats(game, cfg) {
    if (game === 'cricket' || game === 'carrom') return 2;
    return parseInt((cfg && cfg.players) || '2', 10);
  }

  function renderOption(o, cfg) {
    const field = U.el('div', { class: 'setting' });
    const text = U.el('div', { class: 'setting-text' });
    text.appendChild(U.el('span', { class: 'setting-title' }, [o.label]));
    if (o.hint) text.appendChild(U.el('span', { class: 'hint' }, [o.hint]));
    field.appendChild(text);
    if (o.type === 'select') {
      const sel = U.el('select');
      (o.options || []).forEach(([v, l]) => {
        const opt = U.el('option', { value: v }, [l]);
        if (String(v) === String(cfg[o.key])) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { cfg[o.key] = sel.value; audio.play('select'); });
      field.appendChild(sel);
    } else if (o.type === 'range') {
      const rng = U.el('input', { type: 'range', min: String(o.min), max: String(o.max), value: String(cfg[o.key]), 'aria-label': o.label });
      const lbl = U.el('span', { class: 'hint' }, [String(cfg[o.key])]);
      rng.addEventListener('input', () => { cfg[o.key] = parseInt(rng.value, 10); lbl.textContent = String(cfg[o.key]); }); 
      const wrap = U.el('div', { style: 'display:flex;flex-direction:column;gap:4px;' });
      wrap.appendChild(rng); wrap.appendChild(lbl);
      field.appendChild(wrap);
    }
    return field;
  }

  function needAuth() {
    audio.play('select');
    show('auth'); $('auth-name').focus();
  }

  /* ------------------------- ROOM ---------------------------------- */
  function openRoom(gameId, cfg, isAdmin, code) {
    show('room');
    const mount = ensureRoomMount();
    const me = { id: profile.id, name: profile.name };
    if (isAdmin) U.say('Room created. Share the code with a friend.');
    else U.say('Joining room ' + code + '. You are in the audience until a seat opens.');
    global.HeroRooms.mount(mount, {
      game: gameId, meta: cfg, me, isAdmin, code,
      onStart: (c) => launchGame(gameId, c, profile),
      onLeave: () => { show('hub'); renderHub(); },
    });
    pendingOnline = { game: gameId, cfg, code: isAdmin ? null : code };
    $('btn-back').hidden = false;
  }

  function ensureRoomMount() {
    const m = document.getElementById('room-mount');
    U.clear(m);
    return m;
  }

  function promptJoin(gameId, cfg) {
    openModal(function (body, close) {
      body.appendChild(U.el('h2', null, ['Join a room']));
      body.appendChild(U.el('p', { class: 'muted' }, ['Enter the 6-character room code shared by your friend.']));
      const input = U.el('input', { id: 'join-code', type: 'text', maxlength: 6, placeholder: 'e.g. ABC123', style: 'text-transform:uppercase;letter-spacing:.2em;font-weight:800;' });
      body.appendChild(input);
      const btn = U.el('button', { class: 'btn btn-primary btn-block', type: 'button' }, ['Join']);
      btn.addEventListener('click', () => {
        const code = input.value.trim().toUpperCase();
        if (code.length < 4) { U.say('Enter a valid room code.'); audio.play('error'); return; }
        close();
        openRoom(gameId, cfg, false, code);
      });
      body.appendChild(btn);
      setTimeout(() => input.focus(), 30);
    });
  }

  /* ------------------------- SETTINGS ------------------------------ */
  function renderSettings() {
    const s = store.getSettings();
    setSwitch('sw-sfx', s.sfx);
    setSwitch('sw-music', s.music);
    setSwitch('sw-voice', s.voice);
    setSwitch('sw-spatial', s.spatial);
    setSwitch('sw-motion', s.motion);
    document.querySelectorAll('#theme-seg .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === s.theme)));
    $('settings-id').textContent = profile ? profile.id : '—';
  }
  function setSwitch(id, on) { const b = $(id); b.setAttribute('aria-pressed', String(on)); }

  function wireSettings() {
    const bind = (id, key, announce) => {
      $(id).addEventListener('click', () => {
        const s = store.getSettings(); s[key] = !s[key]; store.saveSettings(s);
        setSwitch(id, s[key]); audio.play('select');
        U.say(announce(s));
      });
    };
    bind('sw-sfx', 'sfx', (s) => 'Sound effects ' + (s.sfx ? 'on' : 'off'));
    bind('sw-music', 'music', (s) => 'Music ' + (s.music ? 'on' : 'off'));
    bind('sw-voice', 'voice', (s) => 'Spoken guidance ' + (s.voice ? 'on' : 'off'));
    bind('sw-spatial', 'spatial', (s) => 'Spatial sound ' + (s.spatial ? 'on' : 'off'));
    bind('sw-motion', 'motion', (s) => 'Reduced motion ' + (s.motion ? 'on' : 'off'));
    document.querySelectorAll('#theme-seg .seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const s = store.getSettings(); s.theme = b.dataset.theme; store.saveSettings(s);
        document.querySelectorAll('#theme-seg .seg-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        U.say('Theme: ' + b.textContent);
      });
    });
    $('btn-copy-id').addEventListener('click', async () => {
      if (!profile) return;
      const ok = await store.copy(profile.id);
      U.say(ok ? 'Player ID copied.' : 'Unable to copy — your ID is ' + profile.id);
    });
    $('btn-copy-id-2').addEventListener('click', async () => {
      if (!profile) return;
      const ok = await store.copy(profile.id);
      U.say(ok ? 'Player ID copied.' : 'Unable to copy — your ID is ' + profile.id);
    });
    $('btn-signout').addEventListener('click', () => {
      audio.play('back'); store.signOut(); profile = null; updatePlayerChip();
      show('welcome'); refreshWelcomeStats();
      U.say('Signed out. See you soon.');
    });
  }

  /* ------------------------- PROFILE ------------------------------- */
  function renderOwnProfile() {
    const p = profile || store.current();
    if (!p) { show('auth'); return; }
    renderProfile(p, true);
    $('btn-copy-id-2').hidden = false;
  }
  function renderProfile(p, isMe) {
    const st = store.getStats(p.id);
    const tot = store.totals(p);
    $('p-avatar').textContent = p.name ? p.name[0].toUpperCase() : '?';
    $('p-name').textContent = p.name;
    $('p-id').textContent = 'ID: ' + p.id;
    const badges = $('p-badges'); U.clear(badges);
    badges.appendChild(U.el('span', { class: 'tag hot' }, ['Level ' + store.level(p)]));
    badges.appendChild(U.el('span', { class: 'tag' }, [tot.played + ' games']));
    badges.appendChild(U.el('span', { class: 'tag' }, ['Win rate ' + winRate(tot)] + '%'));
    const grid = $('p-stats'); U.clear(grid);
    const gridItems = [
      ['Games', tot.played], ['Wins', tot.wins], ['Win rate', winRate(tot)],
    ];
    gridItems.forEach(([k, v]) => grid.appendChild(U.el('div', { class: 'stat-cell' }, [U.el('strong', null, [String(v)]), U.el('span', null, [k])])));
    const games = $('p-games'); U.clear(games);
    const defs = global.HeroGames;
    if (Object.keys(st).length) {
      Object.keys(st).forEach((gid) => {
        const r = st[gid];
        const row = U.el('div', { class: 'slot' });
        row.appendChild(U.el('span', null, [(defs[gid] ? defs[gid].meta.emoji : '🎮')]));
        row.appendChild(U.el('span', { class: 'slot-name' }, [(defs[gid] ? defs[gid].meta.title : gid)]));
        row.appendChild(U.el('span', { class: 'slot-role' }, [r.played + ' played · ' + r.wins + ' wins' + (r.best ? ' · best ' + r.best : '')]));
        games.appendChild(row);
      });
    } else {
      games.appendChild(U.el('p', { class: 'muted' }, ['No games yet. Play one to build your record!']));
    }
    U.say(isMe ? 'Your profile. Level ' + store.level(p) + ', ' + tot.played + ' games, ' + tot.wins + ' wins.' : p.name + '. Level ' + store.level(p) + ', ' + tot.played + ' games.');
  }
  function winRate(tot) { return tot.played ? Math.round((tot.wins / tot.played) * 100) : 0; }

  /* ------------------------- MODAL --------------------------------- */
  function openModal(build) {
    const modal = $('modal'), body = $('modal-body');
    U.clear(body);
    build(body, close);
    modal.hidden = false;
    $('modal-close').onclick = close;
    function close() { modal.hidden = true; }
    function closeSignal() {}
  }

  /* ------------------------- GAME LAUNCH --------------------------- */
  function launchGame(gameId, cfg, me) {
    const g = global.HeroGames[gameId];
    if (!g) return;
    currentGame = gameId;
    show('game');
    const stage = $('game-stage');
    U.clear(stage);
    // online config: ensure profile + membership
    const api = {
      profile: me || store.current(),
      store, net, audio, ui,
      routeBack: goBack,
    };
    const resolvedCfg = Object.assign({}, cfg);
    if ((cfg.mode === 'online') && cfg.roster && !cfg.online) {
      // only local guest already in room; roster provided
    }
    if (cfg.mode !== 'online') resolvedCfg.roster = null;
    activeGameController = g.start(stage, resolvedCfg, api);
    // top bar
    $('btn-back').hidden = false;
  }

  function exitGame() {
    audio.stopAll(); // kill music/SFX/speech the moment the game screen closes
    try { if (activeGameController && activeGameController.destroy) activeGameController.destroy(); } catch (e) {}
    activeGameController = null;
    U.clear($('game-stage'));
    show('hub'); renderHub();
  }

  /* ------------------------- online guest auto-launch ---------------- */
  function wireNetGuestStart() {
    net.on('game:start', function () {
      // only responds if we're a guest waiting in a room
      if (!pendingOnline || !pendingOnline.code || current !== 'room' || activeGameController) return;
      const room = net.currentRoom && net.currentRoom();
      if (!room) return;
      const players = room.members.filter((m) => m.role === 'player').sort((a, b) => (a.slot || 0) - (b.slot || 0));
      const roster = players.map((m) => ({ id: m.id, name: m.name, slot: m.slot }));
      const myIndex = roster.findIndex((r) => r.id === profile.id);
      const mySide = (myIndex === 1 && (pendingOnline.game === 'cricket' || pendingOnline.game === 'carrom')) ? 'B' : 'A';
      const cfg = Object.assign({}, pendingOnline.cfg, {
        mode: 'online',
        online: { code: pendingOnline.code, mySide, myIndex },
        roster,
      });
      launchGame(pendingOnline.game, cfg, profile);
    });
  }

  /* ------------------------------------------------------------------ */
  let inited = false;
  /* ------------------------- OFFLINE / CONNECTIVITY ----------------------- */
  function showOffline() {
    const o = $('offline');
    if (o) o.hidden = false;
    U.alertSay('No internet connection. Your internet is interrupted. Please check your internet and try again.');
  }
  function hideOffline() {
    const o = $('offline');
    if (o && !o.hidden) { o.hidden = true; audio.announce('Back online. You can keep playing.'); }
  }
  function syncConnectivity() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) showOffline();
    else hideOffline();
  }
  function wireConnectivity() {
    window.addEventListener('online', hideOffline);
    window.addEventListener('offline', showOffline);
    window.addEventListener('load', syncConnectivity);
    // Also re-check after a short delay (network can drop after load).
    setTimeout(syncConnectivity, 500);
    const rel = $('offline-reload');
    if (rel) rel.addEventListener('click', function () { try { location.reload(); } catch (e) {} });

    // Hard-stop all game audio the moment the tab is hidden or about to close,
    // so the music/SFX never keeps playing after you leave or close the tab.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) audio.stopAll();
      else audio.resumeAll();
    });
    window.addEventListener('pagehide', function () { audio.stopAll(); });
    window.addEventListener('beforeunload', function () { audio.stopAll(); });
  }

  function init() {
    if (inited) return; // guard against double DOMContentLoaded
    inited = true;
    // register screens
    ['welcome', 'auth', 'hub', 'settings', 'profile', 'setup', 'room', 'game'].forEach((id) => screens[id] = $('screen-' + id));
    screens['game'] = $('screen-game');

    store.applySettings();
    wireAppbar(); wireWelcome(); wireAuth(); wireSettings();
    wireNetGuestStart(); wireConnectivity();

    // Connection chip
    const chip = $('conn-chip');
    if (net.online && net.online()) { chip.textContent = 'Online'; chip.classList.add('ok'); }
    else { chip.textContent = 'Offline demo'; chip.hidden = false; }

    // Live voice for static items
    audio.announce('HeroBoard loaded.');

    profile = store.current();
    updatePlayerChip();
    show('welcome');

    // Ensure audio voices list loads.
    if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = function () { }; speechSynthesis.getVoices(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
