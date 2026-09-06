/* ==========================================================================
   cricket.js — Advanced Hand Cricket. Tactical shots & deliveries, level
   progression, team/squad formats, dynamic run rates, Man of the Match.
   Modes: vs-AI, local pass-&-play, online (two sides over a room).
   ========================================================================== */
(function (global) {
  'use strict';

  const G = global.HeroGames;
  const U = global.HeroUI;

  const META = {
    id: 'cricket',
    title: 'Hand Cricket',
    emoji: '🏏',
    desc: 'Pick 1–6. Match the bowler and you are OUT. Choose shots and deliveries, chase run rates and win Man of the Match.',
    tags: ['Tactical', 'MP', 'AI'],
  };

  const NUMBERS = [1, 2, 3, 4, 5, 6];
  const SHOTS = [
    { id: 'def', label: 'Defensive', tall: 'Safe. Rarely big, rarely out.' },
    { id: 'nor', label: 'Balanced', tall: 'The all-round shot.' },
    { id: 'agg', label: 'Aggressive', tall: 'Bigger hits, higher risk.' },
  ];
  const DELIVERIES = [
    { id: 'def', label: 'Defensive', tall: 'Smothers runs.' },
    { id: 'nor', label: 'Balanced', tall: 'Steady line and length.' },
    { id: 'agg', label: 'Attacking', tall: 'Goes for the wicket.' },
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);

  /* Runner-up choice for the setup schema */
  const OPTIONS = [
    { key: 'level', label: 'Tactical level', type: 'range', min: 1, max: 5, default: 2, hint: 'Level 1 = classic quick. Higher levels add shots, deliveries, required-rate pressure. Stronger opponents.' },
    { key: 'overs', label: 'Overs per side (1 over = 6 balls)', type: 'select', default: '2', options: [['1', '1 over (6 balls)'], ['2', '2 overs (12 balls)'], ['3', '3 overs (18 balls)'], ['5', '5 overs (30 balls)'], ['10', '10 overs (60 balls)'], ['20', '20 overs (120 balls)']], hint: 'Every 6 balls is one over (like a real game).' },
    { key: 'squad', label: 'Players per side (team size)', type: 'select', default: '1', options: [['1', 'Single (1 v 1)'], ['2', 'Pair (2 v 2)'], ['3', 'Squad (3 v 3)'], ['5', 'Team (5 v 5)'], ['11', 'Full team (11 v 11)']], hint: 'Choose 11 for a full team like real cricket.' },
    { key: 'wickets', label: 'Wickets per side', type: 'select', default: '1', options: [['1', '1 wicket'], ['6', '6 wickets'], ['7', '7 wickets'], ['8', '8 wickets'], ['9', '9 wickets'], ['10', '10 wickets'], ['11', '11 wickets'], ['15', '15 wickets'], ['16', '16 wickets'], ['17', '17 wickets']], hint: 'How many outs before the side is all out. Pick 10 for a full 11-a-side innings.' },
    { key: 'youBatFirst', label: 'First innings', type: 'select', default: 'true', options: [['true', 'You bat first (AI bowls)'], ['false', 'You bowl first (AI bats)']], hint: 'This sets who acts first when playing the AI.' },
  ];

  /* ---------------------------------------------------------------------
     Referee — pure function: (batPick, bowlPick, level) → ball result.
     --------------------------------------------------------------------- */
  function resolveBall(bat, bowl, level) {
    const shot = (bat && bat.shot) || 'nor';
    const deliv = (bowl && bowl.delivery) || 'nor';
    const same = bat.n === bowl.n;
    let runs = 0, out = false, four = false, six = false, dot = false, escape = false;

    if (same) {
      let p = 0.82;
      if (shot === 'def') p -= 0.18;
      if (shot === 'agg') p += 0.04;
      if (deliv === 'agg') p += 0.06;
      if (deliv === 'def') p -= 0.06;
      if (level >= 4) p += 0.02;
      p = clamp(p, 0.3, 0.97);
      out = Math.random() < p;
      if (!out) escape = true; // rare lucky escape
      dot = !out;
    } else {
      runs = bat.n;
      if (shot === 'def') {
        if (Math.random() < 0.35) runs = Math.min(runs, 1);
      } else if (shot === 'agg') {
        if (Math.random() < 0.18) runs = Math.min(6, runs + 1);
        if (Math.random() < 0.13) { out = true; runs = 0; }
      }
      if (deliv === 'agg') {
        if (!out && Math.random() < 0.10) { out = true; runs = 0; }
        else if (!out && Math.random() < 0.25) runs = Math.min(6, runs + 1);
      } else if (deliv === 'def') {
        if (!out && Math.random() < 0.45) runs = Math.max(1, Math.min(runs, 1));
      }
      four = !out && runs === 4;
      six = !out && runs === 6;
      dot = !out && runs === 0;
    }
    return { runs, out, four, six, dot, escape, sixes: six };
  }

  /* ---------------------------------------------------------------------
     AI picks a number + shot/delivery, learning the opponent’s habits.
     --------------------------------------------------------------------- */
  function aiPick(side, history, level) {
    const freq = {};
    history.forEach((h) => {
      const k = side === 'bowl' ? h.batN : h.bowlN;
      freq[k] = (freq[k] || 0) + 1;
    });
    let pick;
    if (side === 'bowl') {
      pick = mostCommon(freq) || randInt(1, 6);
      return { n: pick, delivery: level >= 3 ? (level >= 4 ? (Math.random() < 0.5 ? 'agg' : 'nor') : (Math.random() < 0.5 ? 'def' : 'nor')) : 'nor' };
    }
    const used = Object.keys(freq).map(Number);
    const pool = NUMBERS.filter((x) => !used.includes(x) || freq[x] <= 1);
    pick = pool.length ? pool[(Math.random() * pool.length) | 0] : randInt(1, 6);
    return { n: pick, shot: level >= 2 ? (level >= 5 ? (Math.random() < 0.5 ? 'agg' : 'nor') : 'nor') : 'nor' };
  }
  function mostCommon(freq) {
    let best = null, bv = 0;
    for (const k in freq) { if (freq[k] > bv) { bv = freq[k]; best = Number(k); } }
    return best && bv >= 2 ? best : null;
  }

  /* =====================================================================
     Controller
     ===================================================================== */
  function start(hostEl, cfg0, api) {
    const cfg = Object.assign({ level: 1, overs: 2, squad: 1, wickets: 1, youBatFirst: true, mode: 'ai', online: null }, cfg0);
    const ballsPerSide = cfg.overs * 6;
    const wicketsPerSide = parseInt(cfg.wickets, 10) || cfg.squad || 1;
    const playersPerSide = parseInt(cfg.squad, 10) || 1;
    const net = api.net;
    const isHost = cfg.mode === 'online' && cfg.online && cfg.online.myIndex === 0;
    // In AI mode you always drive one fixed side; "youBatFirst" just decides
    // whether you bat (innings 1) or bowl first (innings 1).
    const humanSide = cfg.mode === 'ai' ? (cfg.youBatFirst ? 'A' : 'B') : 'A';

    const s = {
      cfg,
      sides: {
        A: makeSide('A'),
        B: makeSide('B'),
      },
      batting: cfg.online ? cfg.online.mySide : (cfg.youBatFirst ? 'A' : 'A'),
      target: null,
      pending: null,   // for local pass-and-play bowl role
      ready: { bat: false, bowl: false },
      lastBat: null, lastBowl: null,
      hist: [],
      ballNo: 0,
      winner: null,
      motm: null,
      done: false,
    };
    // The first batting side (team A) is fixed; the "youBatFirst" note applies to the AI
    // mode only where you drive Team A. Keep team A on strike first.
    s.batting = 'A';

    function makeSide(sym) {
      const roster = [];
      for (let i = 0; i < playersPerSide; i++) roster.push({ name: sideName(sym) + ' · ' + (i + 1), runs: 0, balls: 0, out: false });
      return { name: sideName(sym), roster, len: playersPerSide };
    }
    function sideName(sym) {
      if (cfg.mode === 'online') return sym === cfg.online.mySide ? 'You' : 'Opponent';
      if (cfg.mode === 'ai') return sym === humanSide ? 'You' : 'AI';
      return sym === 'A' ? 'Player 1' : 'Player 2';
    }
    function side(sym) { return s.sides[sym]; }
    function currentBatter(sym) {
      const sd = side(sym);
      return sd.roster.find((p) => !p.out) || sd.roster.slice(-1)[0];
    }
    function scoreOf(sym) {
      const sd = side(sym);
      return { runs: sd.roster.reduce((a, p) => a + p.runs, 0), balls: sd.roster.reduce((a, p) => a + p.balls, 0), wickets: sd.roster.filter((p) => p.out).length };
    }
    function runRate(sym) { const sc = scoreOf(sym); const o = sc.balls / 6; return o > 0 ? (sc.runs / o).toFixed(2) : '0.00'; }
    function neededNow() { if (s.target == null) return null; const sc = scoreOf(s.batting); return Math.max(0, s.target - sc.runs); }
    function reqRate() {
      if (s.target == null) return null;
      const sc = scoreOf(s.batting);
      const oversLeft = Math.max(0.1, (ballsPerSide - sc.balls) / 6);
      const need = neededNow();
      return need <= 0 ? '0.00' : (need / oversLeft).toFixed(2);
    }
    function ballsRemain() { const sc = scoreOf(s.batting); return Math.max(0, ballsPerSide - sc.balls); }

    function applyBall(bat, bowl) {
      const res = resolveBall(bat, bowl, cfg.level);
      const sym = s.batting;
      const b = currentBatter(sym);
      if (b) { b.balls += 1; if (!res.out) b.runs += res.runs; else b.out = true; }
      s.hist.push({ batN: bat.n, bowlN: bowl.n });
      s.ballNo += 1;
      s.lastBat = bat; s.lastBowl = bowl;
      s.ready = { bat: false, bowl: false };
      return res;
    }

    function finish() {
      s.done = true;
      const a = scoreOf('A'), b = scoreOf('B');
      s.winner = a.runs > b.runs ? 'A' : b.runs > a.runs ? 'B' : 'tie';
      s.motm = computeMotm();
      persist();
    }
    function computeMotm() {
      let best = null, bs = -Infinity;
      ['A', 'B'].forEach((sym) => side(sym).roster.forEach((p) => {
        const sr = p.balls ? (p.runs / p.balls) * 100 : 0;
        const v = p.runs + sr / 30 * 4;
        if (!best || v > bs) { best = p; bs = v; }
      }));
      return best;
    }
    function persist() {
      const store = api.store, profile = api.profile;
      if (!store || !profile) return;
      const mySide = cfg.mode === 'online' ? cfg.online.mySide : (cfg.mode === 'ai' ? (cfg.youBatFirst ? 'A' : 'B') : 'A');
      const outcome = s.winner === 'tie' ? 'draw' : s.winner === mySide ? 'win' : 'loss';
      const sc = scoreOf(mySide);
      try { store.recordGame(profile.id, 'cricket', outcome, { runs: sc.runs, wickets: sc.wickets, balls: sc.balls, best: sc.runs }); } catch (e) {}
    }

    /* ---------- play a resolved ball ---------- */
    function playBall(bat, bowl) {
      const res = applyBall(bat, bowl);
      const sym = s.batting;
      const batName = sideName(sym);
      const bowlName = sideName(sym === 'A' ? 'B' : 'A');
      const sc = scoreOf(sym);
      const prevRuns = sc.runs - (res.out ? 0 : res.runs);
      let txt = batName + ' picks ' + bat.n + ', ' + bowlName + ' picks ' + bowl.n + '. ';
      if (res.out) { U.sfx('wicket'); txt += 'OUT! Wicket! ' + currentBatter(sym).name + ' is dismissed.'; }
      else if (res.six) { U.sfx('six'); txt += 'SIX! ' + res.runs + ' runs!'; }
      else if (res.four) { U.sfx('four'); txt += 'Four runs!'; }
      else if (res.escape) { U.sfx('select'); txt += 'High and wide — no run, the numbers match but it is dropped!'; }
      else if (res.runs) { U.sfx('run', res.runs); txt += res.runs + ' run' + (res.runs > 1 ? 's' : '') + ' added.'; }
      else { U.sfx('tic'); txt += 'Dot ball.'; }
      // Milestone applause — fifty and century for the batting side.
      if (!res.out && prevRuns < 50 && sc.runs >= 50) { U.sfx('applause'); txt += ' That is a FIFTY! The crowd applauds!'; }
      else if (!res.out && prevRuns < 100 && sc.runs >= 100) { U.sfx('applause'); txt += ' A CENTURY! What a knock!' + ' The crowd is on its feet!'; }
      const scTxt = 'Score now ' + sc.runs + (sc.wickets ? ' for ' + sc.wickets : '') + ' in ' + sc.balls + ' balls.';
      txt += ' ' + scTxt;
      U.say(txt);
      syncState();

      let finished = false, reason = '';
      if (s.target != null && sc.runs >= s.target) { finished = true; reason = 'win'; }
      else if (sc.wickets >= wicketsPerSide) { finished = true; reason = 'allout'; }
      else if (sc.balls >= ballsPerSide) { finished = true; reason = 'overs'; }

      if (finished) {
        if (s.target == null) {
          s.target = sc.runs + 1;
          s.batting = sym === 'A' ? 'B' : 'A';
          // reset outs for the new innings, reset ball counter is derived from scoreOf
          U.say((s.target - 1) + ' runs to defend. ' + sideName(s.batting) + ' needs ' + s.target + ' to win.');
          setTimeout(render, 400);
        } else {
          finish();
          setTimeout(render, 300);
        }
      } else {
        setTimeout(render, 300);
      }
    }

    /* ---------- rendering ---------- */
    let active = true;
    function render() {
      if (!active) return;
      U.clear(hostEl);
      const sym = s.batting;
      const other = sym === 'A' ? 'B' : 'A';
      const sc = scoreOf(sym);

      const head = U.el('div', { class: 'screen-head' });
      head.appendChild(U.el('h2', null, ['Hand Cricket' + (cfg.mode === 'online' ? ' · online' : cfg.mode === 'ai' ? ' · vs AI' : ' · local')]));
      head.appendChild(U.el('p', { class: 'muted' }, ['Level ' + cfg.level + ' · ' + cfg.overs + ' over' + (cfg.overs > 1 ? 's' : '') + ' · ' + playersPerSide + ' player' + (playersPerSide > 1 ? 's' : '') + ' a side · ' + wicketsPerSide + ' wicket' + (wicketsPerSide > 1 ? 's' : '')]));
      hostEl.appendChild(head);

      // Scoreboard
      const sb = U.el('div', { class: 'scoreboard' });
      const sbMain = U.el('div', { class: 'sb-main' });
      sbMain.appendChild(U.el('div', { class: 'score-number' }, [String(sc.runs)]));
      const meta = U.el('div', { class: 'score-meta' });
      meta.innerHTML = '<strong>' + U.esc(sideName(sym)) + '</strong> ' + sc.runs + (sc.wickets ? '·' + sc.wickets : '') + ' (' + sc.balls + ' balls)<br><span class="muted">' + U.esc(sideName(other)) + ' bowling · RR ' + runRate(sym) + '</span>';
      sbMain.appendChild(meta);
      sb.appendChild(sbMain);
      if (s.target != null && !s.done) {
        const tray = U.el('div', { class: 'inning-tray' });
        tray.appendChild(U.el('span', { class: 'chip' }, ['Target ' + (s.target - 1)]));
        tray.appendChild(U.el('span', { class: 'chip' }, ['Need ' + neededNow()]));
        tray.appendChild(U.el('span', { class: 'chip' }, ['Req. rate ' + reqRate()]));
        sb.appendChild(tray);
      } else if (!s.done) {
        sb.appendChild(U.el('div', { class: 'inning-tray' }, [U.el('span', { class: 'chip' }, ['Innings 1 · setting target'])]));
      }
      hostEl.appendChild(sb);

      if (s.done) { renderFinish(); return; }

      // Status line
      const status = U.el('div', { class: 'run-announce', id: 'status', 'aria-live': 'polite' });
      let st = sideName(sym) + ' batting. ' + sc.runs + ' runs, ' + sc.balls + ' balls.';
      if (s.target != null) st += ' Need ' + neededNow() + ' more.';
      else st += ' Setting the target.';
      status.textContent = st;
      hostEl.appendChild(status);

      const stage = U.el('div', { class: 'stage has-side' });
      const left = U.el('div', { class: 'col' });
      left.appendChild(turnCard(sym));
      stage.appendChild(left);
      const right = U.el('div', { class: 'col' });
      right.appendChild(summaryPanel());
      stage.appendChild(right);
      hostEl.appendChild(stage);
    }

    function turnCard(sym) {
      const panel = U.el('div', { class: 'panel' });
      const humanRole = localHumanRole();
      if (cfg.mode === 'ai') {
        const youBat = (sym === humanSide);
        panel.appendChild(U.el('h3', null, [youBat ? 'Your innings — bat' : 'You are bowling']));
        panel.appendChild(U.el('p', { class: 'muted' }, [youBat ? 'Pick a shot and a number.' : 'Pick a delivery and a number to take the wicket.']));
        panel.appendChild(numberPad(youBat ? 'bat' : 'bowl'));
      } else if (cfg.mode === 'online') {
        if (sym === cfg.online.mySide) {
          panel.appendChild(U.el('h3', null, ['Your turn to bat']));
          panel.appendChild(U.el('p', { class: 'muted' }, ['Pick a shot and number. The opponent bowls.']));
          panel.appendChild(numberPad('bat'));
        } else {
          panel.appendChild(U.el('h3', null, ['Opponent is batting — you bowl']));
          panel.appendChild(U.el('p', { class: 'muted' }, ['Pick a delivery and number to try for a wicket.']));
          panel.appendChild(numberPad('bowl'));
        }
      } else {
        // local pass-and-play
        const nextRole = s.pending ? 'bowl' : 'bat';
        const who = sym === 'A' ? 'Player 1' : 'Player 2';
        panel.appendChild(U.el('h3', null, ['Pass-and-play']));
        panel.appendChild(U.el('p', { class: 'muted' }, ['Hand the device to ' + who + ' — they ' + (nextRole === 'bat' ? 'bat' : 'bowl') + ' this ball.']));
        panel.appendChild(numberPad(nextRole));
      }
      return panel;
    }

    function localHumanRole() {
      if (cfg.mode === 'ai') return cfg.youBatFirst ? 'bat' : 'bowl';
      return null;
    }

    function numberPad(role) {
      const wrap = U.el('div');
      const levelOk = cfg.level >= 2;
      const tactic = U.el('div', { class: 'roll-row' });
      tactic.appendChild(U.el('span', { class: 'muted' }, [role === 'bat' ? 'Shot' : 'Delivery']));
      const seg = U.el('div', { class: 'seg' });
      const opts = role === 'bat' ? SHOTS : DELIVERIES;
      let chosenTactic = 'nor';
      opts.forEach((opt) => {
        const b = U.el('button', { type: 'button', class: 'seg-btn', 'aria-pressed': opt.id === 'nor' ? 'true' : 'false' }, [opt.label]);
        b.title = opt.tall;
        b.addEventListener('click', () => {
          chosenTactic = opt.id;
          seg.querySelectorAll('.seg-btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          U.sfx('select');
          U.say(opt.label + ' selected. ' + opt.tall);
        });
        seg.appendChild(b);
      });
      if (!levelOk) { seg.querySelectorAll('.seg-btn')[1] && seg.querySelectorAll('.seg-btn')[1].setAttribute('aria-pressed', 'true'); }
      tactic.appendChild(seg);
      wrap.appendChild(tactic);

      const pad = U.el('div', { class: 'numpad' });
      NUMBERS.forEach((n) => {
        const b = U.el('button', { type: 'button' }, [String(n)]);
        b.setAttribute('aria-label', 'Pick number ' + n);
        b.addEventListener('click', () => { U.sfx('click', { pan: (n - 3.5) / 3 }); submit(role, n, chosenTactic); });
        pad.appendChild(b);
      });
      wrap.appendChild(pad);
      return wrap;
    }

    /* ---------- submit path ---------- */
    function submit(role, n, tactic) {
      if (s.done) return;
      const choice = role === 'bat' ? { n, shot: tactic } : { n, delivery: tactic };
      if (cfg.mode === 'ai') {
        const humanIsBat = (s.batting === humanSide);
        let bat, bowl;
        if (humanIsBat) { bat = choice; bowl = aiPick('bowl', s.hist, cfg.level); }
        else { bowl = choice; bat = aiPick('bat', s.hist, cfg.level); }
        playBall(bat, bowl);
      } else if (cfg.mode === 'online') {
        // Put our pick in the shared mailbox; the host resolves when both arrive.
        submitOnline(role, choice);
      } else {
        // local
        if (role === 'bat') { s.pending = choice; U.say('Batter picks ' + n + '. Now the bowler picks a number.'); render(); }
        else { const bat = s.pending || { n: randInt(1, 6), shot: 'nor' }; s.pending = null; playBall(bat, choice); }
      }
    }

    function resolveBoth() {
      const bat = s.lastBat || { n: randInt(1, 6), shot: 'nor' };
      const bowl = s.lastBowl || { n: randInt(1, 6), delivery: 'nor' };
      playBall(bat, bowl);
    }

    // Put our choice into the shared mailbox. The host (slot 0) reads it and
    // resolves the ball once both a bat and a bowl pick are present.
    function submitOnline(role, choice) {
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state) return;
      const st = room.state;
      st.mailbox = st.mailbox || { ball: (st.snap && st.snap.ballNo) || 0, bat: null, bowl: null };
      st.mailbox[role] = choice;
      st.mailbox.ball = (st.snap && st.snap.ballNo) || 0;
      net.roomState(st);
      U.say('Pick locked in. Waiting for the opponent…');
      render();
    }

    /* ---------- online state sync (host-authoritative) ---------- */
    function syncState() {
      if (cfg.mode !== 'online') return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room) return;
      const st = room.state || {};
      st.running = !s.done;
      st.snap = ser();
      // The host clears the mailbox for the next ball.
      st.mailbox = { ball: s.ballNo, bat: null, bowl: null };
      net.roomState(st);
    }
    function ser() {
      return {
        sides: { A: plainSide('A'), B: plainSide('B') },
        target: s.target, winner: s.winner, batting: s.batting, ballNo: s.ballNo, done: s.done,
      };
    }
    function plainSide(sym) {
      const sd = side(sym);
      return { name: sd.name, len: sd.len, roster: sd.roster.map((p) => ({ name: p.name, runs: p.runs, balls: p.balls, out: p.out })) };
    }
    // Rebuild local state from an authoritative snapshot (non-hosts render this).
    function hydrate(snap) {
      if (!snap) return;
      if (snap.sides) {
        s.sides.A = normSide(snap.sides.A);
        s.sides.B = normSide(snap.sides.B);
      }
      if (typeof snap.batting === 'string') s.batting = snap.batting;
      if (snap.target != null) s.target = snap.target;
      if (typeof snap.ballNo === 'number') s.ballNo = snap.ballNo;
      s.winner = snap.winner || null;
      s.done = !!snap.done;
    }
    function normSide(sd) {
      if (!sd) return makeSide('A');
      return { name: sd.name, len: sd.len, roster: (sd.roster || []).map((p) => ({ name: p.name, runs: p.runs, balls: p.balls, out: !!p.out })) };
    }
    // The host seeds the shared store on launch so non-hosts can render.
    function initOnline() {
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room) return;
      const st = room.state || {};
      st.running = true;
      st.snap = ser();
      st.mailbox = { ball: s.ballNo, bat: null, bowl: null };
      net.roomState(st);
    }
    const onState = function () {
      if (cfg.mode !== 'online') return;
      const room = net.currentRoom ? net.currentRoom() : null;
      if (!room || !room.state) return;
      const st = room.state;
      const mb = st.mailbox;
      if (isHost && mb && mb.bat && mb.bowl && mb.ball === s.ballNo) {
        playBall(mb.bat, mb.bowl); // resolve + sync + clears mailbox
      } else {
        hydrate(st.snap);
        render();
      }
    };
    net.on('state', onState);

    function summaryPanel() {
      const panel = U.el('div', { class: 'panel' });
      panel.appendChild(U.el('h3', null, ['Match summary']));
      const grid = U.el('div', { class: 'stat-grid' });
      ['A', 'B'].forEach((sym) => {
        const sc = scoreOf(sym);
        const cell = U.el('div', { class: 'stat-cell' });
        cell.innerHTML = '<strong>' + sc.runs + '</strong><span>' + U.esc(sideName(sym)) + ' · RR ' + runRate(sym) + '</span>';
        grid.appendChild(cell);
      });
      panel.appendChild(grid);
      ['A', 'B'].forEach((sym) => {
        const sd = side(sym);
        const card = U.el('div', { class: 'panel', style: 'background:var(--surface-2);margin-top:10px;' });
        card.appendChild(U.el('h4', null, [U.esc(sideName(sym))]));
        const ul = U.el('ul');
        sd.roster.forEach((p) => {
          const li = U.el('li', { class: 'slot' });
          li.appendChild(U.el('span', { class: 'dot', style: 'background:#33e0c8;' }));
          li.appendChild(U.el('span', { class: 'slot-name' }, [U.esc(p.name) + (p.out ? ' ✕' : '')]));
          li.appendChild(U.el('span', { class: 'slot-role' }, [p.runs + '/' + p.balls]));
          ul.appendChild(li);
        });
        card.appendChild(ul);
        panel.appendChild(card);
      });
      return panel;
    }

    function renderFinish() {
      const a = scoreOf('A'), b = scoreOf('B');
      const wrap = U.el('div', { class: 'panel', style: 'margin-top:16px;text-align:center;' });
      let head = s.winner === 'tie' ? 'It’s a tie!' : sideName(s.winner) + ' wins!';
      // Distinct win / lose / draw audio, judged from the local player's side.
      const mySide = cfg.mode === 'online' ? cfg.online.mySide : (cfg.mode === 'ai' ? humanSide : 'A');
      if (s.winner === 'tie') { U.sfx('chime'); }
      else if (s.winner === mySide) { U.sfx('winFanfare'); }
      else { U.sfx('loseFall'); }
      wrap.appendChild(U.el('h2', { class: 'flash' }, [head]));
      wrap.appendChild(U.el('p', { class: 'muted' }, [U.esc(sideName('A')) + ' ' + a.runs + '/' + a.wickets + ' — ' + U.esc(sideName('B')) + ' ' + b.runs + '/' + b.wickets]));
      if (s.motm) {
        const badges = U.el('div', { class: 'profile-badges', style: 'justify-content:center;' });
        badges.appendChild(U.el('span', { class: 'tag hot' }, ['⭐ Man of the Match: ' + U.esc(s.motm.name)]));
        wrap.appendChild(badges);
        U.say('Man of the match: ' + s.motm.name + ' with ' + s.motm.runs + ' runs at a strike rate of ' + (s.motm.balls ? ((s.motm.runs / s.motm.balls) * 100).toFixed(0) : 0) + '.');
      }
      const again = U.el('button', { class: 'btn btn-primary', type: 'button' }, ['Play again']);
      again.addEventListener('click', () => { destroy(); start(hostEl, cfg0, api); });
      wrap.appendChild(again);
      hostEl.appendChild(wrap);
    }

    const onChat = function () {};
    function destroy() { active = false; try { net.off('state', onState); } catch (e) {} U.clear(hostEl); }

    U.say(sideName('A') + ' to bat first. ' + boundsTxt());
    if (cfg.mode === 'online') {
      const room0 = net.currentRoom ? net.currentRoom() : null;
      if (isHost) initOnline();
      if (room0 && room0.state && room0.state.snap) hydrate(room0.state.snap);
    }
    render();

    function boundsTxt() {
      return 'Each side has ' + ballsPerSide + ' balls and ' + wicketsPerSide + ' wicket' + (wicketsPerSide > 1 ? 's' : '') + '. Pick 1 to 6. Match the bowler and you are out!';
    }

    return { destroy, state: s, render, submit, meta: META };
  }

  G[META.id] = { meta: META, start, options: OPTIONS };
})(window);
