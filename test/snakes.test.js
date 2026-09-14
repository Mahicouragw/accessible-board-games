const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const {JSDOM}=require('jsdom'),FakeTimers=require('@sinonjs/fake-timers');
function fixture(cfg={},room=null){
 const dom=new JSDOM('<body><div id="stage"></div></body>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const clock=FakeTimers.withGlobal(w).install({now:0,toFake:['setTimeout','clearTimeout','Date']});
 w.eval(fs.readFileSync(__dirname+'/../js/common.js','utf8'));
 const log=[],listeners=new Map();let controller,roomReads=0,speechFinish=null,draws=[];
 const net={currentRoom(){roomReads++;return room;},on(e,fn){listeners.set(e,fn);},off(e){listeners.delete(e);},roomState(st){if(room)room.state=st;listeners.get('state')?.();}};
 w.HeroAudio={settings:{voice:true},cancelSpeech(){speechFinish?.(false);},stopAll(){speechFinish?.(false);},resumeAll(){}};
 w.HeroUI.sfx=cue=>log.push({kind:'cue',cue,at:w.Date.now(),phase:controller?.state.phase,positions:controller?.state.players.map(p=>p.pos)});
 w.HeroUI.sayAndWait=(text,{signal}={})=>new Promise(resolve=>{
  log.push({kind:'speech',text,at:w.Date.now()});let timer,done=false;
  const finish=ok=>{if(done)return;done=true;w.clearTimeout(timer);signal?.removeEventListener('abort',abort);if(speechFinish===finish)speechFinish=null;log.push({kind:'speech-end',text,at:w.Date.now(),ok});resolve(ok);};
  const abort=()=>finish(false);speechFinish=finish;signal?.addEventListener('abort',abort,{once:true});timer=w.setTimeout(()=>finish(true),200);
 });
 w.eval(fs.readFileSync(__dirname+'/../js/snakes.js','utf8'));
 controller=w.HeroGames.snakes.start(w.document.getElementById('stage'),{mode:'local',players:'2',...cfg},{net,profile:{id:'human'},store:{recordGame(){log.push({kind:'record'});}}});
 w.Math.random=()=>((draws.length?draws.shift():2)-1)/6+0.001;
 async function until(predicate,max=90000){for(let n=0;n<max;n+=50){if(predicate())return;await clock.tickAsync(50);}throw Error('Timed out in '+controller.state.phase+' at '+controller.state.turnNumber);}
 return {w,clock,controller,log,net,listeners,get roomReads(){return roomReads;},dice(...n){draws.push(...n);},async ready(){await until(()=>controller.state.phase==='idle');},until,hide(value){Object.defineProperty(w.document,'hidden',{configurable:true,value});w.document.dispatchEvent(new w.Event('visibilitychange'));},close(){controller.destroy();clock.uninstall();dom.window.close();}};
}
test('new local match ignores completed room state; startup is neutral, never a win/loss',async t=>{
 const f=fixture({}, {game:'snakes',code:'old',state:{snxs:{done:true,winner:{name:'You',pos:100},players:[{pos:100},{pos:0}],turn:0}}});t.after(()=>f.close());await f.ready();
 assert.equal(f.roomReads,0);assert.equal(f.controller.state.done,false);assert.deepEqual(Array.from(f.controller.state.players,p=>p.pos),[0,0]);
 assert.deepEqual(f.log.filter(x=>x.kind==='cue').map(x=>x.cue),['gameStart']);
 assert.ok(f.log.some(x=>x.text?.startsWith('Snakes and Ladders started.')));assert.ok(!f.log.some(x=>/won|wins|lose|loss/i.test(x.text||'')));
});
test('two AI opponents means human Red plus Green and Yellow, not two players total',async t=>{
 const f=fixture({mode:'ai',aiCount:'2',players:'2'});t.after(()=>f.close());await f.ready();
 assert.equal(f.controller.state.players.length,3);assert.deepEqual(Array.from(f.controller.state.players,p=>p.ai),[false,true,true]);assert.equal(f.controller.state.turn,0);
});
test('dice sound -> completed roll speech -> five paced ticks -> one whole-move summary',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.log.length=0;f.dice(5);const work=f.controller.roll();await f.until(()=>f.controller.state.turnNumber===1&&f.controller.state.phase==='idle');await work;
 const cues=f.log.filter(x=>x.kind==='cue'),steps=cues.filter(x=>x.cue==='stepTick');assert.equal(cues[0].cue,'dicePaced');assert.equal(steps.length,5);
 assert.deepEqual(steps.map(x=>x.positions[0]),[1,2,3,4,5]);for(let i=1;i<steps.length;i++)assert.ok(steps[i].at-steps[i-1].at>=500);
 const spoken=f.log.filter(x=>x.kind==='speech'),roll=spoken.find(x=>x.text==='Red rolls 5.');assert.ok(roll.at-cues[0].at>=900);
 const rollEnd=f.log.find(x=>x.kind==='speech-end'&&x.text==='Red rolls 5.');assert.ok(steps[0].at>rollEnd.at);
 const summaries=spoken.filter(x=>x.text.startsWith('Red moved'));assert.deepEqual(summaries.map(x=>x.text),['Red moved from Start to square 5.']);assert.ok(summaries[0].at>=steps[4].at+500);
 assert.ok(!spoken.some(x=>/rolling the dice|moving|moved to square [1-4]\b/i.test(x.text)));
});
test('AI six-six-two moves every roll, rolls again twice, then yields through AI 2 to human',async t=>{
 const f=fixture({mode:'ai',aiCount:'2'});t.after(()=>f.close());await f.ready();f.log.length=0;f.dice(2,6,6,2,4);void f.controller.roll();
 await f.until(()=>f.controller.state.phase==='idle'&&f.controller.state.turn===1);
 assert.equal(await f.controller.roll(),false,'human cannot roll for AI');for(let i=0;i<5;i++)f.controller.render();
 await f.until(()=>f.controller.state.turnNumber===5&&f.controller.state.turn===0&&f.controller.state.phase==='idle');
 assert.deepEqual(f.log.filter(x=>x.kind==='speech'&&/^Green rolls/.test(x.text)).map(x=>x.text),['Green rolls 6.','Green rolls 6.','Green rolls 2.']);
 assert.equal(f.controller.state.players[1].pos,14);assert.equal(f.controller.state.players[2].pos,4);
 assert.equal(f.log.filter(x=>x.kind==='cue'&&x.cue==='dicePaced').length,5);
});
test('human six retains human turn without an automatic human roll',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.dice(6);void f.controller.roll();await f.until(()=>f.controller.state.turnNumber===1&&f.controller.state.phase==='idle');await f.clock.tickAsync(20000);
 assert.equal(f.controller.state.turn,0);assert.equal(f.controller.state.players[0].pos,6);assert.equal(f.controller.state.turnNumber,1);
});
test('double click is locked for the whole dice and movement sequence',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.dice(5,4);void f.controller.roll();assert.equal(await f.controller.roll(),false);await f.until(()=>f.controller.state.phase==='moving');assert.equal(await f.controller.roll(),false);await f.until(()=>f.controller.state.phase==='idle');assert.equal(f.controller.state.turnNumber,1);
});
test('ladder 80 to 100 wins exactly once and schedules no further AI turn',async t=>{
 const f=fixture({mode:'ai',aiCount:'2'});t.after(()=>f.close());await f.ready();f.controller.state.players[0].pos=79;f.dice(1);void f.controller.roll();await f.until(()=>f.log.some(x=>x.kind==='record'));await f.clock.tickAsync(30000);
 assert.equal(f.controller.state.players[0].pos,100);assert.equal(f.controller.state.winner.cname,'Red');assert.equal(f.controller.state.done,true);
 assert.equal(f.log.filter(x=>x.cue==='winFanfare').length,1);assert.equal(f.log.filter(x=>x.kind==='record').length,1);assert.equal(f.log.filter(x=>x.cue==='dicePaced').length,1);assert.equal(await f.controller.roll(),false);
});
test('overshoot needs exact roll: no fake ticks, no snake retrigger, no clamped win',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.log.length=0;f.controller.state.players[0].pos=98;f.dice(5);void f.controller.roll();await f.until(()=>f.controller.state.phase==='idle');assert.equal(f.controller.state.players[0].pos,98);assert.equal(f.controller.state.done,false);assert.equal(f.log.filter(x=>x.cue==='stepTick'||x.cue==='snake').length,0);
});
for(const point of ['rolling','moving','roll-result','ai-wait'])test('exit at '+point+' cancels all old timers and announcements',async t=>{
 const f=fixture({mode:'ai',aiCount:'2'});t.after(()=>f.close());await f.ready();f.dice(5);void f.controller.roll();
 await f.until(()=>point==='ai-wait'?f.controller.state.turn===1&&f.controller.state.phase==='idle':f.controller.state.phase===point);
 f.controller.destroy();const length=f.log.length,pos=f.controller.state.players[0].pos;await f.clock.tickAsync(120000);assert.equal(f.log.length,length);assert.equal(f.controller.state.players[0].pos,pos);assert.equal(f.controller.pendingTimers,0);assert.equal(f.clock.countTimers(),0);
});
test('hidden tab pauses a move; returning resumes the same remaining steps',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.dice(5);void f.controller.roll();await f.until(()=>f.controller.state.players[0].pos===2);f.hide(true);const n=f.log.length;await f.clock.tickAsync(60000);assert.equal(f.controller.state.players[0].pos,2);assert.equal(f.log.length,n);f.hide(false);await f.until(()=>f.controller.state.phase==='idle');assert.equal(f.controller.state.players[0].pos,5);assert.equal(f.log.filter(x=>x.cue==='stepTick').length,5);
});
test('restart reuses controller and cannot replay an old winning announcement or timer',async t=>{
 const f=fixture();t.after(()=>f.close());await f.ready();f.controller.state.players[0].pos=99;f.dice(1);void f.controller.roll();await f.until(()=>f.controller.state.done);const index=f.log.length;f.w.document.querySelectorAll('#stage button')[2].click();await f.ready();assert.equal(f.controller.state.done,false);assert.equal(f.controller.state.players[0].pos,0);assert.ok(!f.log.slice(index).some(x=>/won/.test(x.text||'')));f.controller.destroy();await f.clock.tickAsync(100000);assert.equal(f.clock.countTimers(),0);
});

