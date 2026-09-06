/* ==========================================================================
   net.js — Realtime room transport for HeroBoard.

   Two interchangeable transports:
     • SupabaseRT — real Supabase Postgres + Realtime when HEROBOARD_CONFIG
       (SUPABASE_URL, SUPABASE_ANON_KEY) is provided. Full cross-device sync.
     • LocalRT (default) — BroadcastChannel + localStorage. Gives instant
       "online" behaviour across tabs on one machine and works with ZERO
       credentials, including the sandboxed preview. Perfect for pass-and-play
       and local multiplayer testing.

   The rest of the app talks only to `HeroNet.*`, so swapping transports is
   invisible to the games.
   ========================================================================== */
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

  /* ---------------- Supabase transport ---------------- */
  function supabaseClient() {
    if (!H.online()) return null;
    if (global.supabase && global.supabase.createClient) return global.supabase.createClient(H.config.supabaseUrl, H.config.supabaseAnonKey);
    // Load supabase-js lazily from CDN if a <script> gate isn't present yet.
    return null;
  }

  function makeSupabaseRT() {
    const sb = supabaseClient();
    if (!sb) return null;
    const rt = { type: 'supabase' };
    let channel = null;

    rt.checkUsername = async function (name) {
      const { data, error } = await sb.from('profiles').select('username').eq('username', name).limit(1);
      if (error) return { error: 'Network check unavailable — please retry.' };
      return { taken: (data && data.length > 0) ? true : false };
    };

    rt.createRoom = async function (room) {
      const { data, error } = await sb.from('rooms').insert({
        code: room.code, game: room.game, meta: room.meta || {},
        admin_id: room.adminId || null, status: 'lobby',
      }).select().single();
      if (error) return { error: 'Could not create room.' };
      const members = room.members || [];
      for (const m of members) await sb.from('room_members').insert({
        room_code: data.code, user_id: m.id, name: m.name, role: m.role, slot: m.slot || null,
      });
      rt.room = Object.assign({}, data, { members });
      rt.listen();
      return { room: rt.room };
    };

    rt.joinRoom = async function (code, member) {
      const { data, error } = await sb.from('rooms').select('*').eq('code', code).maybeSingle();
      if (error || !data) return { error: 'Room not found. Check the code.' };
      if (data.status === 'in_progress' && member.role !== 'spectator') return { error: 'This match has already started.' };
      rt.room = data;
      rt.member = member;
      await sb.from('room_members').upsert({
        room_code: data.code, user_id: member.id, name: member.name, role: member.role, slot: member.slot || null,
      }, { onConflict: 'room_code,user_id' });
      rt.listen();
      rt.refresh();
      return { room: rt.room };
    };

    rt.listen = function () {
      const roomCode = rt.room && rt.room.code;
      if (!roomCode) return;
      if (channel) sb.removeChannel(channel);
      channel = sb.channel('room-' + roomCode, { config: { presence: { key: rt.member ? rt.member.id : 'anon' } } });
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: 'room_code=eq.' + roomCode }, () => rt.refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'room_code=eq.' + roomCode }, rt.refreshChat)
        .on('presence', { event: 'sync' }, () => rt.updatePresence())
        .subscribe();
      if (rt.member) channel.track({ id: rt.member.id, name: rt.member.name, role: rt.member.role });
    };

    rt.updatePresence = function () {
      const p = channel ? channel.presenceState() : {};
      emit('presence', p);
    };

    rt.roomState = function (state) {
      if (!rt.room) return;
      rt.room.state = state;
      sb.from('rooms').update({ state, status: state && state.running ? 'in_progress' : 'lobby' }).eq('code', rt.room.code).then(() => {});
      emit('state', state);
    };

    rt.refresh = async function () {
      const { data } = await sb.from('room_members').select('*').eq('room_code', rt.room.code).order('role', { ascending: false });
      const specs = (data || []).map((m) => ({ id: m.user_id, name: m.name, role: m.role, slot: m.slot }));
      rt.room.members = specs;
      emit('room:update', rt.room);
    };

    rt.refreshChat = async function () {
      const { data } = await sb.from('messages').select('*').eq('room_code', rt.room.code).order('created_at', { ascending: true }).limit(200);
      emit('chat', data || []);
    };

    rt.sendChat = async function (text) {
      if (!rt.member) return;
      await sb.from('messages').insert({ room_code: rt.room.code, user_id: rt.member.id, name: rt.member.name, text });
      rt.refreshChat();
    };

    rt.admit = async function (userId, slotOrRole) {
      if (!rt.room || rt.room.admin_id !== rt.member.id) return;
      await sb.from('room_members').update({ role: slotOrRole.role || 'player', slot: slotOrRole.slot || null }).eq('room_code', rt.room.code).eq('user_id', userId);
      rt.refresh();
    };

    rt.leave = async function () {
      if (sb && channel) sb.removeChannel(channel);
      channel = null;
    };

    return rt;
  }

  /* ---------------- Local transport (BroadcastChannel) ---------------- */
  function makeLocalRT() {
    const st = { type: 'local' };
    const KEY = 'heroboard.rooms.v1';
    const chan = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('heroboard') : null;
    let room = null;   // { code, game, meta, adminId, status, members:[], state }
    let me = null;

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
      if (msg.type === 'room:update' && room && msg.room && msg.room.code === room.code) {
        room.members = msg.room.members;
        room.status = msg.room.status;
        room.state = msg.room.state;
        save();
        emit('room:update', room);
        emit('state', msg.room.state);
      } else if (msg.type === 'state' && room && msg.code === room.code) {
        room.state = msg.state; save();
        emit('state', msg.state);
      } else if (msg.type === 'chat' && room && msg.code === room.code) {
        emit('chat', msg.msg);
      } else if (msg.type === 'start' && room && msg.code === room.code) {
        room.status = 'in_progress'; save();
        emit('game:start', msg);
      }
    }
    if (chan) { chan.onmessage = (e) => handleMessage(e.data); }
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.indexOf(KEY + '.') === 0) {
        const data = load(room && room.code);
        if (data) { room = data; emit('room:update', room); emit('state', data.state); }
      }
    });

    st.checkUsername = function () { return Promise.resolve({ taken: false }); };

    st.createRoom = async function (r) {
      room = Object.assign({}, r);
      room.status = 'lobby';
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
      room = existing;
      me = member;
      // Add ourselves (dedupe by id).
      if (!room.members.some((m) => m.id === member.id)) {
        if (member.name.toLowerCase() === existing.adminId_name) {}
        room.members.push(member);
        save();
      }
      broadcast({ type: 'room:update', room });
      return { room };
    };

    st.roomState = function (state) {
      if (!room) return;
      room.state = state;
      if (state && state.running) room.status = 'in_progress';
      save();
      broadcast({ type: 'state', code: room.code, state });
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
      if (!m) return;
      m.role = slotOrRole.role || 'player';
      m.slot = slotOrRole.slot || null;
      save();
      broadcast({ type: 'room:update', room });
      emit('room:update', room);
    };

    st.start = function () {
      if (!room || room.adminId !== (me && me.id)) return;
      room.status = 'in_progress';
      save();
      broadcast({ type: 'start', code: room.code });
      emit('game:start', { code: room.code });
    };

    st.leave = function () { /* local channel stays open */ };

    return st;
  }

  /* ---------- select transport ---------- */
  let rt = null;
  function transport() {
    if (rt) return rt;
    rt = makeSupabaseRT();
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
    emit('state', state); // local echo for the actor
  };
  H.sendChat = function (text) { if (rt) rt.sendChat(text); };
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
