// Fixed-step, renderer-independent arcade fighting simulation.
export const STEP=1/60;
export const WARMUP_SECONDS=3.4;
export const MOVES={punch:{startup:6,active:5,recovery:15,reach:1.22,damage:7,stun:15,push:.13},kick:{startup:11,active:6,recovery:24,reach:1.72,damage:11,stun:21,push:.24},sweep:{startup:13,active:7,recovery:28,reach:1.62,damage:9,stun:30,push:.18,low:true}};
export const SIGNATURES={safari:'punch',blast:'kick',spin:'grab',slap:'grab',burst:'punch',spit:'grab'};
const GRAB={startup:16,active:5,recovery:21,reach:1.06};
export const SPECIALS={dhobi:{impacts:[.69,1.40],duration:2.03,damage:[8,11]},throw:{impacts:[.90],duration:1.73,damage:17},signature:{impacts:[.65],duration:1.38,damage:15},safari:{impacts:[2.55,3.85,5.15],duration:7,damage:12},spin:{impacts:[3.40],duration:4.65,damage:36},blast:{impacts:[1.45],duration:2.85,damage:32},
 slap:{impacts:[.91,2.18],duration:3.48,damage:[12,24]},
 burst:{impacts:[1.24,1.49,1.74,1.99],duration:3.40,damage:9},
 spit:{impacts:[2.22],duration:3.64,damage:34}};
export function fighter(x,id,kind='safari'){return {id,kind,x,y:0,vx:0,vy:0,hp:100,facing:id===0?1:-1,attack:null,attackQueue:[],taunt:0,tauntCooldown:0,signatureBuffer:0,specialBuffer:0,stun:0,crouch:false,block:false,walk:0,hits:0,combo:0,comboAt:0,flash:0,state:'idle',meter:0,safeguardUsed:false,specialCooldown:0};}
export function createMatch(mode='cpu',roster=['safari','safari'],showcase=false){let m={fighters:[fighter(-1.65,0,roster[0]),fighter(1.65,1,roster[1])],mode,roster:[...roster],tick:0,time:60,phase:'intro',phaseTime:WARMUP_SECONDS,round:1,wins:[0,0],events:[],winner:null,aiTimer:0,aiInput:{},special:null,showcase:showcase&&mode!=='training',presentation:null};if(m.showcase)present(m,'entrance',0);if(mode==='training')m.fighters[0].meter=100;return m;}
const CHAIN_MOVES=['punch','kick'];
const BUFFER_TICKS=50;

