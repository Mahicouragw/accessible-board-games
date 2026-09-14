/* Captain's Hand Cricket: deterministic rules and room command validation.
 * Local rooms are trusted same-device sessions, not an authenticated server.
 * This reducer must run behind authenticated server commands before internet use.
 */
(function (global) {
  'use strict';
  const C = {};
  const other = s => s === 'A' ? 'B' : 'A';
  const copy = x => JSON.parse(JSON.stringify(x));
  C.options = cfg => ({
    overs: [1,2,3,5,10,20].includes(+cfg.overs) ? +cfg.overs : 2,
    wickets: [1,2,3,4,5,6,7,8,9,10,11,15,16,17].includes(+cfg.wickets) ? +cfg.wickets : 1,
    squad: [1,2,3,5,11].includes(+cfg.squad) ? +cfg.squad : 1,
    level: Math.max(1, Math.min(5, +cfg.level || 1))
  });
  C.match = function (cfg, teams) {
    const options = C.options(cfg), sides = {};
    for (const sym of ['A','B']) {
      const team = teams[sym];
      const roster = team.members.map((p,i) => ({ id:p.id || sym+i, name:p.name, runs:0, balls:0, out:false }));
      sides[sym] = { name:team.name, roster, wickets:0, runs:0, balls:0, activeBat:roster[0].id, activeBowl:roster[0].id };
    }
    return { options, sides, batting:'A', target:null, ballNo:0, hist:[], done:false, winner:null, last:null, commits:{}, reveals:{} };
  };
  C.ball = function (s, bat, bowl) {
    if (s.done || ![bat,bowl].every(n => Number.isInteger(n) && n>=1 && n<=6)) throw Error('Choose a number from 1 to 6.');
    const sym=s.batting, sd=s.sides[sym], player=sd.roster.find(p=>p.id===sd.activeBat);
    const out=bat===bowl, runs=out?0:bat, previous=sd.runs;
    player.balls++; sd.balls++; sd.runs+=runs; player.runs+=runs;
    if(out) {
      sd.wickets++; player.out=true;
      let next=sd.roster.find(p=>!p.out);
      // Extra-wicket arcade formats deliberately allow another life, not phantom wickets.
      if(!next && sd.wickets<s.options.wickets) { sd.roster.forEach(p=>p.out=false); next=sd.roster[0]; }
      if(next) sd.activeBat=next.id;
    }
    s.ballNo++; s.hist.push({batN:bat,bowlN:bowl});
    let text=`${sd.name}: batter ${bat}, bowler ${bowl}. `;
    text+=out?`${player.name} is OUT! `:runs===4?'FOUR! Boundary! ':runs===6?'SIX! Over the boundary! ':`${runs} runs! `;
    text+=`${sd.runs} for ${sd.wickets} in ${Math.floor(sd.balls/6)} overs and ${sd.balls%6} balls.`;
    const milestone=Math.floor(sd.runs/50)>Math.floor(previous/50);
    if(milestone) text+=` ${sd.runs>=100?'Century milestone!':'Fifty!'} The crowd applauds.`;
    const ended=(s.target!==null&&sd.runs>=s.target)||sd.wickets>=s.options.wickets||sd.balls>=s.options.overs*6;
    if(ended) {
      if(s.target===null) { s.target=sd.runs+1;s.batting=other(sym);text+=` ${s.sides[s.batting].name} need ${s.target} to win.`; }
      else {s.done=true;s.winner=s.sides.A.runs===s.sides.B.runs?'tie':s.sides.A.runs>s.sides.B.runs?'A':'B';text+=s.winner==='tie'?' Match tied.':` ${s.sides[s.winner].name} win!`;}
    }
    s.last={id:s.ballNo,text,cue:out?'wicket':runs===4?'four':runs===5?'five':runs===6?'six':'run',runs,milestone};
    s.commits={}; s.reveals={};
    return s;
  };
  C.digest = async function (code,ball,role,n,nonce) {
    if(!global.crypto?.subtle) throw Error('A secure browser context is required to lock room picks.');
    const bytes=new global.TextEncoder().encode(JSON.stringify([code,ball,role,n,nonce]));
    const hash=await global.crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  };
  C.teamFor = (c,id) => ['A','B'].find(sym=>c.teams[sym].members.includes(id)) || null;
  C.actor = (s,role) => role==='bat'?s.sides[s.batting].activeBat:s.sides[other(s.batting)].activeBowl;
  C.reduce = async function (original, actor, action) {
    const r=copy(original), a=action || {};
    if(r.game!=='cricket'||!r.members.some(m=>m.id===actor)) throw Error('Join this cricket room first.');
    if(r.status==='closed')throw Error('This room has closed. Create or join a new room.');
    const requireHost=()=>{if(r.adminId!==actor)throw Error('Only the host can do that.');};
    let c=r.state?.cricket;
    if(a.type==='setup') {
      requireHost(); if(r.status==='in_progress')throw Error('The match has already started.');
      const ids=[a.captainA,a.captainB], size=+a.size;
      if(ids[0]===ids[1]||!ids.every(id=>r.members.some(m=>m.id===id))||![1,2,3,5,11].includes(size))throw Error('Choose two different joined captains and a valid team size.');
      const name=v=>String(v||'').trim().slice(0,40);
      if(!name(a.nameA)||!name(a.nameB)||name(a.nameA).toLowerCase()===name(a.nameB).toLowerCase())throw Error('Give the teams different names.');
      c={size,turn:'A',phase:size===1?'ready':'draft',teams:{A:{name:name(a.nameA),captain:ids[0],members:[ids[0]]},B:{name:name(a.nameB),captain:ids[1],members:[ids[1]]}}};
      r.state={...(r.state||{}),cricket:c};
    } else {
      if(!c)throw Error('The host must choose teams and captains first.');
      const sym=C.teamFor(c,actor);
      if(a.type==='draft') {
        if(c.phase!=='draft'||!sym||c.turn!==sym||c.teams[sym].captain!==actor)throw Error('Wait for your captain’s draft turn.');
        if(C.teamFor(c,a.player)||!r.members.some(m=>m.id===a.player))throw Error('Choose an unassigned joined player.');
        c.teams[sym].members.push(a.player);
        c.turn=other(sym);
        if(['A','B'].every(k=>c.teams[k].members.length===c.size))c.phase='ready';
      } else if(a.type==='start') {
        requireHost();if(c.phase!=='ready'||!['A','B'].every(k=>c.teams[k].members.every(id=>r.members.some(m=>m.id===id))))throw Error('Complete both teams before starting.');
        const teams={};for(const k of ['A','B'])teams[k]={name:c.teams[k].name,members:c.teams[k].members.map(id=>r.members.find(m=>m.id===id))};
        c.match=C.match({...r.meta,squad:c.size},teams);c.phase='playing';r.status='in_progress';
      } else if(a.type==='active') {
        if(c.phase!=='playing'||!sym||c.teams[sym].captain!==actor||a.team!==sym)throw Error('Captains can select players only from their own team.');
        if(Object.keys(c.match.commits).length)throw Error('Selections are locked until this ball finishes.');
        const sd=c.match.sides[sym];
        if(!r.members.some(m=>m.id===a.player)||!['bat','bowl'].includes(a.role)||!sd.roster.some(p=>p.id===a.player&&(a.role!=='bat'||!p.out)))throw Error('Choose an available teammate.');
        sd[a.role==='bat'?'activeBat':'activeBowl']=a.player;
      } else if(a.type==='commit'||a.type==='reveal') {
        const s=c.match;
        if(c.phase!=='playing'||!s||s.done||a.ball!==s.ballNo||!['bat','bowl'].includes(a.role)||C.actor(s,a.role)!==actor)throw Error('It is not your turn for this ball.');
        if(a.type==='commit') {
          if(s.commits[a.role]||!/^[0-9a-f]{64}$/.test(a.hash))throw Error('Your pick is already locked or invalid.');
          s.commits[a.role]=a.hash;
        } else {
          if(!s.commits.bat||!s.commits.bowl||s.reveals[a.role])throw Error('Both picks must be locked before revealing.');
          if(!Number.isInteger(a.n)||a.n<1||a.n>6||!/^[0-9a-f]{32}$/.test(a.nonce))throw Error('Invalid pick.');
          if(await C.digest(r.code,a.ball,a.role,a.n,a.nonce)!==s.commits[a.role])throw Error('The revealed pick does not match the locked pick.');
          s.reveals[a.role]=a.n;
          if(s.reveals.bat&&s.reveals.bowl) {C.ball(s,s.reveals.bat,s.reveals.bowl);if(s.done)c.phase='finished';}
        }
      } else throw Error('Unknown room action.');
    }
    if(c) for(const m of r.members) {const sym=C.teamFor(c,m.id);m.role=sym?'player':'spectator';m.slot=sym==='A'?0:sym==='B'?1:null;}
    return r;
  };
  global.HeroCricketRoom=C;
})(window);
