/* Snakes & Ladders: one cancellable turn pipeline.
 * start cue -> introduction; dice only -> roll speech -> paced tile ticks only
 * -> one movement summary -> optional snake/ladder -> extra turn or next seat.
 */
(function(global){
  'use strict';
  const G=global.HeroGames,U=global.HeroUI;
  const COLORS=['#e5484d','#2fbf71','#ffd23f','#5b7cfa'];
  const NAMES=['Red','Green','Yellow','Blue'];
  const LADDERS={3:22,8:30,28:84,36:44,51:67,71:91,80:100};
  const SNAKES={16:6,47:26,62:19,64:60,87:24,93:73,98:78};
  const TIMES={start:380,dice:900,step:500,transition:750,ai:900,win:1500,gap:160};
  const META={id:'snakes',title:'Snakes & Ladders',emoji:'🐍',desc:'One human and up to three AI opponents, or local players. Paced moves, clear roll summaries, and another turn on a six.',tags:['Dice','2–4 players','AI']};
  const OPTIONS=[
    {key:'players',label:'Total players for local play or rooms',type:'select',default:'2',options:[['2','2 players'],['3','3 players'],['4','4 players']],hint:'In vs AI mode, the total is you plus the selected AI opponents.'},
    {key:'aiCount',label:'AI opponents (vs AI mode)',type:'select',default:'1',options:[['1','1 AI opponent — 2 players total'],['2','2 AI opponents — 3 players total'],['3','3 AI opponents — 4 players total']],hint:'You are always Player 1, Red. Local pass-and-play and room seats are human-controlled.'}
  ];
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.parseInt(v,10)||min));
  let serial=0;
  function start(hostEl,cfg={},api){
    const net=api.net,online=cfg.mode==='online'&&!!cfg.online;
    const versusAI=!online&&(cfg.mode==='ai'||(!cfg.mode&&(cfg.ai==='1'||cfg.ai===true)));
    const count=versusAI?clamp(cfg.aiCount??(clamp(cfg.players||2,2,4)-1),1,3)+1:clamp(cfg.players||2,2,4);
    const roster=online&&Array.isArray(cfg.roster)&&cfg.roster.length>=2?cfg.roster.slice(0,4):Array.from({length:count},(_,i)=>({name:i===0?'Player 1':versusAI?'AI '+i:'Player '+(i+1)}));
    const initialPlayers=roster.map((r,i)=>({id:r.id,name:String(r.name||'Player '+(i+1)),pos:0,color:COLORS[i],cname:NAMES[i],ai:versusAI&&i>0}));
    const whoAmI=online?initialPlayers.findIndex(p=>p.id===api.profile?.id):0;
    const source='snakes-'+(global.crypto?.randomUUID?.()||Date.now()+'-'+(++serial)+'-'+Math.random().toString(36).slice(2));
    const state={players:[],turn:0,dice:0,rolling:true,phase:'starting',winner:null,done:false,seq:0,turnNumber:0,matchId:source,event:null,paused:false};
    let active=true,closed=false,manualPause=false,pageAway=document.hidden,aiPending=false,remotePending=0,queuedSeq=-1,queuedMatch=null,remoteChain=Promise.resolve(),recorded=false;
    let scope=new AbortController();
    const waits=new Set();
    const isPaused=()=>manualPause||pageAway;
    function arm(job){
      if(!active||closed||isPaused())return;
      job.started=Date.now();job.timer=setTimeout(()=>{waits.delete(job);job.resolve(active&&!closed);},job.remaining);
    }
    function wait(ms){
      if(!active||closed)return Promise.resolve(false);
      return new Promise(resolve=>{const job={resolve,remaining:ms,started:0,timer:null};waits.add(job);arm(job);});
    }
    function clearWaits(){for(const job of waits){clearTimeout(job.timer);job.resolve(false);}waits.clear();}
    function freeze(){for(const job of waits){if(job.timer!==null){clearTimeout(job.timer);job.remaining=Math.max(0,job.remaining-(Date.now()-job.started));job.timer=null;}}}
    function thaw(){if(!isPaused())for(const job of waits)if(job.timer===null)arm(job);}
    function phase(value){state.phase=value;state.rolling=!['idle','finished'].includes(value);render();}
    function safeRoom(){const r=online?net.currentRoom?.():null;return r?.game==='snakes'&&r.code===cfg.online.code?r:null;}
    function snapshot(){return {...state,source,players:state.players.map(p=>({...p,ai:false})),paused:false};}
    function publish(event={}){
      state.seq++;state.event={seq:state.seq,...event};
      const room=safeRoom();if(room)net.roomState({...room.state,snxs:snapshot()});
    }
    function cue(name){if(active&&!isPaused()){publish({cue:name});U.sfx(name);}}
    async function say(text){
      const signal=scope.signal;
      if(!active||signal.aborted)return false;
      // A hidden tab or a paused view must not race through silent AI turns.
      if(!await wait(0))return false;
      publish({text});status.textContent=text;
      while(active&&!signal.aborted){
        if(!await wait(0))return false;
        const finished=await U.sayAndWait(text,{signal});
        if(!active||signal.aborted)return false;
        if(finished!==false){
          // OS screen-reader speech cannot be awaited; allow a reading pause when app speech is off.
          if(global.HeroAudio?.settings?.voice===false&&!await wait(Math.min(5000,Math.max(900,text.length*45))))return false;
          return wait(TIMES.gap);
        }
        // A cancelled line is repeated on return, not skipped along with the move.
      }
      return false;
    }
    function reset(){
      state.players=initialPlayers.map(p=>({...p,pos:0}));state.turn=0;state.dice=0;state.rolling=true;state.phase='starting';state.done=false;state.winner=null;state.turnNumber=0;state.seq=0;state.event=null;state.matchId=source+'-'+Date.now();recorded=false;
    }

    // Build controls once. Tile updates never replace the focused roll button and
    // are not live regions: TalkBack receives summaries, not 100 cells per tick.
    U.clear(hostEl);
    const heading=U.el('h2',{tabindex:'-1'},['Snakes & Ladders']);hostEl.appendChild(heading);
    const rules=U.el('p',{class:'hint'},['Reach square 100 exactly. A six gives another turn. Everyone starts off the board at Start.']);hostEl.appendChild(rules);
    const row=U.el('div',{class:'roll-row'}),turnLabel=U.el('span',{class:'muted'}),dice=U.el('div',{class:'dice','aria-hidden':'true'},['?']);
    const rollButton=U.el('button',{class:'btn btn-primary',type:'button',id:'snakes-roll','aria-label':'Roll dice'},['Roll dice']);
    const pauseButton=U.el('button',{class:'btn btn-ghost',type:'button'},['Pause game']);
    row.append(turnLabel,dice,rollButton,pauseButton);hostEl.appendChild(row);
    const status=U.el('p',{class:'run-announce','aria-live':'off'});hostEl.appendChild(status);
    const tray=U.el('div',{class:'player-tray','aria-live':'off'});hostEl.appendChild(tray);
    const board=U.el('div',{class:'board','aria-label':'Snakes and ladders board',role:'group','aria-live':'off'});board.style.gridTemplateColumns='repeat(10,1fr)';
    const cells=new Map(),tokens=[];
    for(let n=100;n>=1;n--){
      const cell=U.el('div',{class:'ludo-cell tile','data-square':String(n),style:'position:relative;min-height:32px;border-radius:6px;background:'+(n%2===0?'#efe3c8':'#d9c9a3')+';color:#0a0f1e;'},[String(n)]);
      cell.setAttribute('aria-label','Square '+n+(LADDERS[n]?', ladder to '+LADDERS[n]:SNAKES[n]?', snake to '+SNAKES[n]:''));
      cells.set(n,cell);board.appendChild(cell);
    }
    hostEl.appendChild(board);
    const finishPanel=U.el('div',{class:'panel'}),finishTitle=U.el('h3'),again=U.el('button',{class:'btn btn-primary',type:'button'},['Play again']);
    finishPanel.append(finishTitle,again);finishPanel.hidden=true;hostEl.appendChild(finishPanel);
    function render(){
      if(!active||!state.players.length)return;
      const p=state.players[state.turn],allowed=!closed&&!state.done&&!isPaused()&&state.phase==='idle'&&!remotePending&&(!online||state.turn===whoAmI)&&!p.ai;
      if(rollButton.getAttribute('aria-disabled')!==String(!allowed))rollButton.setAttribute('aria-disabled',String(!allowed));
      // Keep the focused control’s accessible name stable during every AI/tile update.
      turnLabel.textContent=isPaused()?'Game paused':state.done?'Match finished':p.cname+' · '+(state.phase==='idle'?'to roll':state.phase.replaceAll('-',' '));
      dice.textContent=state.dice?String(state.dice):'?';
      state.paused=isPaused();pauseButton.textContent=manualPause?'Resume game':'Pause game';pauseButton.setAttribute('aria-pressed',String(manualPause));
      U.clear(tray);tokens.forEach(t=>t.remove());tokens.length=0;
      state.players.forEach((player,i)=>{
        const text=player.name+' — '+player.cname+(i===0&&!online?' (you)':'')+' · '+(player.pos?'square '+player.pos:'Start');
        tray.appendChild(U.el('div',{class:'player-pill'+(i===state.turn?' active':'')},[text]));
        if(player.pos){const token=U.el('span',{class:'dot','data-token':String(i),'aria-hidden':'true',style:'position:absolute;bottom:2px;left:'+(i*7)+'px;width:9px;height:9px;background:'+player.color+';border:1px solid #000;'});cells.get(player.pos)?.appendChild(token);tokens.push(token);}
      });
      finishPanel.hidden=!state.done;
      if(state.done){finishTitle.textContent=state.winner?.cname+' won Snakes & Ladders.';again.hidden=online;}
    }
    rollButton.addEventListener('click',()=>roll());
    pauseButton.addEventListener('click',()=>{
      manualPause=!manualPause;
      if(isPaused()){freeze();global.HeroAudio?.stopAll?.();}else{global.HeroAudio?.resumeAll?.();thaw();}
      render();
    });
    function visibility(){pageAway=document.hidden;if(pageAway){freeze();global.HeroAudio?.cancelSpeech?.();}else thaw();render();}
    function pagehide(){pageAway=true;freeze();global.HeroAudio?.cancelSpeech?.();render();}
    document.addEventListener('visibilitychange',visibility);global.addEventListener('pagehide',pagehide);global.addEventListener('pageshow',visibility);
    async function scheduleAI(){
      if(!active||aiPending||state.done||online||!state.players[state.turn]?.ai||state.phase!=='idle')return;
      aiPending=true;const ok=await wait(TIMES.ai);aiPending=false;
      if(ok&&active&&!state.done&&state.players[state.turn]?.ai&&state.phase==='idle')await roll(true);
    }
    async function roll(fromAI=false){
      if(!active||closed||state.done||state.phase!=='idle'||isPaused()||remotePending)return false;
      const p=state.players[state.turn];
      if(online&&state.turn!==whoAmI)return false;
      if(p.ai&&!fromAI)return false;
      phase('rolling');state.dice=0;render();cue('dicePaced');
      if(!await wait(TIMES.dice))return false;
      const die=1+Math.floor(Math.random()*6);state.dice=die;phase('roll-result');
      if(!await say(p.cname+' rolls '+die+'.'))return false;
      const from=p.pos,target=from+die;
      if(target>100){
        phase('move-summary');
        if(!await say(p.cname+' needs an exact roll to finish and stays on square '+from+'.'))return false;
      }else{
        phase('moving');
        for(let i=1;i<=die;i++){
          if(!await wait(i===1?0:TIMES.step))return false;
          p.pos=from+i;render();cue('stepTick');
        }
        if(!await wait(TIMES.step))return false;
        phase('move-summary');
        if(!await say(p.cname+' moved from '+(from===0?'Start':'square '+from)+' to square '+p.pos+'.'))return false;
        const landing=p.pos,jump=LADDERS[landing]||SNAKES[landing];
        if(jump){
          const ladder=!!LADDERS[landing];phase(ladder?'climbing':'sliding');cue(ladder?'steps':'snake');
          if(!await wait(TIMES.transition))return false;
          p.pos=jump;render();phase('move-summary');
          if(!await say(p.cname+(ladder?' climbed the ladder':' slid down the snake')+' from square '+landing+' to square '+jump+'.'))return false;
        }
      }
      if(!active)return false;
      state.turnNumber++;
      if(p.pos===100){
        state.done=true;state.winner={...p};phase('finished');
        if(!recorded&&(!online||whoAmI>=0)){recorded=true;api.store?.recordGame?.(api.profile?.id,'snakes',state.turn===whoAmI?'win':'loss',{best:100});}
        cue('winFanfare');
        if(!await wait(TIMES.win))return false;
        await say(p.cname+' reached square 100 and won Snakes and Ladders.');
        return true;
      }
      if(die===6){
        if(!await say(p.cname+' gets another turn for rolling six.'))return false;
      }else state.turn=(state.turn+1)%state.players.length;
      phase('turn-announcement');
      const next=state.players[state.turn];
      if(!next.ai&&(!online||state.turn===whoAmI))if(!await say(next.cname+', your turn.'))return false;
      phase('idle');publish();
      // Deliberate scheduling even when the same AI retains the same turn index.
      void scheduleAI();return true;
    }
    function validSnap(s){
      return s&&typeof s.matchId==='string'&&Number.isInteger(s.seq)&&Array.isArray(s.players)&&s.players.length>=2&&s.players.length<=4&&Number.isInteger(s.turn)&&s.turn>=0&&s.turn<s.players.length&&s.players.every(p=>Number.isInteger(p.pos)&&p.pos>=0&&p.pos<=100)&&(!s.done||(s.winner?.pos===100&&s.players[s.turn].pos===100));
    }
    function hydrate(s){
      Object.assign(state,s,{players:s.players.map((p,i)=>({...p,ai:false,color:COLORS[i],cname:NAMES[i]}))});render();
    }
    function receive(){
      const room=safeRoom();
      if(room?.status==='closed'){closed=true;scope.abort();clearWaits();phase('closed');status.textContent='The host closed this room. Use Back to leave.';return;}
      const snap=room?.state?.snxs;
      if(!active||closed||!validSnap(snap)||snap.source===source)return;
      if(snap.matchId===queuedMatch&&snap.seq<=queuedSeq)return;
      if(snap.matchId!==queuedMatch){queuedSeq=-1;queuedMatch=snap.matchId;}
      queuedSeq=snap.seq;const data=JSON.parse(JSON.stringify(snap));remotePending++;
      remoteChain=remoteChain.then(async()=>{
        if(!await wait(0))return;
        hydrate(data);
        if(data.event?.cue){
          U.sfx(data.event.cue);
          const duration={gameStart:TIMES.start,dicePaced:TIMES.dice,stepTick:TIMES.step,steps:TIMES.transition,snake:TIMES.transition,winFanfare:TIMES.win}[data.event.cue]||0;
          if(!await wait(duration))return;
        }
        if(data.event?.text){
          status.textContent=data.event.text;
          while(active&&!closed){
            if(!await wait(0))return;
            const spoken=await U.sayAndWait(data.event.text,{signal:scope.signal});
            if(spoken!==false)break;
          }
          if(global.HeroAudio?.settings?.voice===false)await wait(Math.min(5000,Math.max(900,data.event.text.length*45)));
          await wait(TIMES.gap);
        }
      }).catch(()=>{}).finally(()=>{remotePending--;render();});
    }
    if(online)net.on('state',receive);
    async function introduce(){
      global.HeroAudio?.cancelSpeech?.();phase('starting');cue('gameStart');
      if(!await wait(TIMES.start))return false;
      const names=state.players.map(p=>p.name+' is '+p.cname).join('. ');
      if(!await say('Snakes and Ladders started. '+names+'.'))return false;
      if(!await say('Red, your turn.'))return false;
      phase('idle');publish();return true;
    }
    let ready;
    reset();render();
    if(online&&safeRoom()?.adminId!==api.profile?.id){
      const snap=safeRoom()?.state?.snxs;if(validSnap(snap)){hydrate(snap);queuedMatch=snap.matchId;queuedSeq=snap.seq;}else phase('waiting-for-host');
      ready=Promise.resolve(true);
    }else ready=introduce();
    again.addEventListener('click',()=>{
      if(online||!active)return;
      scope.abort();clearWaits();scope=new AbortController();manualPause=false;aiPending=false;
      global.HeroAudio?.stopAll?.();global.HeroAudio?.resumeAll?.();reset();render();U.focus(rollButton);ready=introduce();
    });
    function destroy(){
      if(!active)return;active=false;scope.abort();clearWaits();
      if(online)net.off('state',receive);
      document.removeEventListener('visibilitychange',visibility);global.removeEventListener('pagehide',pagehide);global.removeEventListener('pageshow',visibility);
      global.HeroAudio?.stopAll?.();U.clear(hostEl);
    }
    return {destroy,state,render,roll,get ready(){return ready;},get pendingTimers(){return waits.size;}};
  }
  G.snakes={meta:META,options:OPTIONS,start,rules:{LADDERS,SNAKES,TIMES}};
})(window);
