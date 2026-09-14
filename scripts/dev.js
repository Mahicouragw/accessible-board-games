/* Static preview server: only public assets, no dotfiles/source credentials. */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),PORT=process.env.PORT||8080;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://preview.invalid').pathname);}catch{res.writeHead(400);return res.end('Bad request');}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Method not allowed');}
 if(pathname==='/')pathname='/index.html';
 const parts=pathname.split('/');
 if(parts.some(p=>p.startsWith('.')||p.includes('\\'))||['scripts','test','node_modules','supabase'].includes(parts[1])){res.writeHead(404);return res.end('Not found');}
 const file=path.resolve(ROOT,'.'+pathname),rel=path.relative(ROOT,file);
 if(rel.startsWith('..')||path.isAbsolute(rel)||!MIME[path.extname(file)]||(/\.md$/.test(file)&&parts.at(-1)!=='AUDIO_CREDITS.md')){res.writeHead(404);return res.end('Not found');}
 fs.realpath(file,(err,real)=>{
   if(err||!real.startsWith(ROOT+path.sep)){res.writeHead(404);return res.end('Not found');}
   fs.readFile(real,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':MIME[path.extname(file)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);});
 });
}).listen(PORT,'0.0.0.0',()=>console.log('HeroBoard preview on port '+PORT));
