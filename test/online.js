/* Real transport in ten isolated DOM clients with shared storage/channel.
 * This verifies trusted same-device rooms, not a deployed internet backend. */
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const shared=new Map(),channels=new Set(),windows=[];
class Channel{constructor(){channels.add(this);}postMessage(data){for(const c of channels)if(c!==this)queueMicrotask(()=>c.onmessage?.({data:structuredClone(data)}));}close(){channels.delete(this);}}
function client(){const dom=new JSDOM('<body><div id="game"></div></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;windows.push(w);w.BroadcastChannel=Channel;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:webcrypto});Object.defineProperty(w,'localStorage',{value:{getItem:k=>shared.get(k)||null,setItem:(k,v)=>shared.set(k,v),removeItem:k=>shared.delete(k)}});for(const file of ['net','common','cricket-room','cricket'])w.eval(fs.readFileSync(__dirname+'/../js/'+file+'.js','utf8'));return w;}
async function main(){
 const clients=Array.from({length:11},client),host=clients[0].HeroNet;
 const room=(await host.createRoom({game:'cricket',adminId:'p0',members:[{id:'p0',name:'Goldfish',role:'player',slot:0}],meta:{overs:1,wickets:10,squad:5},state:{}})).room;
 for(let i=1;i<clients.length;i++)await clients[i].HeroNet.joinRoom(room.code,{id:'p'+i,name:'Player '+i,role:'spectator',slot:null});
 const action=(i,a)=>clients[i].HeroNet.cricketAction(a);
 const ok=async(i,a)=>assert.equal((await action(i,a)).error,null);
 const denied=async(i,a)=>assert.ok((await action(i,a)).error);
 await denied(2,{type:'setup'});
 await ok(0,{type:'setup',nameA:'India',nameB:'Sri Lanka',captainA:'p0',captainB:'p1',size:5});
 await denied(1,{type:'draft',player:'p2'});
 for(let i=2;i<10;i++)await ok(i%2,{type:'draft',player:'p'+i});
 assert.equal(host.currentRoom().state.cricket.phase,'ready');
 await denied(2,{type:'start'});await ok(0,{type:'start'});
 await denied(0,{type:'active',team:'B',role:'bat',player:'p1'});
 await denied(0,{type:'active',team:'A',role:'bat',player:'p1'});
 await ok(0,{type:'active',team:'A',role:'bat',player:'p2'});
 const staleRoom=structuredClone(host.currentRoom());
 const C=clients[0].HeroCricketRoom,nonce='a'.repeat(32),hash=await C.digest(room.code,0,'bat',4,nonce);
 await denied(10,{type:'commit',ball:0,role:'bat',hash});
 await denied(0,{type:'commit',ball:0,role:'bat',hash});
 await ok(2,{type:'commit',ball:0,role:'bat',hash});
 await denied(2,{type:'commit',ball:0,role:'bat',hash});
 await denied(0,{type:'active',team:'A',role:'bat',player:'p0'});
 await denied(2,{type:'reveal',ball:0,role:'bat',n:4,nonce});
 const bowlHash=await C.digest(room.code,0,'bowl',3,nonce);
 await ok(1,{type:'commit',ball:0,role:'bowl',hash:bowlHash});
 await denied(2,{type:'reveal',ball:0,role:'bat',n:6,nonce});
 await ok(2,{type:'reveal',ball:0,role:'bat',n:4,nonce});await ok(1,{type:'reveal',ball:0,role:'bowl',n:3,nonce});
 for(const w of clients){assert.equal(w.HeroNet.currentRoom().state.cricket.match.sides.A.runs,4);assert.equal(w.HeroNet.currentRoom().state.cricket.match.ballNo,1);}
 await denied(2,{type:'reveal',ball:0,role:'bat',n:4,nonce});
 for(const channel of channels){channel.postMessage({type:'room:update',room:staleRoom});break;}
 await new Promise(r=>setTimeout(r,0));assert.equal(host.currentRoom().state.cricket.match.ballNo,1);
 // Controllers auto-reveal only after both clients commit. Spectator has no pad.
 const controllers=clients.map((w,i)=>w.HeroGames.cricket.start(w.document.getElementById('game'),{mode:'online',overs:1,wickets:10,squad:5},{profile:{id:'p'+i},net:w.HeroNet}));
 assert.equal(clients[10].document.querySelector('.numpad'),null);
 await controllers[2].submit('bat',5);await controllers[1].submit('bowl',2);
 await new Promise(r=>setTimeout(r,50));
 assert.equal(host.currentRoom().state.cricket.match.ballNo,2);assert.equal(host.currentRoom().state.cricket.match.sides.A.runs,9);
 controllers.forEach(c=>c.destroy());clients.forEach(w=>w.HeroNet.leave());windows.forEach(w=>w.close());
 console.log('CAPTAIN ROOMS PASS: 11 clients; 5-v-5 draft, roles, spectator, commit/reveal, tampering, stale ball, synchronized score.');
}
main().catch(e=>{console.error(e);windows.forEach(w=>w.close());process.exit(1);});