export function attackTiming(atk){
 const move=atk.name==='grab'?GRAB:MOVES[atk.name];
 if(atk.variant==='forward')return {...move,startup:move.startup+2,reach:move.reach+.24,damage:move.damage+2};
 if(atk.signature&&atk.name!=='grab')return {...move,startup:move.startup+7,active:move.active+3,damage:move.damage+4};
 return atk.link>1?{...move,startup:move.startup-2}:move;
}
export function attack(f,name,previous=null){
 if(f.attack||f.stun||f.hp<=0)return false;
 if(name==='sweep'&&f.y>.05)return false;
 const chainable=CHAIN_MOVES.includes(name);
 const link=previous?previous.link+1:1;
 const side=link%2===1?(name==='punch'?'L':'R'):(name==='punch'?'R':'L');
 const style=link<3?'straight':name==='kick'?'roundhouse':previous?.name==='kick'?'cross':'hook';
 f.attack={name,frame:0,hit:false,landed:false,facing:f.facing,link,side,style,chainable};
 f.state=name;
 return true;
}
function readAttacks(f,input,tick){
 if(input.grab&&!f.stun&&f.y<.05&&(!f.attack||(f.attack.frame<=3&&f.attack.chainable))){
  f.attack=null;
  f.attackQueue.length=0;
  attack(f,'grab');
  return;
 }
 if(f.stun||input.block){f.attackQueue.length=0;return;}
 while(f.attackQueue[0]?.expires<tick)f.attackQueue.shift();
 const commands=input.attacks??CHAIN_MOVES.filter(name=>input[name]).reverse();
 if(!f.attack&&(input.sweep||(input.crouch&&commands[0]==='kick'))){f.attackQueue.length=0;attack(f,'sweep');return;}
 for(const name of commands){
  if(CHAIN_MOVES.includes(name)&&f.attackQueue.length<(f.attack?.chainable?3-f.attack.link:f.attack?0:3))
   f.attackQueue.push({name,expires:tick+BUFFER_TICKS,low:input.crouch&&name==='punch',forward:f.facing>0?input.right:input.left});
 }
 if(!f.attack&&f.attackQueue.length){
  const next=f.attackQueue.shift();
  if(attack(f,next.name)){
   f.attack.lowJab=next.low;
   if(!next.low&&next.forward){
    f.attack.variant='forward';
    f.attack.style=next.name==='kick'?'roundhouse':'cross';
   }
  }
 }
}
function linkAttack(f,target,atk,tick,timing){
 const next=f.attackQueue[0];
 if(target.hp<=0||!atk.chainable||atk.link>=3||!next||next.expires<tick||atk.frame<timing.startup+timing.active+3)return false;
 f.attackQueue.shift();
 f.attack=null;
 if(!attack(f,next.name,atk))return false;
 if(atk.landed&&target.hp>0){
  const distance=(target.x-f.x)*atk.facing;
  if(distance>0)f.x+=atk.facing*Math.min(.46,Math.max(0,distance-.73));
  if(target.stun)target.vx*=.40;
 }
 return true;
}
export function cpuInput(m,random=Math.random){let a=m.fighters[1],b=m.fighters[0],distance=Math.abs(a.x-b.x);if(specialReady(a)&&random()<.04)return {special:true};const fresh=--m.aiTimer<=0;if(fresh){m.aiTimer=(m.difficulty==='easy'?26:m.difficulty==='hard'?6:10)+Math.floor(random()*18);m.aiInput={};if(distance>1.35)m.aiInput[a.x>b.x?'left':'right']=true;else if(distance<.65&&random()<.25)m.aiInput[a.x>b.x?'right':'left']=true;if(b.attack&&random()<(m.difficulty==='easy'?.25:m.difficulty==='hard'?.8:.55))m.aiInput.block=true;else if(distance<1.65){let r=random();m.aiInput[r<.45?'punch':r<.8?'kick':'sweep']=true;}if(b.attack?.name==='sweep'&&random()<.55)m.aiInput.jump=true;}return {...m.aiInput,attacks:fresh?CHAIN_MOVES.filter(name=>m.aiInput[name]):[]};}
function present(m,phase,id){
 m.phase=phase;
 m.presentation={id,kind:m.roster[id],time:0,duration:phase==='victory'?4.4:m.roster[id]==='safari'?8.5:5.5};
 m.events.push({type:'presentationStart'});
}
function advancePresentation(m,skip){
 const shot=m.presentation;
 shot.time+=STEP;
 if(!skip&&shot.time<shot.duration)return;
 if(m.phase==='entrance'&&shot.id===0){present(m,'entrance',1);return;}
 m.presentation=null;
 m.events.push({type:'presentationEnd'});
 if(m.phase==='victory'){
  m.phase='over';
  m.events.push({type:'matchEnd',winner:m.winner});
 }else{
  m.phase='intro';
  m.phaseTime=WARMUP_SECONDS;
  m.events.push({type:'newRound'});
 }
}
export function advance(m,inputs=[{},{}]){m.events=[];m.tick++;if(m.phase==='over')return m.events;if(m.presentation){advancePresentation(m,inputs[0]?.skip);return m.events;}if(m.phase==='knockout'){advanceKnockout(m);return m.events;}if(m.phase==='special'){advanceSpecial(m);return m.events;}if(m.phase!=='fight'){m.phaseTime-=STEP;if(m.phaseTime<=0){if(m.phase==='intro'){m.phase='fight';m.events.push({type:'fight'});}else if(m.phase==='roundEnd'){if(Math.max(...m.wins)>=2){if(m.showcase&&m.winner!==null)present(m,'victory',m.winner);else{m.phase='over';m.events.push({type:'matchEnd',winner:m.winner});}}else{m.round++;m.fighters=[fighter(-1.65,0,m.roster[0]),fighter(1.65,1,m.roster[1])];m.time=60;if(m.mode==='training')m.fighters[0].meter=100;m.phase='intro';m.phaseTime=WARMUP_SECONDS;m.events.push({type:'newRound'});}}}return m.events;}
 for(let i=0;i<2;i++){
  const f=m.fighters[i];
  f.specialCooldown=Math.max(0,f.specialCooldown-STEP);
  f.specialBuffer=Math.max(0,f.specialBuffer-1);
  if(inputs[i]?.special){
   if(specialReady(f))f.specialBuffer=50;
   else if(m.mode!=='cpu'||i===0)m.events.push({type:'specialUnavailable',id:i,cooldown:f.specialCooldown>0});
  }
  if(f.specialBuffer&&beginSpecial(m,i))return m.events;
 }
 if(m.mode!=='training')m.time=Math.max(0,m.time-STEP);
 for(let i=0;i<2;i++){let f=m.fighters[i],other=m.fighters[1-i],input=inputs[i]||{};f.flash=Math.max(0,f.flash-STEP);f.stun=Math.max(0,f.stun-1);if(!f.attack)f.facing=other.x>=f.x?1:-1;f.crouch=!!input.crouch&&f.y===0&&!f.attack&&!f.stun;f.block=!!input.block&&f.y===0&&!f.attack&&!f.stun;
 if(f.hp<=0)continue;
 if(!f.stun&&(!f.attack||(f.attack.name==='kick'&&f.attack.frame<=3))&&input.jump&&f.y===0){f.vy=6;f.crouch=false;m.events.push({type:'jump',id:i});}
 f.tauntCooldown=Math.max(0,f.tauntCooldown-1);
 f.taunt=Math.max(0,f.taunt-1);
 f.signatureBuffer=Math.max(0,f.signatureBuffer-1);
 const signaturePressed=(input.taunt||input.grabSignature)&&!f.tauntCooldown&&!input.crouch;
 if(signaturePressed)f.signatureBuffer=45;
 else if(input.grabSignature&&input.crouch)f.signatureBuffer=0;
 if(f.signatureBuffer&&!f.attack&&!f.stun&&!f.block&&!f.crouch&&f.y===0&&f.vy===0){
  f.signatureBuffer=0;
  const name=SIGNATURES[f.kind];
  attack(f,name);
  f.attack.signature=f.kind;
  f.attack.chainable=false;
  f.attack.style=name==='kick'?'roundhouse':f.kind==='burst'?'hook':'cross';
  f.taunt=82;
  f.tauntCooldown=240;
  m.events.push({type:'taunt',id:i,kind:f.kind});
 }
 readAttacks(f,input.grabSignature&&!signaturePressed?{...input,grab:true}:input,m.tick);
 if((f.attack&&!f.attack.signature)||f.stun||f.block||f.crouch||f.vy>0)f.taunt=0;
 let dir=(!!input.right)-(!!input.left),speed=f.crouch?.65:f.block?.7:2.5;f.vx=f.stun?f.vx*.86:(!f.attack?dir*speed:f.y>.02&&f.attack.name==='kick'?dir*speed*.68:0);f.x+=f.vx*STEP;f.x=Math.max(-3.7,Math.min(3.7,f.x));f.walk+=Math.abs(f.vx)*STEP;
 if(f.y>0||f.vy>0){f.vy-=18*STEP;f.y+=f.vy*STEP;if(f.y<0){f.y=0;f.vy=0;}}
 f.state=f.stun?'hit':f.attack?f.attack.name:f.y>.02?'jump':f.crouch?'crouch':f.block?'block':Math.abs(f.vx)>.1?'walk':'idle';
 }
 let [a,b]=m.fighters;let gap=b.x-a.x;if(Math.abs(gap)<.62&&Math.abs(a.y-b.y)<1.15){let s=gap>=0?1:-1,amount=(.62-Math.abs(gap))/2;a.x-=s*amount;b.x+=s*amount;}
 // Resolve active hitboxes against opposing hurt regions. One hit per attack.
 for(let i=0;i<2;i++){let f=m.fighters[i],t=m.fighters[1-i],atk=f.attack;if(!atk)continue;let def=attackTiming(atk);if(stepIntoSignature(f,t,atk,def))continue;atk.frame++;if(atk.name==='grab'){if(atk.frame>=def.startup&&atk.frame<def.startup+def.active&&t.hp>0&&!protectedAttack(t)&&t.y<.12&&(t.x-f.x)*atk.facing>0&&Math.abs(t.x-f.x)<def.reach){startSignatureSequence(m,f,t,atk.signature==='slap'?'dhobi':'throw');return m.events;}if(atk.frame>=def.startup+def.active+def.recovery)f.attack=null;continue;}if(!atk.hit&&atk.frame>=def.startup&&atk.frame<def.startup+def.active&&f.hp>0&&!protectedAttack(t)){let forward=(t.x-f.x)*atk.facing;let inRange=forward>0&&forward<def.reach;let heightOK=def.low?(t.y<.28&&f.y<.1):Math.abs(t.y-f.y)<(atk.name==='punch'?.65:f.y>.03?1.22:1.0);if(atk.name==='punch'&&!atk.lowJab&&t.crouch&&f.y<.1)heightOK=false;if(inRange&&heightOK){const back=t.facing>0?inputs[1-i]?.left:inputs[1-i]?.right;let guarded=(t.block||(back&&!t.attack&&!t.stun&&t.y<.05))&&t.facing===-atk.facing;if(atk.signature&&!guarded){startSignatureSequence(m,f,t,'signature');return m.events;}atk.hit=true;let baseDamage=def.damage+(atk.link===3?2:0);let damage=guarded?Math.ceil(baseDamage*.15):baseDamage;atk.landed=!guarded;t.hp=Math.max(0,t.hp-damage);if(t.hp===0){t.ko={time:0,dir:atk.facing,cause:atk.name};t.y=.03;t.vy=atk.name==='kick'?5.4:4.2;t.vx=atk.facing*(atk.name==='kick'?3.3:2.6);}f.meter=Math.min(100,f.meter+damage*3);t.meter=Math.min(100,t.meter+damage*.5);if(!guarded){t.stun=def.stun;t.hitMove=atk.name;t.taunt=0;t.attack=null;t.attackQueue.length=0;if(!t.ko){const followUp=atk.chainable&&atk.link<3&&f.attackQueue.length>0;t.vx=atk.facing*def.push/STEP*(followUp?.25:1);}t.x=Math.max(-3.7,Math.min(3.7,t.x+atk.facing*def.push));t.flash=.12;f.hits++;f.combo=m.tick-f.comboAt<65?f.combo+1:1;f.comboAt=m.tick;}m.events.push({type:'hit',attacker:i,target:1-i,move:atk.name,signature:atk.signature,damage,blocked:guarded,x:t.x,y:t.y+(def.low?.2:atk.lowJab?.84:1.2),combo:f.combo});}}
 if(f.attack===atk&&!linkAttack(f,t,atk,m.tick,def)&&atk.frame>=def.startup+def.active+def.recovery)f.attack=null;
 }
 if(a.hp<=0||b.hp<=0||m.time<=0)endRound(m);
 return m.events;
}

