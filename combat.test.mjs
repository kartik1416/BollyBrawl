import test from 'node:test';import assert from 'node:assert/strict';import {createMatch,advance,attack,cpuInput,MOVES,SPECIALS} from './combat.js';
function setup(){let m=createMatch('local');m.phase='fight';m.fighters[0].x=-.45;m.fighters[1].x=.45;return m;}
function ticks(m,n,input=[{},{}]){for(let i=0;i<n;i++)advance(m,input);}
test('punch hits once per attack',()=>{let m=setup();attack(m.fighters[0],'punch');ticks(m,12);assert.equal(m.fighters[1].hp,100-MOVES.punch.damage);assert.equal(m.fighters[0].hits,1);});
test('out-of-range punch misses',()=>{let m=setup();m.fighters[1].x=3;attack(m.fighters[0],'punch');ticks(m,20);assert.equal(m.fighters[1].hp,100);});
test('standing punch misses crouching defender',()=>{let m=setup();attack(m.fighters[0],'punch');ticks(m,12,[{},{crouch:true}]);assert.equal(m.fighters[1].hp,100);});
test('sweep misses an airborne opponent',()=>{let m=setup();m.fighters[1].y=.9;attack(m.fighters[0],'sweep');ticks(m,14);assert.equal(m.fighters[1].hp,100);});
test('guard reduces damage and prevents hitstun',()=>{let m=setup();attack(m.fighters[0],'kick');ticks(m,13,[{},{block:true}]);assert.equal(m.fighters[1].hp,98);assert.equal(m.fighters[1].stun,0);});
test('jump lands back on ground',()=>{let m=setup();advance(m,[{jump:true},{}]);assert.ok(m.fighters[0].y>0);ticks(m,90);assert.equal(m.fighters[0].y,0);assert.equal(m.fighters[0].vy,0);});
test('KO launch lands before scoring, then ends best-of-three',()=>{let m=setup();m.fighters[1].hp=1;attack(m.fighters[0],'kick');ticks(m,13);assert.equal(m.phase,'knockout');assert.equal(m.wins[0],0);assert.ok(m.fighters[1].vy>0);let start=m.fighters[1].x;ticks(m,40);assert.ok(m.fighters[1].x>start);ticks(m,65);assert.equal(m.phase,'roundEnd');assert.equal(m.fighters[1].y,0);assert.equal(m.fighters[0].attack,null);assert.equal(m.wins[0],1);ticks(m,150);assert.equal(m.round,2);m.phase='fight';m.fighters[0].x=-.45;m.fighters[1].x=.45;m.fighters[1].hp=1;attack(m.fighters[0],'kick');ticks(m,13);ticks(m,260);assert.equal(m.phase,'over');assert.equal(m.wins[0],2);});
test('practice timer and arena bounds',()=>{let m=setup();m.mode='training';ticks(m,600,[{left:true},{}]);assert.equal(m.time,60);assert.ok(m.fighters[0].x>=-3.7);});

test('dominance fills from landed attacks',()=>{let m=setup();attack(m.fighters[0],'punch');ticks(m,8);assert.equal(m.fighters[0].meter,21);assert.ok(m.fighters[1].meter>0);});
test('uncharged special is unavailable at healthy HP',()=>{let m=setup();advance(m,[{special:true},{}]);assert.equal(m.phase,'fight');assert.equal(m.special,null);});
test('critical-health safeguard is one use unless dominance recharges',()=>{let m=setup();m.fighters[0].hp=25;advance(m,[{special:true},{}]);assert.equal(m.phase,'special');assert.equal(m.fighters[0].safeguardUsed,true);ticks(m,430);assert.equal(m.phase,'fight');m.fighters[0].specialCooldown=0;advance(m,[{special:true},{}]);assert.equal(m.phase,'fight');m.fighters[0].meter=100;advance(m,[{special:true},{}]);assert.equal(m.phase,'special');});
test('car special freezes timer and delivers exactly three hits',()=>{let m=setup();m.fighters[0].meter=100;let timer=m.time;advance(m,[{special:true},{}]);assert.equal(m.phase,'special');assert.equal(m.fighters[0].meter,0);let hits=0;for(let i=0;i<421;i++){advance(m,[{punch:true,left:true},{kick:true}]);hits+=m.events.filter(e=>e.type==='specialHit').length;}assert.equal(hits,3);assert.equal(m.fighters[1].hp,64);assert.equal(m.fighters[0].hp,100);assert.ok(Math.abs(m.time-timer)<.05);});
test('special knockout finishes sequence before awarding round',()=>{let m=setup();m.fighters[0].meter=100;m.fighters[1].hp=10;advance(m,[{special:true},{}]);ticks(m,200);assert.equal(m.fighters[1].hp,0);assert.equal(m.phase,'special');assert.equal(m.wins[0],0);ticks(m,225);assert.equal(m.phase,'roundEnd');assert.equal(m.wins[0],1);});

