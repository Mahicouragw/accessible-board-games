/* ==========================================================================
   audio.js — Audio engine for HeroBoard — licensed recordings + synthesis
   - Uses licensed crowd recordings for cricket; other cues use Web Audio.
   - Speaks UI/game events with window.speechSynthesis.
   - Supports 3D spatial panning, SFX/music/voice toggles, and a calm BGM loop.
   ========================================================================== */
(function (global) {
  'use strict';

  const A = {};

  /* ---------------------------------------------------------------------
     Settings bridge — audio.js reads a live settings object supplied by
     store.js. Defaults keep the engine safe if bridge is missing.
     --------------------------------------------------------------------- */
  A.settings = { sfx: true, music: false, voice: true, spatial: false };

  // Speech settings fallback (voice rate/pitch can be tuned per-user later).
  A.voiceRate = 0.95;
  A.voicePitch = 1.0;

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let musicNodes = null;
  let stopped=false;
  const sources=new Set();
  const recordedPlayers=[];
  const recorded={four:'boundary-four',five:'five-runs',six:'maximum-six',applause:'milestone'};
  function track(node){sources.add(node);node.onended=()=>{sources.delete(node);try{node.disconnect();}catch(e){}};return node;}
  function recording(name){
    if(!recorded[name])return false;
    let player=recordedPlayers.find(p=>p.paused||p.ended);
    if(!player&&recordedPlayers.length<4){player=new Audio();recordedPlayers.push(player);}
    if(!player)player=recordedPlayers[0];
    player.pause();player.src='assets/audio/'+recorded[name]+'.mp3';player.currentTime=0;player.volume=0.65;
    Promise.resolve(player.play()).catch(()=>{});return true;
  }

  // Ensure the AudioContext is created after a user gesture (autoplay policy).
  function ensureCtx() {
    if(stopped||document.hidden)return null;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = A.settings.sfx ? 0.9 : 0;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = A.settings.music ? 0.35 : 0;
    musicBus.connect(master);
    return ctx;
  }

  /* ---------------------------------------------------------------------
     Generic tone builder.
     --------------------------------------------------------------------- */
  function blip(opts) {
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime + (opts.delay || 0);
    const osc = track(c.createOscillator());
    const gain = c.createGain();
    const filt = c.createBiquadFilter();

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq || 440, t);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t + (opts.dur || 0.2));

    filt.type = opts.filter || 'lowpass';
    filt.frequency.value = opts.filterFreq || 2200;

    const peak = opts.peak != null ? opts.peak : 0.5;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + (opts.attack || 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (opts.dur || 0.2));

    let dest = sfxBus;
    let panner = null;
    if (A.settings.spatial && opts.pan != null) {
      panner = c.createPanner();
      panner.panningModel = 'equalpower';
      panner.setPosition(opts.pan, 0, 0);
      osc.connect(gain); gain.connect(panner); panner.connect(sfxBus);
      dest = null;
    } else {
      osc.connect(gain); gain.connect(filt); filt.connect(sfxBus);
    }

    osc.start(t);
    osc.stop(t + (opts.dur || 0.2) + 0.05);
    return osc;
  }

  // Reusable noise buffer.
  let noiseBuf = null;
  function noise(dur /* sec */) {
    const c = ensureCtx();
    if (!c) return null;
    if (!noiseBuf) {
      const len = c.sampleRate * 1;
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = track(c.createBufferSource());
    src.buffer = noiseBuf; src.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(sfxBus);
    src.start(c.currentTime);
    return { src, g };
  }

  /* ---------------------------------------------------------------------
     SFX library — each returns immediately; all are royalty-free.
     --------------------------------------------------------------------- */
  const sfx = {
    // Neutral match-start cue: two gentle ascending taps, not a result fanfare.
    gameStart() {
      blip({type:'triangle',freq:392,dur:0.11,peak:0.22});
      blip({type:'triangle',freq:523.25,dur:0.14,peak:0.22,delay:0.14});
    },
    // Paced dice-only cue; the controller waits for this phase before speech.
    dicePaced() {
      for(let i=0;i<7;i++) blip({type:'triangle',freq:160+(i%3)*32,dur:0.055,peak:0.22,delay:i*0.10,filter:'highpass',filterFreq:800});
      blip({type:'triangle',freq:125,endFreq:65,dur:0.13,peak:0.3,delay:0.72});
    },
    // Dice bouncing in a cup / shake
    diceShake() {
      for (let i = 0; i < 6; i++) {
        blip({ type: 'triangle', freq: 180 + Math.random() * 60, dur: 0.05, peak: 0.25, delay: i * 0.05, filter: 'highpass', filterFreq: 900 });
      }
      this.diceRoll();
    },
    diceRoll() {
      blip({ type: 'triangle', freq: 140, endFreq: 60, dur: 0.16, peak: 0.4, filter: 'lowpass', filterFreq: 800 });
    },
    // Number click 1..6 — ascending pitch feels like counting.
    click(n) {
      blip({ type: 'sine', freq: 330 + (Number.isFinite(n) ? n : 1) * 60, dur: 0.07, peak: 0.4 });
    },
    tic() { blip({ type: 'sine', freq: 700, dur: 0.05, peak: 0.3 }); },
    // Wooden thud (carrom striker / chess piece)
    thud() {
      blip({ type: 'sine', freq: 110, endFreq: 45, dur: 0.18, peak: 0.5, filter: 'lowpass', filterFreq: 500 });
      noiseRun(0.05, 0.12);
    },
    wood() {
      blip({ type: 'triangle', freq: 220, endFreq: 120, dur: 0.1, peak: 0.35, filter: 'lowpass', filterFreq: 800 });
    },
    // Bat strike (crisp crack) + crowd cheer, depending on context
    bat() {
      // crack
      blip({ type: 'square', freq: 900, endFreq: 200, dur: 0.06, peak: 0.4, filter: 'highpass', filterFreq: 1200 });
      // wood resonance
      blip({ type: 'triangle', freq: 320, endFreq: 90, dur: 0.14, peak: 0.3, filter: 'lowpass', filterFreq: 1000 });
    },
    four() { this.bat(); this.crowd({ big: true }); },
    six() { this.bat(); this.crowd({ big: true, long: true }); },
    // Realistic wicket: bat crack + stump rattle + umpire + roaring crowd
    wicket() {
      this.bat();
      blip({ type: 'square', freq: 1400, endFreq: 220, dur: 0.07, peak: 0.42, filter: 'highpass', filterFreq: 1500 });
      noiseRun(0.07, 0.16);
      this.umpire();
      this.crowd({ big: true, long: true });
    },
    // Distinct run sound per number 1..6 (each pick has its own tone/timbre).
    run(n) {
      const x = Math.max(1, Math.min(6, n || 1));
      const base = 200 + x * 72;
      // resonance of the willow
      blip({ type: 'triangle', freq: base, endFreq: base * 1.35, dur: 0.11, peak: 0.5, filter: 'lowpass', filterFreq: 1300 });
      // crisp contact click
      blip({ type: 'square', freq: base * 1.5, dur: 0.045, peak: 0.28, delay: 0.01, filter: 'highpass', filterFreq: 2200 });
    },
    // Pad/stump-touch sound (bowler)
    bowl() { blip({ type: 'triangle', freq: 240, endFreq: 140, dur: 0.1, peak: 0.2 }); },
    // Rhythmic clapping for a milestone (fifty / century)
    applause() {
      const c = ensureCtx(); if (!c) return;
      const dur = 1.8;
      const { src, g } = noise(dur);
      if (!src) return;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = 1600; filt.Q.value = 1.1;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.26, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(g);
      src.stop(t + dur + 0.1);
      // discrete claps layered over the swell
      for (let i = 0; i < 9; i++) {
        blip({ type: 'triangle', freq: 900 + Math.random() * 800, dur: 0.03, peak: 0.32, delay: 0.06 + i * 0.17, filter: 'highpass', filterFreq: 2600 });
      }
    },
    // Victory fanfare (winning)
    winFanfare() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => blip({ type: 'triangle', freq: f, dur: 0.4, peak: 0.5, delay: i * 0.13, filter: 'lowpass', filterFreq: 3200 }));
      blip({ type: 'sine', freq: 1568, dur: 0.7, peak: 0.32, delay: 0.52, filter: 'lowpass', filterFreq: 4200 });
      this.crowd({ big: true, long: true });
    },
    // Defeat / losing
    loseFall() {
      blip({ type: 'sawtooth', freq: 440, endFreq: 110, dur: 1.1, peak: 0.35, filter: 'lowpass', filterFreq: 900 });
      blip({ type: 'square', freq: 220, endFreq: 80, dur: 1.0, peak: 0.18, delay: 0.1, filter: 'lowpass', filterFreq: 600 });
    },
    // Crisp "tick" for step-by-step board movement (Snakes & Ladders etc.)
    stepTick() { blip({ type: 'triangle', freq: 860, dur: 0.045, peak: 0.5, filter: 'highpass', filterFreq: 1900 }); },
    // Umpire announcement 'Out'
    umpire() {
      blip({ type: 'sawtooth', freq: 220, dur: 0.3, peak: 0.28, filter: 'bandpass', filterFreq: 800 });
      blip({ type: 'sawtooth', freq: 330, dur: 0.3, peak: 0.28, delay: 0.33, filter: 'bandpass', filterFreq: 800 });
    },
    // Crowd murmur / cheer
    crowd(opts) {
      const c = ensureCtx(); if (!c) return;
      const dur = opts && opts.long ? 1.3 : 0.7;
      const peak = opts && opts.big ? 0.28 : 0.16;
      const { src, g } = noise(dur);
      if (!src) return;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 0.6;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(g); // reconnect into chain
      src.stop(t + dur + 0.1);
    },
    // Card shuffle
    shuffle() {
      for (let i = 0; i < 10; i++) blip({ type: 'triangle', freq: 500 + Math.random() * 400, dur: 0.02, peak: 0.15, delay: i * 0.02, filter: 'highpass', filterFreq: 2000 });
    },
    // Chime / success
    chime() { blip({ type: 'sine', freq: 660, dur: 0.3, peak: 0.4, filter: 'lowpass', filterFreq: 2400 }); },
    bell() { blip({ type: 'sine', freq: 1200, dur: 0.4, peak: 0.3 }); },
    // Ladder climb steps
    steps(n) {
      for (let i = 0; i < (n || 3); i++) blip({ type: 'triangle', freq: 300 + i * 40, dur: 0.06, peak: 0.3, delay: i * 0.12, filter: 'lowpass', filterFreq: 700 });
    },
    snake() { blip({ type: 'sawtooth', freq: 900, endFreq: 120, dur: 0.6, peak: 0.4, filter: 'lowpass', filterFreq: 900 }); },
    // Free-Fire style directional ping (pan -1..1)
    ping(pan) { blip({ type: 'sine', freq: 880, dur: 0.18, peak: 0.4, pan }); },
    select() { blip({ type: 'sine', freq: 520, dur: 0.06, peak: 0.3 }); },
    back() { blip({ type: 'sine', freq: 300, dur: 0.08, peak: 0.3 }); },
    error() { blip({ type: 'sawtooth', freq: 180, dur: 0.2, peak: 0.3, filter: 'lowpass', filterFreq: 500 }); },
    whoosh() { blip({ type: 'sine', freq: 500, endFreq: 1500, dur: 0.2, peak: 0.2 }); },
  };

  // Helper to play a short noise burst with fade.
  function noiseRun(dur, peak) {
    const c = ensureCtx(); if (!c) return;
    const { src, g } = noise(dur);
    if (!src) return;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.stop(t + dur + 0.05);
  }

  /* ---------------------------------------------------------------------
     Background music — calm, royalty-free ambient loop generated live.
     --------------------------------------------------------------------- */
  A.startMusic = function () {
    const c = ensureCtx(); if (!c) return;
    if (musicNodes) return;
    const t = c.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.25, 392.0, 329.6]; // C-E-G-C-G-E
    const gain = c.createGain(); gain.gain.value = 0.5; gain.connect(musicBus);
    musicNodes = [];
    let time = t;
    notes.forEach((f, i) => {
      const osc = track(c.createOscillator());
      osc.type = 'sine'; osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.28, time + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);
      osc.connect(g); g.connect(gain);
      osc.start(time); osc.stop(time + 2.7);
      musicNodes.push(osc);
      time += 0.9;
    });
  };
  A.stopMusic = function () {
    if (!musicNodes) return;
    musicNodes.forEach((o) => { try { o.stop(); } catch (e) {} });
    musicNodes = null;
  };

  /* ---------------------------------------------------------------------
     Hard-stop all game audio. Use when the game screen closes, the tab is
     hidden, or the page is about to unload. Silences the whole graph,
     cuts any in-flight speech, and suspends the AudioContext so no SFX,
     loop, or tail keeps playing in the background.
     --------------------------------------------------------------------- */
  A.stopAll = function () {
    stopped=true;
    recordedPlayers.forEach(p=>{p.pause();p.currentTime=0;});
    sources.forEach(n=>{try{n.stop();n.disconnect();}catch(e){}});sources.clear();
    A.stopMusic();
    A.cancelSpeech();
    try { if (ctx && master) master.gain.value = 0; } catch (e) {}
    try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {}
  };
  // Re-arm audio after a stop (e.g. the tab becomes visible again).
  A.resumeAll = function () {
    if(document.hidden)return;stopped=false;
    try { if (ctx && master) master.gain.value = 0.9; } catch (e) {}
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  };

  /* ---------------------------------------------------------------------
     Speech — window.speechSynthesis wrapper with guidance + queue.
     --------------------------------------------------------------------- */
  let speechFinish = null;
  A.cancelSpeech = function () {
    if(speechFinish)speechFinish(false);
    try { global.speechSynthesis?.cancel(); } catch(e) {}
  };
  function speakAsync(text, opts = {}) {
    A.cancelSpeech();
    if(stopped||document.hidden||opts.signal?.aborted)return Promise.resolve(false);
    if(!A.settings.voice||!global.speechSynthesis||!global.SpeechSynthesisUtterance)return Promise.resolve(true);
    return new Promise(resolve=>{
      let timer=null,settled=false;
      const finish=ok=>{
        if(settled)return;settled=true;clearTimeout(timer);
        opts.signal?.removeEventListener('abort',abort);
        if(speechFinish===finish)speechFinish=null;
        resolve(ok);
      };
      const abort=()=>{finish(false);try{global.speechSynthesis.cancel();}catch(e){}};
      speechFinish=finish;
      opts.signal?.addEventListener('abort',abort,{once:true});
      try {
        const synth=global.speechSynthesis,u=new global.SpeechSynthesisUtterance(text);
        u.rate=A.voiceRate;u.pitch=A.voicePitch;u.lang=opts.lang||'en-US';u.volume=1;
        const voices=synth.getVoices(),en=voices.filter(v=>/^en[-_]/.test(v.lang));
        if(en.length)u.voice=en[0];
        u.onend=()=>finish(true);
        // Missing/broken browser voices must not strand an AI turn.
        u.onerror=()=>finish(true);
        timer=setTimeout(()=>{try{synth.cancel();}catch(e){}finish(true);},Math.min(30000,Math.max(2500,String(text).length*110)));
        synth.speak(u);
      } catch(e) { finish(true); }
    });
  }
  A.speak = function(text,opts){return speakAsync(text,opts);};
  A.announceAndWait = function(text,opts){
    const live=document.getElementById('sr-live');
    if(live&&!document.hidden){live.textContent='';live.textContent=text;}
    return speakAsync(text,opts);
  };

  // High-level announce — writes to live regions + speaks.
  A.announce = function (text) {
    const live = document.getElementById('sr-live');
    if (live) { live.textContent = ''; live.textContent = text; }
    A.speak(text);
  };
  A.alert = function (text) {
    const alertEl = document.getElementById('sr-alert');
    if (alertEl) { alertEl.textContent = ''; alertEl.textContent = text; }
    A.speak(text, { rate: 1.05 });
  };

  /* ---------------------------------------------------------------------
     Public API.
     --------------------------------------------------------------------- */
  A.play = function (name, opts) {
    if(!A.settings.sfx||stopped||document.hidden)return;
    if(recording(name))return;
    const c = ensureCtx();
    if (!c) return;
    if (!A.settings.sfx) return;
    const fn = sfx[name];
    if (fn) fn.call(sfx, opts);
  };

  A.applySettings = function (s) {
    if (!s) return;
    A.settings = Object.assign({}, A.settings, s);
    if (ctx && sfxBus) sfxBus.gain.value = A.settings.sfx ? 0.9 : 0;
    if (ctx && musicBus) musicBus.gain.value = A.settings.music ? 0.35 : 0;
    if (A.settings.music && !musicNodes) A.startMusic();
    if (!A.settings.music) A.stopMusic();
    if(!A.settings.sfx)recordedPlayers.forEach(p=>p.pause());
    if(!A.settings.voice)A.cancelSpeech();
  };

  A.unlock = function () { A.resumeAll();ensureCtx(); if (musicNodes) {} };
  A.sfx = sfx;

  // Expose a couple of helpers used by games.
  A.dice = function (roll) { sfx.diceShake(); setTimeout(function () { if (roll) sfx.click(roll); }, 250); };

  global.HeroAudio = A;
})(window);
