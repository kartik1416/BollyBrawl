// Integration test against `wrangler dev --port 8787`.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.env.ROOM_TEST_URL||'http://127.0.0.1:8787';
async function post(action,body){const r=await fetch(base+'/api/room/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
const host=await post('create',{fighter:'spin',arena:'akhada'});
const guest=await post('join',{code:host.code,fighter:'blast'});
const packets=[[],[]],sockets=[];
async function connect(session,index){
 const url=new URL('/api/room/events',base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.search=new URLSearchParams({code:session.code,token:session.token});
 const ws=new WebSocket(url);ws.onmessage=e=>packets[index].push(JSON.parse(e.data));
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});sockets.push(ws);return ws;
}
async function until(check){for(let i=0;i<200;i++){if(check())return;await delay(25);}throw Error('Timed out waiting for room state');}
try{
 const a=await connect(host,0),b=await connect(guest,1);
 await until(()=>packets[0].at(-1)?.room.players.every(p=>p?.connected));
 assert.equal(host.transport,'websocket');assert.equal(host.room.arena,'akhada');
 const denied=await fetch(base+'/api/room/pause',{method:'POST',body:JSON.stringify({code:host.code,token:'invalid',paused:true})});assert.equal(denied.status,403);
 await post('ready',{...host,ready:true});await post('ready',{...guest,ready:true});
 await until(()=>packets[0].at(-1)?.match?.phase==='fight'&&packets[1].at(-1)?.match?.phase==='fight');
 const before=packets[0].at(-1).match.fighters[0].x;
 const input=setInterval(()=>a.send(JSON.stringify({type:'input',input:{right:true,punch:true}})),50);await delay(500);clearInterval(input);
 assert.ok(packets[0].at(-1).match.fighters[0].x>before);
 await post('pause',{...host,paused:true});await until(()=>packets[1].at(-1)?.room.paused);
 const tick=packets[1].at(-1).match.tick;await delay(180);assert.equal(packets[1].at(-1).match.tick,tick);
 await post('pause',{...host,paused:false});await until(()=>!packets[1].at(-1)?.room.paused);
 b.close();await until(()=>packets[0].at(-1)?.room.paused&&packets[0].at(-1)?.room.players[1].connected===false);
 await post('leave',host);console.log('Cloudflare room integration passed: two seats, auth, WebSocket input, simulation, pause/resume, disconnect and leave.');
}finally{for(const ws of sockets)ws.close();}
