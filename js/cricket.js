/* Captain's Hand Cricket — classic fair rules, adaptive AI, private local picks,
 * and captain-drafted trusted-device rooms with commit/reveal number locks. */
(function(global){
  'use strict';
  const U=global.HeroUI,C=global.HeroCricketRoom;
  const META={id:'cricket',title:'Captain’s Hand Cricket',emoji:'🏏',desc:'Draft your team. Match numbers: out. Otherwise score your number. Four, five and six have distinct recorded crowd effects.',tags:['Captains','AI','1–6']};
  const OPTIONS=[
    {key:'level',label:'AI difficulty',type:'range',min:1,max:5,default:2,hint:'Higher levels learn your previous choices. The AI never reads your current secret pick.'},
    {key:'overs',label:'Overs per side',type:'select',default:'2',options:[1,2,3,5,10,20].map(n=>[String(n),n+' overs ('+n*6+' balls)']),hint:'Exactly six legal balls per over.'},
    {key:'wickets',label:'Wickets per side',type:'select',default:'1',options:[1,2,3,4,5,6,7,8,9,10,11,15,16,17].map(n=>[String(n),n+' wicket'+(n===1?'':'s')]),hint:'10 wickets for conventional 11-player cricket. Extra-wicket formats give the roster another life when needed.'},
    {key:'squad',label:'Players per team, including captain',type:'select',default:'1',options:[1,2,3,5,11].map(n=>[String(n),n+' per team'])},
    {key:'youBatFirst',label:'First innings against AI',type:'select',default:'true',options:[['true','You bat first'],['false','AI bats first']]}
  ];
  function start(hostEl,cfg0,api){
    const cfg={mode:'ai',youBatFirst:true,...cfg0},online=cfg.mode==='online',net=api.net;
    const human=cfg.youBatFirst===false||cfg.youBatFirst==='false'?'B':'A';
    const myId=api.profile?.id,options=C.options(cfg),teams={};
    for(const k of ['A','B'])teams[k]={name:cfg.mode==='ai'?(k===human?'You':'AI'):(k==='A'?'Player 1':'Player 2'),members:Array.from({length:options.squad},(_,i)=>({id:k+i,name:(k==='A'?'Team 1':'Team 2')+' player '+(i+1)}))};
    let s=online?net.currentRoom()?.state?.cricket?.match:C.match(cfg,teams);
    // A room match only starts after its draft is complete.
    if(!s){hostEl.textContent='Waiting for the host to finish the captain draft and start.';return {destroy(){U.clear(hostEl);}};}
    let active=true,pending=null,busy=false,locked=null,heard=s.ballNo,recorded=false,revealing=false;
    const command=async action=>{const result=await net.cricketAction(action);if(result?.error)U.alertSay(result.error);return result;};
    function announceBall(){
      if(s.last&&s.last.id>heard){heard=s.last.id;U.sfx(s.last.cue,s.last.runs);if(s.last.milestone)U.sfx('applause');U.say(s.last.text);}
      if(s.done&&!recorded){recorded=true;if(!online)api.store?.recordGame?.(myId,'cricket',s.winner==='tie'?'draw':s.winner===human?'win':'loss',{runs:s.sides[human].runs,balls:s.sides[human].balls,best:s.sides[human].runs});}
    }
    function identity(){const c=net.currentRoom()?.state?.cricket;return c?C.teamFor(c,myId):null;}
    async function receive(){
      if(!active)return;
      const next=net.currentRoom()?.state?.cricket?.match;if(!next)return;s=next;
      if(locked&&locked.ball!==s.ballNo){locked=null;busy=false;revealing=false;}
      announceBall();render();
      if(locked&&s.commits.bat&&s.commits.bowl&&!s.reveals[locked.role]&&!revealing){
        revealing=true;await command({type:'reveal',...locked});revealing=false;
      }
    }
    function render(){
      if(!active)return;
      const previous=hostEl.contains(document.activeElement)?document.activeElement.getAttribute('data-focus'):null;
      U.clear(hostEl);
      if(online&&net.currentRoom()?.status==='closed'){hostEl.appendChild(U.el('h2',null,['Room closed']));hostEl.appendChild(U.el('p',{role:'status'},['The host has left. Use Back, then create or join a new room.']));return;}
      const h=U.el('h2',{tabindex:'-1','data-focus':'heading'},[META.title]);hostEl.appendChild(h);
      const sd=s.sides[s.batting],other=s.sides[s.batting==='A'?'B':'A'];
      hostEl.appendChild(U.el('p',{class:'hint'},[`${options.overs} overs • ${options.wickets} wickets • Matching numbers are always out. No random umpire decisions.`]));
      const scores=U.el('div',{class:'scoreboard'});
      for(const k of ['A','B']){const t=s.sides[k];scores.appendChild(U.el('p',null,[`${t.name}: ${t.runs} for ${t.wickets}. ${Math.floor(t.balls/6)} overs and ${t.balls%6} balls.`]));}
      hostEl.appendChild(scores);
      if(s.last)hostEl.appendChild(U.el('p',{class:'run-announce'},[s.last.text]));
      if(s.target!==null&&!s.done)hostEl.appendChild(U.el('p',null,[`Target ${s.target}. Need ${Math.max(0,s.target-sd.runs)} from ${options.overs*6-sd.balls} balls.`]));
      if(s.done){
        hostEl.appendChild(U.el('h3',null,[s.winner==='tie'?'Match tied':s.sides[s.winner].name+' win!']));
        if(!online){const again=U.el('button',{type:'button',class:'btn'},['Play again']);again.onclick=()=>{destroy();start(hostEl,cfg0,api);};hostEl.appendChild(again);}
        else hostEl.appendChild(U.el('p',null,['Leave and create a new room for a rematch.']));
      }else{
        hostEl.appendChild(U.el('p',null,[sd.name+' batting; '+other.name+' bowling.']));
        if(online){
          const room=net.currentRoom(),c=room.state.cricket,myTeam=identity();
          hostEl.appendChild(U.el('p',{class:'hint'},['Trusted same-device room. Keep the host tab open. Picks are hash-locked before either number is revealed.']));
          if(myTeam&&c.teams[myTeam].captain===myId){
            const panel=U.el('fieldset');panel.appendChild(U.el('legend',null,['Captain controls — '+c.teams[myTeam].name]));
            for(const role of ['bat','bowl']){
              const label=U.el('label',null,[role==='bat'?'Active batter':'Active bowler']);const sel=U.el('select',{'data-focus':'captain-'+role,'aria-label':role==='bat'?'Your team’s active batter':'Your team’s active bowler'});
              for(const p of s.sides[myTeam].roster){if(role==='bat'&&p.out)continue;const o=U.el('option',{value:p.id},[p.name]);o.selected=p.id===s.sides[myTeam][role==='bat'?'activeBat':'activeBowl'];sel.appendChild(o);}
              sel.disabled=Object.keys(s.commits).length>0;sel.onchange=()=>command({type:'active',team:myTeam,role,player:sel.value});label.appendChild(sel);panel.appendChild(label);
            }hostEl.appendChild(panel);
          }
          const role=C.actor(s,'bat')===myId?'bat':C.actor(s,'bowl')===myId?'bowl':null;
          if(role&&!s.commits[role]&&!busy)hostEl.appendChild(numberPad(role));
          else hostEl.appendChild(U.el('p',{role:'status'},[!myTeam?'Spectating — you cannot submit picks.':role?'Pick locked. Waiting for both players.':'Your captain chooses the active players. You are a co-player this ball.']));
        }else{
          const role=cfg.mode==='ai'?(s.batting===human?'bat':'bowl'):(pending?'bowl':'bat');
          const who=role==='bat'?sd.name:other.name;
          hostEl.appendChild(U.el('h3',null,[who+' — '+(role==='bat'?'bat':'bowl')]));
          if(pending)hostEl.appendChild(U.el('p',null,['Batter’s choice is hidden. Pass the device to the bowler.']));
          hostEl.appendChild(numberPad(role));
        }
      }
      const roster=U.el('details');roster.appendChild(U.el('summary',null,['Team scorecards']));
      for(const k of ['A','B']){roster.appendChild(U.el('h3',null,[s.sides[k].name]));const list=U.el('ul');s.sides[k].roster.forEach(p=>list.appendChild(U.el('li',null,[`${p.name}: ${p.runs} runs, ${p.balls} balls${p.out?', out':''}`])));roster.appendChild(list);}hostEl.appendChild(roster);
      if(previous){const target=[...hostEl.querySelectorAll('[data-focus]')].find(e=>e.getAttribute('data-focus')===previous);U.focus(target||h);}
    }
    function numberPad(role){
      const panel=U.el('div',{class:'numpad','aria-label':role==='bat'?'Batting numbers':'Bowling numbers'});
      for(let n=1;n<=6;n++){const b=U.el('button',{type:'button','aria-label':'Pick number '+n,'data-focus':'pick-'+n},[String(n)]);b.disabled=busy;b.onclick=()=>submit(role,n);panel.appendChild(b);}return panel;
    }
    function aiPick(role){
      // Read previous balls only; never the number selected on this ball.
      if(Math.random()>(options.level-1)/5)return 1+Math.floor(Math.random()*6);
      const counts=Array(7).fill(0);s.hist.slice(-18).forEach(h=>counts[role==='bowl'?h.batN:h.bowlN]++);
      const pool=[1,2,3,4,5,6];const score=n=>counts[n];pool.sort((a,b)=>role==='bowl'?score(b)-score(a):score(a)-score(b));
      const best=pool.filter(n=>score(n)===score(pool[0]));return best[Math.floor(Math.random()*best.length)];
    }
    async function submit(role,n){
      if(!active||s.done||busy||!Number.isInteger(n)||n<1||n>6)return;
      if(online){
        if(C.actor(s,role)!==myId||s.commits[role]||!['bat','bowl'].includes(role))return;
        busy=true;render();
        try{
          const bytes=global.crypto.getRandomValues(new Uint8Array(16));const nonce=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
          locked={ball:s.ballNo,role,n,nonce};const hash=await C.digest(net.currentRoom().code,s.ballNo,role,n,nonce);
          const result=await command({type:'commit',ball:s.ballNo,role,hash});if(result?.error){locked=null;busy=false;render();}else U.say('Pick locked. Waiting for both players.');
        }catch(e){busy=false;locked=null;U.alertSay(e.message);render();}
      }else if(cfg.mode==='ai'){
        const humanBat=s.batting===human;const ai=aiPick(humanBat?'bowl':'bat');C.ball(s,humanBat?n:ai,humanBat?ai:n);announceBall();render();
      }else if(!pending){
        if(role!=='bat')return;pending=n;U.say('Batter’s pick is locked and hidden. Pass the device to the bowler.');render();
      }else{
        if(role!=='bowl')return;const bat=pending;pending=null;C.ball(s,bat,n);announceBall();render();
      }
    }
    function destroy(){active=false;net.off('state',receive);U.clear(hostEl);}
    if(online)net.on('state',receive);
    U.say(s.sides.A.name+' bat first. Matching numbers are out. '+options.overs+' overs, '+options.wickets+' wickets per side.');render();
    return {destroy,render,submit,get state(){return s;},meta:META};
  }
  global.HeroGames.cricket={meta:META,options:OPTIONS,start};
})(window);