for(const [kind,damage,duration] of [['spin',36,4.65],['blast',32,2.85]]){
 test(kind+' special hits once and places the victim at the cinematic landing',()=>{
  const m=createMatch('training',[kind,'safari']);
  m.phase='fight';
  advance(m,[{special:true},{}]);
  assert.equal(m.special.kind,kind);
  const impacts=[];
  while(m.phase==='special') impacts.push(...advance(m).filter(e=>e.type==='specialHit'));
  assert.equal(impacts.length,1);
  assert.equal(impacts[0].damage,damage);
  assert.equal(m.fighters[1].hp,100-damage);
  assert.ok(m.fighters[1].x>m.fighters[0].x+2);
  assert.ok(m.tick>=duration*60);
 });
}
test('player two uses their own special and a lethal throw scores after landing',()=>{
 const m=createMatch('local',['blast','spin']);
 m.phase='fight';
 m.fighters[0].hp=20;
 m.fighters[1].meter=100;
 advance(m,[{},{special:true}]);
 assert.equal(m.special.kind,'spin');
 ticks(m,280);
 assert.equal(m.phase,'knockout');
 assert.equal(m.wins[1],0);
 ticks(m,30);
 assert.equal(m.wins[1],1);
 ticks(m,150);
 assert.deepEqual(m.fighters.map(f=>f.kind),['blast','spin']);
});


for(const [kind,damage] of [['slap',[12,24]],['burst',[9,9,9,9]],['spit',[34]]]){
 test(kind+' uses the CPU fighter special and preserves the selected matchup',()=>{
  const m=createMatch('cpu',['spin',kind]);
  m.phase='fight';
  m.fighters[1].meter=100;
  advance(m,[{},cpuInput(m,()=>0)]);
  assert.equal(m.special.kind,kind);
  assert.equal(m.special.owner,1);
  const impacts=[];
  while(m.phase==='special'){
   for(const event of advance(m).filter(e=>e.type==='specialHit'))
    impacts.push({damage:event.damage,time:m.special.time});
  }
  assert.deepEqual(impacts.map(e=>e.damage),damage);
  impacts.forEach((e,i)=>assert.ok(Math.abs(e.time-SPECIALS[kind].impacts[i])<.02));
  assert.equal(m.fighters[0].hp,100-damage.reduce((sum,amount)=>sum+amount,0));
  assert.deepEqual(m.fighters.map(f=>f.kind),['spin',kind]);
 });
}

for(const [keys,finisher] of [['KKJ','cross'],['JKJ','cross'],['JKK','roundhouse'],['JJJ','hook']]){
 test(keys+' executes all three ordered inputs and lands its finisher',()=>{
  const m=setup();
  const moves=[...keys].map(key=>key==='J'?'punch':'kick');
  const started=[],hits=[];
  for(let tick=0;tick<75;tick++){
   const command=tick===0?moves.slice(0,1):tick===4?moves.slice(1):[];
   const events=advance(m,[{attacks:command},{}]);
   const current=m.fighters[0].attack;
   if(current&&!started.some(atk=>atk.link===current.link))started.push(current);
   hits.push(...events.filter(e=>e.type==='hit'));
  }
  assert.deepEqual(started.map(atk=>atk.name),moves);
  assert.equal(started.at(-1).style,finisher);
  assert.equal(hits.length,3);
  assert.equal(hits.at(-1).combo,3);
 });
}
test('a stun interrupts buffered follow-ups',()=>{
 const m=setup();
 advance(m,[{attacks:['kick','kick','punch']},{punch:true}]);
 ticks(m,45);
 assert.equal(m.fighters[0].attack,null);
 assert.equal(m.fighters[0].attackQueue.length,0);
 assert.equal(m.fighters[1].hp,100);
});
test('jump and kick can begin on the same tick and land an airborne strike',()=>{
 const m=setup();
 advance(m,[{jump:true,attacks:['kick']},{}]);
 assert.ok(m.fighters[0].y>0);
 assert.equal(m.fighters[0].attack.name,'kick');
 ticks(m,12);
 assert.equal(m.fighters[1].hp,89);
});
test('jump can follow a kick input during its first three frames',()=>{
 const m=setup();
 advance(m,[{attacks:['kick']},{}]);
 advance(m,[{jump:true},{}]);
 assert.ok(m.fighters[0].y>0);
 assert.equal(m.fighters[0].attack.name,'kick');
});


test('signature strike deals damage with an empty meter',()=>{
 const match=setup();
 const fighter=match.fighters[0];
 assert.equal(fighter.meter,0);
 const events=advance(match,[{taunt:true},{}]);
 assert.ok(events.some(event=>event.type==='taunt'));
 assert.equal(fighter.attack.signature,'safari');
 ticks(match,101);
 assert.equal(match.fighters[1].hp,85);
});
test('Dhobi Pachad lands twice on opposite sides, bypasses guard and spends no meter',()=>{
 const match=setup();
 const owner=match.fighters[0];
 owner.kind='slap';
 owner.meter=23;
 advance(match,[{taunt:true},{block:true}]);
 ticks(match,18,[{},{block:true}]);
 assert.equal(match.special.kind,'dhobi');
 const hits=[];
 for(let i=0;i<130;i++)hits.push(...advance(match).filter(e=>e.type==='specialHit'));
 assert.deepEqual(hits.map(e=>e.damage),[8,11]);
 assert.ok(hits[0].x>0&&hits[1].x<0);
 assert.equal(match.phase,'fight');
 assert.equal(owner.meter,23);
 assert.equal(match.fighters[1].hp,81);
 assert.ok(match.fighters[1].x<owner.x);
});
test('signature grab whiffs against a distant opponent',()=>{
 const match=setup();
 match.fighters[0].kind='spin';
 match.fighters[0].x=-3;
 match.fighters[1].x=3;
 advance(match,[{taunt:true},{}]);
 ticks(match,75);
 assert.equal(match.special,null);
 assert.equal(match.fighters[1].hp,100);
});


