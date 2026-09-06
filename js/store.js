/* ==========================================================================
   store.js — Profiles, unique-name validation, settings & stats.
   Persists to localStorage. Cross-device uniqueness is delegated to net.js
   (Supabase) with an offline fallback that only checks this device.
   ========================================================================== */
(function (global) {
  'use strict';

  const NS = 'heroboard.v1.';
  const KEY_PROFILE = NS + 'profile';
  const KEY_SESSION = NS + 'session';
  const KEY_SETTINGS = NS + 'settings';
  const KEY_STATS = NS + 'stats'; // keyed by profile id
  const KEY_NAMES = NS + 'names'; // index of usernames claimed on this device
  const NAME_RE = /^[A-Za-z0-9_-]{3,24}$/;

  const S = {};

  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------- default settings ---------- */
  S.defaultSettings = function () {
    return { sfx: true, music: false, voice: true, spatial: false, motion: false, theme: 'hc' };
  };

  S.getSettings = function () {
    return Object.assign(S.defaultSettings(), read(KEY_SETTINGS, {}));
  };
  S.saveSettings = function (s) { write(KEY_SETTINGS, s); if (global.HeroAudio) HeroAudio.applySettings(s); };
  // Keep audio + body always in sync with stored settings.
  S.applySettings = function () {
    const s = S.getSettings();
    document.body.classList.toggle('reduce-motion', !!s.motion);
    document.body.classList.toggle('theme-dark', s.theme === 'dark');
    document.body.classList.toggle('theme-light', s.theme === 'light');
    if (global.HeroAudio) HeroAudio.applySettings(s);
    return s;
  };

  /* ---------- id generation ---------- */
  function genId() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 10; i++) s += chars[(Math.random() * chars.length) | 0];
    return 'HB-' + s;
  }

  /* ---------- profile + session ---------- */
  S.getProfile = function () { return read(KEY_PROFILE, null); };
  S.saveProfile = function (p) { write(KEY_PROFILE, p); };
  S.signIn = function (p) {
    S.saveProfile(p);
    write(KEY_SESSION, { id: p.id, at: Date.now() });
    // Remember this name so a re-creation on this device is flagged as taken.
    const names = read(KEY_NAMES, []);
    if (p && p.name && !names.includes(p.name.toLowerCase())) { names.push(p.name.toLowerCase()); write(KEY_NAMES, names); }
  };
  S.current = function () {
    const sess = read(KEY_SESSION, null);
    const p = read(KEY_PROFILE, null);
    if (sess && p && sess.id === p.id) return p;
    return null;
  };
  S.signOut = function () { write(KEY_SESSION, null); try { localStorage.removeItem(KEY_PROFILE); } catch (e) {} };

  /* ---------- name validation ---------- */
  S.nameValid = function (name) { return NAME_RE.test(name); };
  S.nameError = function (name) {
    if (!name) return 'Please enter a hero name.';
    if (!NAME_RE.test(name)) return 'Names use only letters, numbers, hyphens or underscores and must be 3–24 characters.';
    return null;
  };

  // Check uniqueness. Returns a Promise<void> that rejects on a taken/error.
  S.checkUnique = async function (name) {
    const key = String(name).toLowerCase();
    // Local device index of names already claimed on this device (instant).
    if (read(KEY_NAMES, []).includes(key)) {
      throw new Error('This name is already used. This is a multiplayer game, please use another hero, another name, or sign in with your ID.');
    }
    // Ask the network layer (Supabase) for cross-device uniqueness.
    if (global.HeroNet && HeroNet.checkUsername) {
      const res = await HeroNet.checkUsername(name);
      if (res.error) throw new Error(res.error);
      if (res.taken) {
        throw new Error('This name is already used. This is a multiplayer game, please use another hero, another name, or sign in with your ID.');
      }
    }
  };

  /* ---------- stats (keyed per profile) ---------- */
  S.allStats = function () { return read(KEY_STATS, {}); };
  S.getStats = function (id) {
    if (!id) return {};
    return S.allStats()[id] || {};
  };
  S.recordGame = function (id, game, outcome, detail) {
    if (!id) return;
    const all = S.allStats();
    const g = all[id] = all[id] || {};
    const rec = g[game] = g[game] || { played: 0, wins: 0, losses: 0, draws: 0, runs: 0, wickets: 0, balls: 0, best: 0 };
    rec.played += 1;
    if (outcome === 'win') rec.wins += 1;
    else if (outcome === 'loss') rec.losses += 1;
    else if (outcome === 'draw') rec.draws += 1;
    if (detail) {
      rec.runs += detail.runs || 0;
      rec.wickets += detail.wickets || 0;
      rec.balls += detail.balls || 0;
      if ((detail.best || 0) > rec.best) rec.best = detail.best;
    }
    write(KEY_STATS, all);
  };

  /* ---------- overall player level ---------- */
  function levelFor(p) {
    if (!p) return 1;
    const st = S.getStats(p.id);
    let count = 0;
    Object.keys(st).forEach((g) => { count += st[g].played || 0; });
    return Math.max(1, 1 + Math.floor(count / 4));
  }

  S.level = function (p) { return levelFor(p || S.current()); };
  S.totals = function (p) {
    p = p || S.current();
    const st = S.getStats(p && p.id);
    let played = 0, wins = 0;
    Object.keys(st).forEach((g) => { played += st[g].played || 0; wins += st[g].wins || 0; });
    return { played, wins, games: Object.keys(st).length };
  };

  /* ---------- clipboard ---------- */
  S.copy = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
      throw new Error('no clipboard');
    } catch (e) {
      // Fallback for the sandboxed preview / non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      return ok;
    }
  };

  global.HeroStore = S;
})(window);
