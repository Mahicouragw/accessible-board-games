/* ==========================================================================
   common.js — shared DOM helpers + the global game registry.
   http://tiny.cc
   ========================================================================== */
(function (global) {
  'use strict';

  const U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // Create an element from a tag + attrs object + children.
  U.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'disabled') e.disabled = !!v;
        else if (k === 'checked') e.checked = !!v;
        else if (k === 'value') e.value = v;
        else e.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  };

  U.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); };

  // Announce to the live region + speak (delegates to HeroAudio if present).
  U.say = function (text) {
    if (global.HeroAudio) HeroAudio.announce(text);
  };
  U.alertSay = function (text) {
    if (global.HeroAudio) HeroAudio.alert(text);
  };
  // Play a named SFX (safely no-op if audio is off).
  U.sfx = function (name, opts) { if (global.HeroAudio) HeroAudio.play(name, opts); };

  // Focus handling.
  U.focus = function (el) { if (el) try { el.focus(); } catch (e) {} };

  /* Global registry — each game module registers itself here. */
  global.HeroGames = global.HeroGames || {};

  global.HeroUI = U;
})(window);
