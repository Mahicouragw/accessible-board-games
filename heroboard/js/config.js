/* ==========================================================================
   config.js — Runtime configuration for HeroBoard.

   To enable TRUE cross-device online multiplayer, fill in your Supabase URL
   and anon key. When these are present the app automatically switches its
   realtime transport from the local (BroadcastChannel / shared-localStorage)
   fallback to Supabase Postgres + Realtime.

   You can also set these via a <script> that assigns window.HEROBOARD_CONFIG
   before this file runs, or via your host's environment (see supabase.js).
   Leave them blank to run fully local / offline (pass-&-play and same-device
   rooms still work, with zero credentials required).
   ========================================================================== */
window.HEROBOARD_CONFIG = window.HEROBOARD_CONFIG || {};

window.HEROBOARD_CONFIG.supabaseUrl = window.HEROBOARD_CONFIG.supabaseUrl || '';
window.HEROBOARD_CONFIG.supabaseAnonKey = window.HEROBOARD_CONFIG.supabaseAnonKey || '';
