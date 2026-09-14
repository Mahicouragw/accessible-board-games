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
    let seats = defaultSeats(game, opts.meta);
    if (game !== 'cricket' && game !== 'carrom') seats = Math.max(seats, 2);

    let room = null;      // current room object (from net)
    let myRole = opts.isAdmin ? 'admin' : 'player';
    let chatEl = null;
    let alive = true;
    const subscriptions=[];
    const chatHistory=[];
    const seenChat=new Set();

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
        }).then((res) => { if (res.error) { fail(res.error); return; } room = res.room; if(!alive)return;wire(); render(); }).catch(e=>fail(e.message));
      } else {
        // guest joins as spectator, waits for assignment.
        return net.joinRoom(opts.code, { id: opts.me.id, name: opts.me.name, role: 'spectator', slot: null })
          .then((res) => { if (res.error) { fail(res.error); return; } room = res.room; if(!alive)return;wire(); render(); }).catch(e=>fail(e.message));
      }
    }

    function fail(msg) { U.alertSay(msg); renderError(msg); }

    function wire() {
      const listen=(ev,fn)=>{net.on(ev,fn);subscriptions.push([ev,fn]);};
      listen('room:update', r=>{if(alive&&r&&r.code===room.code){room=r;render();if(r.status==='closed')U.alertSay('The host has closed this room. Leave and create a new room.');}});
      listen('chat', msgs=>appendChat(msgs));
    }
    function destroy(){alive=false;subscriptions.forEach(([ev,fn])=>net.off(ev,fn));subscriptions.length=0;}

    /* --- rendering --- */
    function render() {
      if(!alive)return;
      const focused=hostEl.contains(document.activeElement)?document.activeElement.id:null;
      const draftText=document.getElementById('chat-input')?.value||'';
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
      left.appendChild(game==='cricket'?renderCricket(isAdmin):renderSlots(isAdmin));
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
      if(focused){const el=document.getElementById(focused);if(el){if(focused==='chat-input')el.value=draftText;U.focus(el);}}
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
      if(game==='cricket')return room.state?.cricket?.phase==='ready';
      return room.members.filter((m) => m.role === 'player').length >= Math.min(2, seats);
    }

    function slots() {
      const arr = [];
      const label = seatLabels(game, seats);
      for (let i = 0; i < seats; i++) arr.push({ index: i, label: label[i], member: room.members.find((m) => m.role === 'player' && m.slot === i) });
      return arr;
    }

    async function cricketAction(action){const result=await net.cricketAction(action);if(result?.error)U.alertSay(result.error);else U.say(action.type==='draft'?'Player drafted. Next captain’s turn.':'Team setup updated.');}
    function renderCricket(isAdmin){
      const wrap=U.el('section',{'aria-label':'Cricket teams and captain draft'}),c=room.state?.cricket;
      wrap.appendChild(U.el('h3',null,['Captain draft']));
      wrap.appendChild(U.el('p',{class:'hint'},['Each team size includes its captain. Captains pick alternately, then select only their own active batter and bowler. Unpicked players spectate.']));
      if(!c){
        if(!isAdmin){wrap.appendChild(U.el('p',null,['Waiting for the host to name teams and choose captains.']));return wrap;}
        const form=U.el('form'),fields={};
        function field(key,text,tag='input'){const label=U.el('label',{for:'team-'+key},[text]);const e=U.el(tag,{id:'team-'+key,required:'required'});fields[key]=e;form.appendChild(label);form.appendChild(e);return e;}
        field('nameA','Team 1 name').value='India';field('nameB','Team 2 name').value='Sri Lanka';
        for(const k of ['A','B']){const sel=field('captain'+k,'Team '+(k==='A'?'1':'2')+' captain','select');room.members.forEach(m=>sel.appendChild(U.el('option',{value:m.id},[m.name])));sel.value=k==='A'?opts.me.id:(room.members.find(m=>m.id!==opts.me.id)?.id||opts.me.id);}
        const size=field('size','Players per team, including captain','select');[1,2,3,5,11].forEach(n=>size.appendChild(U.el('option',{value:String(n)},[String(n)])));size.value=String(room.meta.squad||1);
        const b=U.el('button',{type:'submit',class:'btn btn-primary'},['Confirm captains and begin draft']);form.appendChild(b);
        form.onsubmit=e=>{e.preventDefault();cricketAction({type:'setup',...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]))});};wrap.appendChild(form);
      }else{
        for(const k of ['A','B']){const team=c.teams[k];wrap.appendChild(U.el('h4',null,[team.name+' — '+team.members.length+'/'+c.size]));const list=U.el('ul');team.members.forEach(id=>list.appendChild(U.el('li',null,[(room.members.find(m=>m.id===id)?.name||'Disconnected player')+(id===team.captain?' — captain':' — co-player')])));wrap.appendChild(list);}
        if(c.phase==='draft'){
          const team=c.teams[c.turn];wrap.appendChild(U.el('p',{role:'status'},[team.name+' captain’s turn to pick.']));
          if(team.captain===opts.me.id){room.members.filter(m=>!global.HeroCricketRoom.teamFor(c,m.id)).forEach(m=>{const b=U.el('button',{id:'draft-'+m.id,type:'button',class:'btn'},['Draft '+m.name]);b.onclick=()=>cricketAction({type:'draft',player:m.id});wrap.appendChild(b);});}
          if(room.members.length<c.size*2)wrap.appendChild(U.el('p',null,['More players need to join to complete both teams.']));
        }else if(c.phase==='ready')wrap.appendChild(U.el('p',{role:'status'},['Both teams are ready. The host can start.']));
      }
      return wrap;
    }

    function renderSlots(isAdmin) {
      const wrap = U.el('div');
      wrap.appendChild(U.el('h3', null, ['Player seats']));
      const list = U.el('ul', { class: 'slot-list' });
      slots().forEach((sk) => {
        const li = U.el('li', { class: 'slot ' + (sk.member ? 'filled' : 'empty') });
        li.appendChild(U.el('span', null, [sk.label + ':']));
        if (sk.member) {
          const nm = U.el('button', { type:'button', class: 'slot-name' }, [U.esc(sk.member.name)]);
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
        const nm = U.el('button', { type:'button', class: 'slot-name' }, [U.esc(m.name)]);
        nm.addEventListener('click', () => inspect(m));
        li.appendChild(nm);
        if (game!=='cricket' && isAdmin && m.id !== opts.me.id) li.appendChild(adminButtons(m));
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
      chatHistory.forEach(m=>drawChat(m));
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
        if(seenChat.has(m.id))return;seenChat.add(m.id);chatHistory.push(m);if(chatHistory.length>100){seenChat.delete(chatHistory.shift().id);}
        drawChat(m);
        if(m.user_id!==opts.me.id)U.say((m.name||'')+' says: '+m.text);else U.say('Message sent.');sfx('select');
      });
      chatEl.scrollTop=chatEl.scrollHeight;
    }
    function drawChat(m){
        const mine = (m.user_id === opts.me.id);
        const div = U.el('div', { class: 'chat-msg' + (mine ? ' mine' : '') });
        div.appendChild(U.el('span', { class: 'who' }, [U.esc(m.name || 'Anonymous')]));
        div.appendChild(U.el('span', { class: 'body' }, [U.esc(m.text)]));
        chatEl.appendChild(div);
        while(chatEl.children.length>100)chatEl.firstChild.remove();
    }

    function copyCode() {
      const code = room ? room.code : opts.code;
      global.HeroStore.copy(code).then((ok) => { U.say(ok ? 'Room code copied' : 'Copy the code manually: ' + code); });
    }

    async function start() {
      if(room.adminId!==opts.me.id)return;
      if(game==='cricket'){const res=await net.cricketAction({type:'start'});if(res?.error){U.alertSay(res.error);return;}if(opts.onStart)opts.onStart(R.configForRoom(net.currentRoom(),opts.me.id));return;}
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
        wickets: (opts.meta && opts.meta.wickets) || 1,
        squad: (opts.meta && opts.meta.squad) || 1,
        players: (opts.meta && opts.meta.players) || String(roster.length) || '2',
        coins: (opts.meta && opts.meta.coins) || '6',
      };
      net.startGame();
      if (opts.onStart) opts.onStart(cfg);
    }

    function gameName(id) {
      const map = { cricket: 'Captain’s Hand Cricket', snakes: 'Snakes & Ladders', ludo: 'Ludo', carrom: 'Carrom' };
      return map[id] || id;
    }

    boot();
    return { leave: destroy, destroy, render };
  };

  R.configForRoom=function(room,id){const c=room.state?.cricket;const roster=room.members.filter(m=>m.role==='player');const myIndex=roster.findIndex(m=>m.id===id);return {...room.meta,mode:'online',roster,online:{code:room.code,myIndex,mySide:c?global.HeroCricketRoom.teamFor(c,id):myIndex===1?'B':myIndex>=0?'A':null}};};
  global.HeroRooms = R;
})(window);