function protectedAttack(fighter){
 const attack=fighter.attack;
 return fighter.specialBuffer>0||(attack?.signature&&attack.frame<=attackTiming(attack).startup+attackTiming(attack).active);
}
function stepIntoSignature(fighter,target,attack,timing){
 if(!attack.signature||attack.frame!==0||fighter.y>.02)return false;
 const distance=(target.x-fighter.x)*attack.facing;
 const steps=attack.approachFrames??0;
 attack.approaching=distance>timing.reach-.119&&steps<28;
 if(!attack.approaching)return false;
 attack.facing=target.x>=fighter.x?1:-1;
 const step=Math.min(.095,distance-(timing.reach-.12));
 fighter.x=Math.max(-3.7,Math.min(3.7,fighter.x+attack.facing*step));
 fighter.walk+=step;
 attack.approachFrames=steps+1;
 return true;
}

function startSignatureSequence(m,owner,target,kind){
 const facing=owner.attack.facing;
 const signature=owner.attack.signature;
 owner.attack=null;
 target.attack=null;
 owner.attackQueue.length=0;
 target.attackQueue.length=0;
 owner.vx=target.vx=target.vy=0;
 target.y=0;
 target.taunt=0;
 const center=Math.max(-2,Math.min(2,(owner.x+target.x)/2));
 m.special={kind,signature,owner:owner.id,target:target.id,time:0,hits:0,
  ownerX:owner.x,targetX:target.x,facing,center};
 m.phase='special';
}
export function specialReady(f){return f.hp>0&&f.specialCooldown<=0&&(f.meter>=100||(f.hp<=25&&!f.safeguardUsed));}
export function beginSpecial(m,id){let f=m.fighters[id],target=m.fighters[1-id];if(m.phase!=='fight'||!specialReady(f)||f.y>.05||target.hp<=0)return false;const emergency=f.meter<100;if(emergency)f.safeguardUsed=true;f.meter=0;f.specialCooldown=12;f.specialBuffer=0;f.signatureBuffer=0;target.specialBuffer=0;target.signatureBuffer=0;f.attack=null;f.taunt=0;target.taunt=0;f.attackQueue.length=0;f.stun=0;f.vx=0;target.attack=null;target.attackQueue.length=0;target.vx=0;target.y=0;target.vy=0;const facing=target.x>=f.x?1:-1;const center=Math.max(-1.65,Math.min(1.65,(f.x+target.x)/2));m.special={kind:f.kind,owner:id,target:1-id,time:0,hits:0,ownerX:f.x,targetX:target.x,facing,center};m.phase='special';m.events.push({type:'specialStart',owner:id,emergency});return true;}
export function specialLanding(s){
 return s.center+s.facing*(s.kind==='dhobi'?-1.46:s.kind==='throw'?1.64:s.kind==='signature'?1.53:s.kind==='spin'?2.00:1.94);
}
function advanceSpecial(m){
 const s=m.special, profile=SPECIALS[s.kind], owner=m.fighters[s.owner], target=m.fighters[s.target];
 s.time+=STEP;
 while(s.hits<profile.impacts.length&&s.time>=profile.impacts[s.hits]){
  s.hits++;
  const damage=Math.min(Array.isArray(profile.damage)?profile.damage[s.hits-1]:profile.damage,target.hp);
  target.hp-=damage;
  target.flash=.18;
  target.state='knockdown';
  if(['throw','dhobi','signature'].includes(s.kind))owner.hits++;

  m.events.push({type:'specialHit',attacker:s.owner,target:s.target,kind:s.kind,pass:s.hits,damage,
    x:s.kind==='safari'?0:s.center+s.facing*(s.kind==='dhobi'?(s.hits===1?1.36:-1.36):.77),y:['spin','slap','burst','spit'].includes(s.kind)?1.15:.55});
 }
 target.flash=Math.max(0,target.flash-STEP);
 if(s.time<profile.duration)return;
 if(['throw','dhobi','signature'].includes(s.kind))owner.taunt=0;
 owner.x=s.kind==='safari'?s.ownerX:s.center-s.facing*.42;
 target.x=s.kind==='safari'?s.targetX:specialLanding(s);
 target.state='idle';
 target.stun=20;
 m.phase='fight';
 m.special=null;
 m.events.push({type:'specialEnd'});
 if(m.mode==='training'&&!['throw','dhobi','signature'].includes(s.kind))m.fighters[0].meter=100;
 if(target.hp<=0){
  if(s.kind!=='safari'){
   target.ko={time:1,dir:s.facing,cause:s.kind};
   target.facing=-s.facing;
  }
  endRound(m);
  if(s.kind!=='safari')m.phaseTime=.45;
 }
}
function endRound(m){if(m.fighters.some(f=>f.hp<=0&&f.ko)){m.phase='knockout';m.phaseTime=1.65;m.events.push({type:'knockoutLaunch'});return;}awardRound(m);}
function awardRound(m){let [a,b]=m.fighters;m.winner=a.hp===b.hp?null:a.hp>b.hp?0:1;if(m.winner!==null)m.wins[m.winner]++;else{m.wins[0]++;m.wins[1]++;}m.phase='roundEnd';m.phaseTime=2.4;m.events.push({type:'roundEnd',winner:m.winner,knockout:a.hp<=0||b.hp<=0});}

function advanceKnockout(m){m.phaseTime-=STEP;for(let f of m.fighters){f.flash=Math.max(0,f.flash-STEP);if(f.hp>0){if(f.attack){const d=attackTiming(f.attack);if(++f.attack.frame>=d.startup+d.active+d.recovery)f.attack=null;}f.state=f.attack?f.attack.name:'idle';continue;}f.ko.time+=STEP;if(f.y>0||f.vy>0){f.vy-=12*STEP;f.y=Math.max(0,f.y+f.vy*STEP);f.x=Math.max(-4.4,Math.min(4.4,f.x+f.vx*STEP));f.vx*=.995;if(f.y===0){f.vy=0;f.vx=0;}}}if(m.phaseTime<=0)awardRound(m);}



