test('signature grab steps into range before the throw',()=>{
 const match=setup();
 const owner=match.fighters[0];
 owner.kind='slap';
 match.fighters[1].x=1.12;
 const start=owner.x;
 advance(match,[{taunt:true},{}]);
 ticks(match,27);
 assert.ok(owner.x>start);
 assert.equal(match.special?.kind,'dhobi');
});
test('round warm-up keeps the timer and attacks inactive',()=>{
 const match=createMatch();
 ticks(match,150,[{punch:true},{taunt:true}]);
 assert.equal(match.phase,'intro');
 assert.equal(match.time,60);
 assert.ok(match.fighters.every(fighter=>fighter.attack===null));
 ticks(match,60);
 assert.equal(match.phase,'fight');
});



test('a CPU kick during signature startup cannot cancel the signature',()=>{
 const match=setup();
 match.mode='cpu';
 match.fighters[0].kind='slap';
 advance(match,[{taunt:true},{kick:true}]);
 ticks(match,17);
 assert.equal(match.fighters[0].hp,100);
 assert.equal(match.special?.kind,'dhobi');
});
test('a ready super pressed in the air starts on landing before a CPU strike',()=>{
 const match=setup();
 match.mode='cpu';
 const player=match.fighters[0];
 player.meter=100;
 player.y=.58;
 player.vy=-2;
 advance(match,[{special:true},{kick:true}]);
 assert.ok(player.specialBuffer>0);
 ticks(match,17);
 assert.equal(match.phase,'special');
 assert.equal(match.special.owner,0);
 assert.equal(player.hp,100);
});
test('an uncharged super reports why it cannot start',()=>{
 const match=setup();
 const events=advance(match,[{special:true},{}]);
 assert.ok(events.some(event=>event.type==='specialUnavailable'&&!event.cooldown));
});
test('down-jab opens a kick combo and down-kick starts a sweep',()=>{
 const match=setup();
 advance(match,[{crouch:true,attacks:['punch','kick']},{crouch:true}]);
 assert.ok(match.fighters[0].attack.lowJab);
 ticks(match,19);
 assert.equal(match.fighters[0].attack.name,'kick');
 const sweep=setup();
 advance(sweep,[{crouch:true,attacks:['kick']},{}]);
 assert.equal(sweep.fighters[0].attack.name,'sweep');
});
test('forward kick selects the roundhouse and I grab throws in range',()=>{
 const match=setup();
 advance(match,[{right:true,attacks:['kick']},{}]);
 assert.equal(match.fighters[0].attack.style,'roundhouse');
 const grab=setup();
 advance(grab,[{grab:true},{}]);
 ticks(grab,17);
 assert.equal(grab.special?.kind,'throw');
});


test('match showcases both fighters, then the winner, while combat stays frozen',()=>{
 const match=createMatch('cpu',['safari','spit'],true);
 assert.equal(match.phase,'entrance');
 assert.equal(match.presentation.kind,'safari');
 ticks(match,60,[{punch:true},{special:true}]);
 assert.equal(match.time,60);
 assert.equal(match.fighters[0].attack,null);
 advance(match,[{skip:true},{}]);
 assert.equal(match.presentation.kind,'spit');
 advance(match,[{skip:true},{}]);
 assert.equal(match.phase,'intro');
 assert.equal(match.presentation,null);
 match.phase='roundEnd';
 match.phaseTime=0;
 match.winner=1;
 match.wins=[0,2];
 assert.deepEqual(advance(match).map(e=>e.type),['presentationStart']);
 assert.equal(match.phase,'victory');
 assert.equal(match.presentation.kind,'spit');
 assert.deepEqual(advance(match,[{skip:true},{}]).map(e=>e.type),['presentationEnd','matchEnd']);
 assert.equal(match.phase,'over');
});

test('the combined grab input uses the signature, with a standard throw on cooldown or Down',()=>{
 for(const [cooldown,down,kind] of [[0,false,'dhobi'],[100,false,'throw'],[0,true,'throw']]){
  const match=setup();
  match.fighters[0].kind='slap';
  match.fighters[0].tauntCooldown=cooldown;
  advance(match,[{grabSignature:true,crouch:down},{}]);
  ticks(match,28);
  assert.equal(match.special?.kind,kind);
 }
});