test('queued remote movement stays paced and duplicate room echoes play no extra ticks',async t=>{
 const seed={matchId:'room-match',seq:0,source:'remote',players:[{id:'human',name:'Player 1',pos:0},{id:'peer',name:'Player 2',pos:0}],turn:1,dice:3,phase:'idle',rolling:false,winner:null,done:false,turnNumber:0};
 const room={code:'ROOM01',game:'snakes',adminId:'peer',status:'in_progress',state:{snxs:seed}};
 const f=fixture({mode:'online',online:{code:room.code},roster:[{id:'human',name:'Player 1'},{id:'peer',name:'Player 2'}]},room);t.after(()=>f.close());
 for(let i=1;i<=3;i++){
  room.state.snxs={...seed,seq:i,phase:'moving',rolling:true,players:[seed.players[0],{...seed.players[1],pos:i}],event:{seq:i,cue:'stepTick'}};
  f.listeners.get('state')();f.listeners.get('state')();
 }
 await f.clock.tickAsync(100);assert.equal(f.log.filter(x=>x.cue==='stepTick').length,1);
 await f.clock.tickAsync(1600);const ticks=f.log.filter(x=>x.cue==='stepTick');assert.equal(ticks.length,3);assert.ok(ticks[1].at-ticks[0].at>=500);assert.ok(ticks[2].at-ticks[1].at>=500);
});
