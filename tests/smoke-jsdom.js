/* jsdom smoke test: loads each /play/* route (and /) from the running prod
 * server, executes the real client JS (hydration), and reports page errors.
 * Not part of the unit suite — run manually: node tests/smoke-jsdom.js [base]
 * Requires jsdom (npm i --no-save jsdom). */
const { JSDOM, VirtualConsole } = require("jsdom");

const BASE = process.argv[2] || "http://localhost:3100";
const GAMES = [
  "tic-tac-toe", "connect-four", "rock-paper-scissors", "memory", "2048",
  "snake", "ludo", "snake-ladder", "carrom", "chess", "cricket",
  "hand-cricket", "checkers", "dominoes", "sudoku", "minesweeper",
  "football-penalty", "tetris", "basketball", "monster-battle",
  "dice-race", "sound-simon", "reaction-rush", "sound-memory",
];
const PAGES = ["/", "/sound-studio", ...GAMES.map((g) => `/play/${g}`)];

function stubWindow(window) {
  const streams = require("stream/web");
  window.ReadableStream = window.ReadableStream || streams.ReadableStream;
  window.WritableStream = window.WritableStream || streams.WritableStream;
  window.TransformStream = window.TransformStream || streams.TransformStream;
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
  window.speechSynthesis = window.speechSynthesis || { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [] };
  window.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance || class { constructor(t) { this.text = t; } };
  if (!window.AudioContext && !window.webkitAudioContext) {
    class FakeParam { constructor() { this.value = 0; } setValueAtTime() {} linearRampToValueAtTime() {} }
    class FakeNode { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.playbackRate = new FakeParam(); } connect() { return this; } disconnect() {} start() {} stop() {} }
    window.AudioContext = class { constructor() { this.currentTime = 0; this.destination = new FakeNode(); this.state = "running"; } createGain() { return new FakeNode(); } createOscillator() { return new FakeNode(); } createBufferSource() { return new FakeNode(); } createBuffer() { return { getChannelData: () => new Float32Array(128), duration: 1, length: 128, numberOfChannels: 1, sampleRate: 44100 }; } decodeAudioData(_d, cb) { const b = this.createBuffer(); if (cb) cb(b); return Promise.resolve(b); } resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } }
  }
  window.HTMLMediaElement.prototype.play = window.HTMLMediaElement.prototype.play || function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = window.HTMLMediaElement.prototype.pause || function () {};
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, { get: (t, k) => (k === "canvas" ? this : (typeof k === "string" ? function () { return undefined; } : undefined)), set: () => true });
  };
  window.navigator.vibrate = window.navigator.vibrate || (() => true);
  window.URL.createObjectURL = window.URL.createObjectURL || (() => "blob:fake");
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
}

async function loadPage(path) {
  const errors = [];
  const safe = (e) => {
    try {
      const m = (e && e.detail && e.detail.message) || (e && e.message) || String(e);
      return String(m).split("\n")[0].slice(0, 300);
    } catch {
      return "<unprintable error>";
    }
  };
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    const msg = safe(e);
    if (/Could not load|css|favicon|ECONNREFUSED|socket/i.test(msg)) return;
    errors.push(msg);
  });
  vc.on("error", (m) => errors.push(safe(m)));
  const dom = await JSDOM.fromURL(BASE + path, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      stubWindow(window);
      const guest = { id: 424242, name: "Smoke Tester", code: "SMOKE1", avatar: "🧪", wins: 3, losses: 1, draws: 0, totalGames: 4, xp: 350 };
      window.localStorage.setItem("arcade_guest_player", JSON.stringify(guest));
      window.localStorage.setItem("arcade_player_code", "SMOKE1");
      window.addEventListener("error", (ev) => errors.push("window.onerror: " + safe(ev.error || ev.message)));
      window.addEventListener("unhandledrejection", (ev) => errors.push("unhandledrejection: " + safe(ev.reason)));
    },
  });
  await new Promise((r) => setTimeout(r, 7000));
  const body = dom.window.document.body;
  const text = body ? (body.textContent || "") : "";
  const buttons = body ? body.querySelectorAll("button").length : 0;
  const title = dom.window.document.title;
  dom.window.close();
  return { errors: [...new Set(errors)], text, title, buttons };
}

(async () => {
  let fail = 0;
  if (process.env.HOME_TEXT_CHECK) {
    const { errors, text } = await loadPage("/");
    console.log("Vs AI tab on home:", text.includes("Vs AI"));
    console.log("tab labels:", ["Home","Games","Multiplayer","Local Multi","Vs AI","Rooms","Notifications","Settings"].map((t) => t + "=" + text.includes(t)).join(" "));
    console.log("errors:", errors.length ? errors.slice(0,3) : "none");
    process.exit(0);
  }
  for (const p of PAGES) {
    try {
      const { errors, text, buttons } = await loadPage(p);
      const bad = errors.filter((e) => !/hydrat|ChunkLoadError|Loading chunk/i.test(e));
      const status = bad.length ? "FAIL" : "ok";
      if (bad.length) fail++;
      console.log(`${status.padEnd(4)} ${p.padEnd(28)} len=${text.length} btns=${buttons} ${bad.length ? "\n     " + bad.slice(0, 4).join("\n     ") : ""}`);
    } catch (e) {
      fail++;
      console.log(`FAIL ${p} threw: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  console.log(fail ? `\n${fail} page(s) with errors` : "\nAll pages clean");
  process.exit(fail ? 1 : 0);
})();
