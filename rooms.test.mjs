import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('room code connects two clients to one match, validates seats and pauses on disconnect', {timeout:30000}, async t=>{
 const port=4175,base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 const aborters=[];
 t.after(()=>{for(const abort of aborters)abort.abort();server.kill();});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Server exited '+code)));});
 async function post(action,body){
  const response=await fetch(base+'/api/room/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:response.status,...await response.json()};
 }
 function stream(session){
  const state={latest:null,events:[]};
  const abort=new AbortController();aborters.push(abort);
  fetch(base+'/api/room/events?'+new URLSearchParams({code:session.code,token:session.token}),{signal:abort.signal}).then(async response=>{
   let text='';
   for await(const chunk of response.body){
    text+=new TextDecoder().decode(chunk);
    let end;
    while((end=text.indexOf('\n\n'))>=0){
     const event=text.slice(0,end);text=text.slice(end+2);
     if(event.startsWith('data: ')){state.latest=JSON.parse(event.slice(6));state.events.push(...(state.latest.events||[]));}
    }
   }
  }).catch(error=>{if(error.name!=='AbortError')state.error=error;});
  return {...state,get latest(){return state.latest;},get events(){return state.events;},abort};
 }
 async function until(condition){
  for(let i=0;i<300;i++){if(condition())return;await delay(30);}
  throw new Error('Room condition timed out');
 }
 const host=await post('create',{fighter:'slap',arena:'filmcity'});
 assert.match(host.code,/^[A-Z2-9]{6}$/);
 const first=stream(host);
 const guest=await post('join',{code:host.code,fighter:'spin'});
 const second=stream(guest);
 assert.equal(guest.seat,1);
 assert.equal((await post('join',{code:host.code})).status,400);
 assert.equal((await post('input',{code:host.code,token:'wrong'})).status,403);
 await until(()=>first.latest?.room.players.every(p=>p?.connected)&&second.latest);
 assert.equal(JSON.stringify(first.latest).includes(host.token),false);
 assert.equal((await post('ready',{...host,ready:true})).status,200);
 assert.equal((await post('ready',{...guest,ready:true})).status,200);
 await until(()=>first.latest?.match?.phase==='fight'&&second.latest?.match?.phase==='fight');
 assert.equal(first.latest.room.arena,'filmcity');
 for(let i=0;i<18;i++){
  await Promise.all([post('input',{...host,input:{right:true}}),post('input',{...guest,input:{left:true}})]);
  await delay(40);
 }
 await post('input',{...host,input:{grabSignature:true}});
 await post('input',{...guest,input:{}});
 await until(()=>first.latest?.match?.special?.kind==='dhobi');
 await until(()=>first.latest?.match?.fighters[1].hp===81&&second.latest?.match?.fighters[1].hp===81);
 assert.equal(first.events.filter(e=>e.type==='specialHit').length,2);
 await post('pause',{...host,paused:true});
 await until(()=>first.latest.room.paused&&second.latest.room.paused);
 const time=first.latest.match.time;
 await delay(180);
 assert.equal(first.latest.match.time,time);
 await post('pause',{...guest,paused:false});
 await until(()=>!first.latest.room.paused);
 second.abort.abort();
 await until(()=>first.latest.room.paused&&!first.latest.room.players[1].connected);
 const resumed=stream(guest);
 await until(()=>resumed.latest?.room.players.every(p=>p?.connected));
 await post('pause',{...host,paused:false});
 await until(()=>!resumed.latest.room.paused);
 await post('leave',host);
 await until(()=>resumed.latest?.closed);
});
