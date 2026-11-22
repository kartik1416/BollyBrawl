import {randomBytes,randomUUID} from 'node:crypto';
import {createMatch,advance,STEP} from './combat.js';

const fighters=new Set(['safari','spin','blast','slap','burst','spit']);
const arenas=new Set(['filmcity','akhada','cinema']);
const heldKeys=['left','right','crouch','block'];
const edgeKeys=['jump','punch','kick','sweep','grabSignature','special'];
const codes='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRoomService(){
 const rooms=new Map();
 const send=(res,data)=>{if(!res.destroyed&&!res.writableEnded)res.write('data: '+JSON.stringify(data)+'\n\n');};
 const publicRoom=room=>({
  code:room.code,arena:room.arena,started:!!room.match,
  players:room.players.map(p=>p?{fighter:p.fighter,ready:p.ready,connected:!!p.stream}:null),
  paused:room.paused,reason:room.reason
 });
 function broadcast(room,events=[]){
  const packet={room:publicRoom(room),match:room.match,events};
  for(const p of room.players)if(p?.stream)send(p.stream,packet);
 }
 function newPlayer(fighter){
  return {token:randomUUID(),fighter: fighters.has(fighter)?fighter:'safari',ready:false,input:{},edges:[],lastInput:0,stream:null,seen:Date.now()};
 }
 function credentials(body){
  const room=rooms.get(String(body.code||'').toUpperCase());
  if(!room)throw Object.assign(new Error('Room not found. Check the code.'),{status:404});
  const seat=room.players.findIndex(p=>p?.token===body.token);
  if(seat<0)throw Object.assign(new Error('Your room session has expired.'),{status:403});
  room.players[seat].seen=Date.now();
  return {room,seat,player:room.players[seat]};
 }
 async function json(req){
  let text='';
  for await(const chunk of req){
   text+=chunk;
   if(text.length>4096)throw Object.assign(new Error('Request too large'),{status:413});
  }
  try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('Invalid request'),{status:400});}
 }
 function beginIfReady(room){
  if(room.match||!room.players.every(p=>p?.ready&&p.stream))return;
  room.match=createMatch('online',room.players.map(p=>p.fighter),false);
  room.paused=false;room.reason='';
  room.players.forEach(p=>{p.input={};p.edges=[];});
 }
 async function handle(req,res,url){
  if(!url.pathname.startsWith('/api/'))return false;
  res.setHeader('Cache-Control','no-store');
  try{
   if(req.method==='GET'&&url.pathname==='/api/room/events'){
    const {room,player}=credentials(Object.fromEntries(url.searchParams));
    if(player.stream)player.stream.end();
    res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write(': BollyBrawl room\n\n');player.stream=res;
    broadcast(room);
    req.on('close',()=>{
     if(player.stream===res){
      player.stream=null;player.input={};player.edges=[];
      if(room.match?.phase!=='over'){room.paused=true;room.reason='A fighter disconnected. Waiting for reconnection.';}
      broadcast(room);
     }
    });
    return true;
   }
   if(req.method!=='POST')throw Object.assign(new Error('Method not allowed'),{status:405});
   const body=await json(req);
   let result;
   if(url.pathname==='/api/room/create'){
    if(rooms.size>=200)throw new Error('All rooms are busy. Try again shortly.');
    let code;
    do{code=Array.from(randomBytes(6),byte=>codes[byte%codes.length]).join('');}while(rooms.has(code));
    const player=newPlayer(body.fighter);
    const room={code,players:[player,null],arena:arenas.has(body.arena)?body.arena:'filmcity',match:null,paused:false,reason:'',created:Date.now(),events:[],step:0};
    rooms.set(code,room);
    result={code,token:player.token,seat:0,room:publicRoom(room)};
   }else if(url.pathname==='/api/room/join'){
    const room=rooms.get(String(body.code||'').toUpperCase());
    if(!room)throw Object.assign(new Error('Room not found. Check the code.'),{status:404});
    if(room.players[1])throw new Error('This room already has two fighters.');
    if(room.match)throw new Error('This match has already started.');
    const player=newPlayer(body.fighter);
    room.players[1]=player;
    result={code:room.code,token:player.token,seat:1,room:publicRoom(room)};
    broadcast(room);
   }else{
    const {room,seat,player}=credentials(body);
    switch(url.pathname){
     case '/api/room/select':
      if(room.match)throw new Error('Finish the match before changing fighters.');
      if(fighters.has(body.fighter))player.fighter=body.fighter;
      if(seat===0&&arenas.has(body.arena))room.arena=body.arena;
      room.players.forEach(p=>{if(p)p.ready=false;});
      broadcast(room);
      break;
     case '/api/room/ready':
      if(room.match?.phase==='over'){room.match=null;room.players.forEach(p=>p.ready=false);}
      if(!room.players.every(p=>p?.stream))throw new Error('Wait for the second fighter to connect.');
      player.ready=!!body.ready;
      beginIfReady(room);broadcast(room);
      break;
     case '/api/room/input':
      player.lastInput=Date.now();
      player.input=Object.fromEntries(heldKeys.map(key=>[key,body.input?.[key]===true]));
      if(player.edges.length<8){
       const edge=Object.fromEntries(edgeKeys.map(key=>[key,body.input?.[key]===true]));
       edge.attacks=Array.isArray(body.input?.attacks)?body.input.attacks.filter(x=>x==='punch'||x==='kick').slice(0,3):[];
       if(edgeKeys.some(key=>edge[key])||edge.attacks.length)player.edges.push(edge);
      }
      break;
     case '/api/room/pause':
      if(!room.players.every(p=>p?.stream))throw new Error('Waiting for both fighters to reconnect.');
      room.paused=!!body.paused;
      room.reason=room.paused?'Match paused by a fighter.':'';
      room.players.forEach(p=>{p.input={};p.edges=[];});
      broadcast(room);
      break;
     case '/api/room/leave':
      for(const [index,p] of room.players.entries())if(p?.stream){send(p.stream,{closed:true,message:index===seat?'You left the room.':'The other fighter left the room.'});p.stream.end();}
      rooms.delete(room.code);
      break;
     default:throw Object.assign(new Error('Unknown room action'),{status:404});
    }
    result={ok:true};
   }
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  }catch(error){
   if(!res.headersSent)res.writeHead(error.status||400,{'Content-Type':'application/json'});
   res.end(JSON.stringify({error:error.message}));
  }
  return true;
 }
 let previous=performance.now(),accumulator=0;
 const timer=setInterval(()=>{
  const clock=performance.now();
  accumulator+=Math.min(250,clock-previous);previous=clock;
  const steps=Math.min(5,Math.floor(accumulator/(STEP*1000)));
  if(!steps)return;
  accumulator-=steps*STEP*1000;
  const now=Date.now();
  for(const room of rooms.values()){
   if(now-room.created>3*60*60*1000||room.players.every(p=>!p||(!p.stream&&now-p.seen>120000))){
    for(const p of room.players)p?.stream?.end();
    rooms.delete(room.code);continue;
   }
   if(!room.match||room.paused||!room.players.every(p=>p?.stream))continue;
   for(let step=0;step<steps;step++){
   const input=room.players.map(p=>{
    if(now-p.lastInput>300){p.edges=[];return {};}
    return {...p.input,...(p.edges.shift()||{})};
   });
   const events=advance(room.match,input);
   for(const event of events){
    if(event.type==='roundEnd'&&event.knockout)room.match.phaseTime=Math.max(room.match.phaseTime,3.2);
   }
   room.events.push(...events);
   if(++room.step%3===0){
    broadcast(room,room.events);
    room.events=[];
   }
   }
  }
 },8);
 timer.unref();
 return {handle,close(){clearInterval(timer);for(const room of rooms.values())for(const p of room.players)p?.stream?.end();}};
}
