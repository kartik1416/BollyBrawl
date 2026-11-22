import {createMatch,advance,STEP} from '../combat.js';
import {routeRoom} from './router.js';
const fighters=new Set(['safari','spin','blast','slap','burst','spit']);
const arenas=new Set(['filmcity','akhada','cinema']);
const held=['left','right','crouch','block'],edges=['jump','punch','kick','sweep','grabSignature','special'];
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export default {fetch:routeRoom};

// One room owns both fighters and runs the same authoritative simulation as localhost.
// WebSocket inputs avoid one HTTP request per input frame.
export class BollyRoom{
 constructor(ctx){
  this.ctx=ctx;this.room=null;this.timer=null;this.step=0;this.events=[];
  ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room')||null;});
 }
 sockets(seat){return this.ctx.getWebSockets().filter(ws=>seat===undefined||ws.deserializeAttachment()?.seat===seat);}
 connected(seat){return this.sockets(seat).some(ws=>ws.readyState===1);}
 publicRoom(){const r=this.room;return {code:r.code,arena:r.arena,started:!!r.match,players:r.players.map((p,i)=>p?{fighter:p.fighter,ready:p.ready,connected:this.connected(i)}:null),paused:r.paused,reason:r.reason};}
 broadcast(events=[]){if(!this.room)return;const packet=JSON.stringify({room:this.publicRoom(),match:this.room.match,events});for(const ws of this.sockets())try{ws.send(packet);}catch{}}
 save(){return this.ctx.storage.put('room',this.room);}
 player(fighter){return {token:crypto.randomUUID(),fighter:fighters.has(fighter)?fighter:'safari',ready:false,input:{},edges:[],lastInput:0};}
 auth(token){if(!this.room)fail('Room not found. Check the code.',404);const seat=this.room.players.findIndex(p=>p?.token===token);if(seat<0)fail('Your room session has expired.',403);return seat;}
 async fetch(request){
  try{
   const url=new URL(request.url),action=url.pathname.split('/').at(-1);
   if(action==='events'){
    const seat=this.auth(url.searchParams.get('token'));
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')fail('WebSocket required',426);
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];
    for(const old of this.sockets(seat))old.close(1000,'Replaced connection');
    this.ctx.acceptWebSocket(server);server.serializeAttachment({seat,token:this.room.players[seat].token});
    this.broadcast();this.start();
    return new Response(null,{status:101,webSocket:client});
   }
   const body=await request.json();let result={ok:true};
   if(action==='create'){
    if(this.room)fail('Code already occupied',409);
    this.room={code:body.code,arena:arenas.has(body.arena)?body.arena:'filmcity',players:[this.player(body.fighter),null],match:null,paused:false,reason:''};
    await this.ctx.storage.setAlarm(Date.now()+3*60*60*1000);
    result=this.session(0);
   }else if(action==='join'){
    if(!this.room)fail('Room not found. Check the code.',404);
    if(this.room.players[1]||this.room.match)fail('This room already has two fighters.');
    this.room.players[1]=this.player(body.fighter);result=this.session(1);
   }else{
    const seat=this.auth(body.token),player=this.room.players[seat],r=this.room;
    switch(action){
     case 'select':
      if(r.match)fail('Finish the match before changing fighters.');
      if(fighters.has(body.fighter))player.fighter=body.fighter;
      if(seat===0&&arenas.has(body.arena))r.arena=body.arena;
      r.players.forEach(p=>{if(p)p.ready=false;});break;
     case 'ready':
      if(r.match?.phase==='over'){r.match=null;r.players.forEach(p=>p.ready=false);}
      if(!r.players.every((p,i)=>p&&this.connected(i)))fail('Wait for the second fighter to connect.');
      player.ready=body.ready===true;
      if(!r.match&&r.players.every(p=>p.ready)){r.match=createMatch('online',r.players.map(p=>p.fighter),false);r.paused=false;r.reason='';r.players.forEach(p=>{p.input={};p.edges=[];});}
      break;
     case 'pause':
      if(!r.players.every((p,i)=>p&&this.connected(i)))fail('Waiting for both fighters to reconnect.');
      r.paused=body.paused===true;r.reason=r.paused?'Match paused by a fighter.':'';
      r.players.forEach(p=>{p.input={};p.edges=[];});break;
     case 'leave':await this.end('The other fighter left the room.');return Response.json({ok:true});
     default:fail('Unknown room action',404);
    }
   }
   if(this.room.paused)this.stop();
   await this.save();this.broadcast();this.start();
   return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.message},{status:error.status||400});}
 }
 session(seat){return {code:this.room.code,token:this.room.players[seat].token,seat,transport:'websocket',room:this.publicRoom()};}
 webSocketMessage(ws,message){
  if(typeof message!=='string'||message.length>4096)return;
  const attachment=ws.deserializeAttachment();
  if(!this.room||this.room.players[attachment?.seat]?.token!==attachment?.token)return;
  try{
   const data=JSON.parse(message);if(data.type!=='input')return;
   const p=this.room.players[attachment.seat],input=data.input||{};
   p.lastInput=Date.now();p.input=Object.fromEntries(held.map(key=>[key,input[key]===true]));
   if(p.edges.length<8){const edge=Object.fromEntries(edges.map(key=>[key,input[key]===true]));edge.attacks=Array.isArray(input.attacks)?input.attacks.filter(x=>x==='punch'||x==='kick').slice(0,3):[];if(edges.some(key=>edge[key])||edge.attacks.length)p.edges.push(edge);}
  }catch{}
 }
 async webSocketClose(ws,code,reason){
  try{ws.close(code===1005?1000:code,reason);}catch{}
  const seat=ws.deserializeAttachment()?.seat;
  if(this.room&&!this.connected(seat)){
   const p=this.room.players[seat];if(p){p.input={};p.edges=[];}
   if(this.room.match?.phase!=='over'){this.room.paused=true;this.room.reason='A fighter disconnected. Waiting for reconnection.';}
   this.stop();await this.save();this.broadcast();
  }
 }
 webSocketError(ws){return this.webSocketClose(ws,1011,'Connection interrupted');}
 start(){
  if(this.timer||!this.room?.match||this.room.paused||this.room.match.phase==='over'||!this.room.players.every((p,i)=>p&&this.connected(i)))return;
  let previous=performance.now(),accumulator=0;
  this.timer=setInterval(()=>{
   const now=performance.now();accumulator+=Math.min(250,now-previous);previous=now;
   const count=Math.min(5,Math.floor(accumulator/(STEP*1000)));accumulator-=count*STEP*1000;
   for(let i=0;i<count;i++){
    const r=this.room,inputs=r.players.map(p=>Date.now()-p.lastInput>300?{}:{...p.input,...(p.edges.shift()||{})});
    const events=advance(r.match,inputs);for(const e of events)if(e.type==='roundEnd'&&e.knockout)r.match.phaseTime=Math.max(r.match.phaseTime,3.2);
    this.events.push(...events);
    if(++this.step%3===0){this.broadcast(this.events);this.events=[];}
    if(r.match.phase==='over'){this.broadcast(this.events);this.events=[];this.stop();this.ctx.waitUntil(this.save());break;}
   }
  },8);
 }
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 async end(message){this.stop();for(const ws of this.sockets())try{ws.send(JSON.stringify({closed:true,message}));ws.close(1000,'Room ended');}catch{}this.room=null;await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();}
 alarm(){return this.end('This room has expired. Create a new room.');}
}
