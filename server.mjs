import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRoomService} from './rooms.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const rooms=createRoomService();
const types={'.wasm':'application/wasm','.webmanifest':'application/manifest+json','.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 let url;
 try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400).end();return;}
 if(await rooms.handle(req,res,url))return;
 let decoded;
 try{decoded=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
 const target=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
 if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(target,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});
  fs.createReadStream(target).pipe(res);
 });
});
const port=Number(process.env.PORT)||4173;
const host=process.env.HOST||'0.0.0.0';
server.listen(port,host,()=>console.log('BollyBrawl running at http://localhost:'+port));
process.on('SIGTERM',()=>{rooms.close();server.close(()=>process.exit(0));});
