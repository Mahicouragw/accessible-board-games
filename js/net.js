/* Trusted same-device rooms via BroadcastChannel/localStorage.
 * Not an authenticated internet service. Public Supabase state writes are disabled.
 * All captain commands are serialized by the host and validated by cricket-room.js.
 */
(function (global) {
  'use strict';

  const H = {};

  /* ---------- config ---------- */
  H.config = (global.HEROBOARD_CONFIG || {});
  H.setConfig = function (c) { H.config = Object.assign(H.config, c || {}); };
  H.online = function () { return !!(H.config.supabaseUrl && H.config.supabaseAnonKey); };

  /* ---------- events ---------- */
  const listeners = {};
  H.on = function (ev, cb) { (listeners[ev] = listeners[ev] || []).push(cb); };
  H.off = function (ev, cb) { if (listeners[ev]) listeners[ev] = listeners[ev].filter((f) => f !== cb); };
  function emit(ev, data) { (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) {} }); }

  /* =====================================================================
     Implementations
     ===================================================================== */

  // The old anonymous public-write Supabase implementation was removed.
  // Internet transport must use authenticated server commands; see SUPABASE_SETUP.md.

  /* ---------------- Local transport (BroadcastChannel) ---------------- */
  function makeLocalRT() {
    const st = { type: 'local' };
    const KEY = 'heroboard.rooms.v1';
    const chan = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('heroboard') : null;
    let room = null;   // { code, game, meta, adminId, status, members:[], state }
    let me = null;
    let commandQueue = Promise.resolve();
    const pendingCommands = new Map();
    function publishRoom(next) {
      if(room && (next.revision||0)<(room.revision||0))return;
      const starting = room && room.status !== 'in_progress' && next.status === 'in_progress';
      room = next; emit('room:update', room); emit('state', room.state);
      if (starting) emit('game:start', {code:room.code});
    }
    function processCommand(msg) {
      commandQueue = commandQueue.then(async () => {
        let error = null;
        try {
          const next = await global.HeroCricketRoom.reduce(room, msg.actor, msg.action);
          next.revision=(room.revision||0)+1;publishRoom(next);save(); broadcast({type:'room:update',room});
        } catch(e) { error = e.message; }
        const result={type:'cricket:result',code:room.code,id:msg.id,error};
        broadcast(result); handleMessage(result);
      });
    }

    // Expose the live room + membership on the transport object.
    Object.defineProperty(st, 'room', { get: () => room, enumerable: true });
    Object.defineProperty(st, 'member', { get: () => me, enumerable: true });

    // Only the originator holds the canonical room record in memory; others
    // mirror via events. Also persist to localStorage so late joiners sync.
    function save() { try { if (room) localStorage.setItem(KEY + '.' + room.code, JSON.stringify(room)); } catch (e) {} }
    function load(code) { try { const v = localStorage.getItem(KEY + '.' + code); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
    function del(code) { try { localStorage.removeItem(KEY + '.' + code); } catch (e) {} }

    function broadcast(msg) { if (chan) chan.postMessage(msg); }

    // Merge in an update coming from another tab/peer.
    function handleMessage(msg) {
      if (!msg || !room) return;
      if(msg.type==='cricket:command' && msg.code===room.code && me?.id===room.adminId) {processCommand(msg);return;}
      if(msg.type==='cricket:result' && msg.code===room.code) {
        const p=pendingCommands.get(msg.id);if(p){clearTimeout(p.timer);pendingCommands.delete(msg.id);p.resolve({error:msg.error});}return;
      }
      if (msg.type === 'room:update' && room && msg.room && msg.room.code === room.code) {
        publishRoom(msg.room);
      } else if (msg.type === 'state' && room && msg.code === room.code) {
        if((msg.revision||0)<(room.revision||0))return;
        room.revision=msg.revision||room.revision;room.state = msg.state;
        emit('state', msg.state);
      } else if (msg.type === 'chat' && room && msg.code === room.code) {
        emit('chat', msg.msg);
      } else if (msg.type === 'start' && room && msg.code === room.code) {
        room.status = 'in_progress'; save();
        emit('game:start', msg);
      }
    }
    if (chan) { chan.onmessage = (e) => handleMessage(e.data); }
    const storageHandler = (e) => {
      if (e.key && e.key.indexOf(KEY + '.') === 0) {
        const data = load(room && room.code);
        if (data) { publishRoom(data); }
      }
    };
    window.addEventListener('storage', storageHandler);

    st.cricketAction = function(action) {
      if(!room||!me)return Promise.resolve({error:'Join a room first.'});
      const id=global.crypto?.randomUUID?.() || String(Date.now())+Math.random();
      return new Promise(resolve=>{
        const timer=setTimeout(()=>{pendingCommands.delete(id);resolve({error:'The host did not respond. The host must keep this room open.'});},8000);
        pendingCommands.set(id,{resolve,timer});
        const msg={type:'cricket:command',code:room.code,id,actor:me.id,action};
        if(me.id===room.adminId)processCommand(msg);else broadcast(msg);
      });
    };

    st.checkUsername = function () { return Promise.resolve({ taken: false }); };

    st.createRoom = async function (r) {
      room = Object.assign({}, r);
      room.status = 'lobby';room.revision=1;
      room.members = r.members || [];
      // The host controls the room: record who the local member is.
      const hostId = room.adminId;
      me = room.members.find((m) => m.id === hostId) || room.members[0] || null;
      save();
      return { room };
    };

    st.joinRoom = async function (code, member) {
      const existing = load(code);
      if (!existing) return { error: 'Room not found on this device. Ask for a fresh code, or go online for cross-device play.' };
      if (existing.status === 'in_progress' && member.role !== 'spectator') return { error: 'This match has already started.' };
      if(existing.status==='closed')return {error:'This room has closed.'};
      if(existing.members.some(m=>m.id!==member.id&&m.name.trim().toLowerCase()===member.name.trim().toLowerCase()))return {error:'This name is already used. This is a multiplayer game, please use another hero, another name, or sign in with your ID.'};
      room = existing;
      me = member;
      // Add ourselves (dedupe by id).
      if (!room.members.some((m) => m.id === member.id)) {
        if (member.name.toLowerCase() === existing.adminId_name) {}
        room.members.push(member);room.revision=(room.revision||0)+1;
        save();
      }
      broadcast({ type: 'room:update', room });
      return { room };
    };

    st.roomState = function (state) {
      if (!room) return;
      room.state = state;room.revision=(room.revision||0)+1;
      if (state && state.running) room.status = 'in_progress';
      save();
      broadcast({ type: 'state', code: room.code, state, revision:room.revision });
      emit('state', state);
    };

    st.sendChat = function (text) {
      if (!room || !me) return;
      const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2), user_id: me.id, name: me.name, text, at: Date.now() };
      broadcast({ type: 'chat', code: room.code, msg });
      emit('chat', [msg]);
    };

    st.admit = function (userId, slotOrRole) {
      if (!room || room.adminId !== (me && me.id)) return;
      const m = room.members.find((x) => x.id === userId);
      if (!m || room.status !== 'lobby' || room.state?.cricket) return;
      if(slotOrRole.role==='player' && room.members.some(x=>x.id!==userId&&x.role==='player'&&x.slot===slotOrRole.slot))return;
      m.role = slotOrRole.role || 'player';
      m.slot = slotOrRole.slot ?? null;room.revision=(room.revision||0)+1;
      save();
      broadcast({ type: 'room:update', room });
      emit('room:update', room);
    };

    st.start = function () {
      if (!room || room.adminId !== (me && me.id)) return;
      room.status = 'in_progress';room.revision=(room.revision||0)+1;
      save();
      broadcast({ type: 'start', code: room.code });
      emit('game:start', { code: room.code });
    };

    st.leave = function () {
      if(room&&me){room.members=room.members.filter(m=>m.id!==me.id);room.revision=(room.revision||0)+1;if(me.id===room.adminId)room.status='closed';save();broadcast({type:'room:update',room});}
      chan?.close?.(); window.removeEventListener('storage',storageHandler);
      for(const p of pendingCommands.values()){clearTimeout(p.timer);p.resolve({error:'You left the room.'});}
      pendingCommands.clear();room=null;me=null;
    };

    return st;
  }

  /* ---------- select transport ---------- */
  let rt = null;
  function transport() {
    if (rt) return rt;
    // Legacy public-write Supabase transport is intentionally disabled until an
    // authenticated, transactional command backend is provisioned. Never silently
    // downgrade a configured internet room to an insecure demo backend.
    if(H.online()) throw new Error('Internet rooms are not configured securely yet. Use local play for now.');
    rt = null;
    if (!rt) rt = makeLocalRT();
    return rt;
  }

  /* =====================================================================
     Public API used by the app & games
     ===================================================================== */

  H.checkUsername = function (name) { return transport().checkUsername(name); };

  H.createRoom = async function (opts) {
    const code = genCode();
    const t = transport();
    const res = await t.createRoom({
      code,
      game: opts.game,
      meta: opts.meta || {},
      adminId: opts.adminId,
      members: opts.members || [],
      state: opts.state || null,
    });
    if (res.room) { attachTransportAliases(t); H.state = res.room.state; }
    return res;
  };

  H.joinRoom = async function (code, member) {
    const t = transport();
    const res = await t.joinRoom(code, member);
    if (res.room) { attachTransportAliases(t); }
    return res;
  };

  H.roomState = function (state) {
    if (!rt) return;
    rt.roomState(state);
    // Transport already emits exactly one local echo.
  };
  H.cricketAction = action => rt?.cricketAction ? rt.cricketAction(action) : Promise.resolve({error:'Room unavailable.'});
  H.sendChat = function (text) { text=String(text||'').trim().slice(0,200);if (rt&&text) rt.sendChat(text); };
  H.admit = function (userId, slotOrRole) { if (rt) rt.admit(userId, slotOrRole); };
  H.startGame = function () { if (rt) rt.start && rt.start(); };
  H.leave = function () { if (rt) rt.leave && rt.leave(); rt = null; };
  H.currentRoom = function () { return rt && rt.room; };
  H.member = function () { return rt && rt.member; };

  function attachTransportAliases(t) { rt = t; if (rt.member === undefined) rt.member = null; }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }

  // Presence + chat listeners are wired up by the app (rooms.js) via H.on().

  global.HeroNet = H;
})(window);
