import * as THREE from 'three';

const attackerLines={
 safari:['Swagat nahi karoge hamara?','Tiger ki Safari aa gayi!'],
 spin:['Don ko pakadna mushkil hai. Ab tu sambhal!','Ek round aur, mere dost!'],
 blast:['Chhoti bachchi ho kya? Zara peeche dekh!','Khauf ka asli jhonka!'],
 slap:['Yeh Baburao ka style hai!','Aur yeh lota bonus mein!'],
 burst:['Pachaas tola. Hisaab barabar!','Ab ginti bhool jayega!'],
 spit:['Bolo zubaan kesari, thuko bhi kesari!','Kesari ka seedha delivery!'],
};
const incoming={
 safari:'Arre, gaadi idhar kyun aa rahi hai?',
 spin:'Eeeee! Yeh kya kar rahe ho?',
 blast:'Arre bhai, udhar muh karo!',
 slap:'Arre! Lota kyun utha liya?',
 burst:'Arre bhai, yeh kya nikaal diya?',
 spit:'Oye, pichkari samjha hai kya?',
};
const hurtLines={
 safari:['Tiger ka balance bhi hil gaya!','Arre, brake kahan hai?'],
 spin:['Eeeee! Don ko chakkar aa gaya!','Picture mein yeh scene nahi tha!'],
 blast:['Mera stunt double kahan hai?','Yeh landing plan mein nahi thi!'],
 slap:['Aye, chashma sambhal ke!','Utha le re baba!'],
 burst:['Bawa ka hisaab abhi baaki hai!','Arre, chain toh rehne de!'],
 spit:['Arre! Vardi pe lag gaya!','Yeh toh seedha challan hai!'],
};
const names={safari:'Asli Tiger',spin:'Jon the Don',blast:'Tiger Khauf',slap:'Baburao',burst:'Bawa',spit:'Vimal Man'};
const voices={
 fight:[
  ['Thoko taali! Aaj mukkon ki mehfil jamegi!','Rapid fire shuru. Dekhte hain kaun jawab deta hai!'],
  ['Oye guru, guard bhi rakho aur hausla bhi!','Hero vs hero? Aaj casting badi interesting hai.']
 ],
 block:[['Oye guru, deewar jaisa guard!','Darling, rejection itna solid?'],['Taali attack pe, daad defence ko!','Us punch ki entry guest list mein nahi thi.']],
 combo:[['Thoko taali! Ek, do, teen! Kya barsaat hai!','Rapid fire mein lagataar teen jawab!'],['Mukka bhi sher, kick bhi sawa sher!','Chemistry kam, impact zyada. I love the drama!']],
 hit:[['Oye guru, seedha nishaane pe!','Darling, that landed. Ego pe bhi.'],['Balle! Is punch pe taali banti hai!','Yeh close-up replay mein chahiye mujhe.']],
 throw:[['Oye guru, hawa mein udta hisaab!','Darling, personal space ka kya hua?'],['Dhobi pachad! Zameen bhi hil gayi!','Yeh toh seedha floor audition ho gaya!']],
 special:[['Thoko taali! Ab hero apna rang dikhayega!','Special entry? Ab toh drama double hoga!'],['Oye guru, sambhal! Tufaan aa raha hai!','Rapid fire se seedha blockbuster mode!']],
 ko:[['Oye guru, taali jeet ko, izzat dono ko!','Darling, that was the final answer.'],['Khel khatam! Aaj ka sher mil gaya!','Is ending ke liye sequel banta hai.']],
 round:[['Saans le lo guru, agla round bhi hai!','Interval hai, darling. Drama abhi baaki hai.']],
 finish:[['Thoko taali! Aaj ka champion aa gaya!','Winner ka close-up lo, darling!']]
};

export function createFightDialogue({camera,element}){
 const feed=element('fight-commentary'), lines=[element('thoko-line'),element('karan-line')];
 const cards=Array.from(feed.querySelectorAll('.commentator'));
 const bubbles=[element('special-attacker-line'),element('special-opponent-line')];
 const screen=new THREE.Vector3();
 let tick=0, lastFeed=-Infinity, superKind=null, pass=0;
 function post(group,force=false){
  if(!force&&tick-lastFeed<1.45)return;
  const choices=voices[group];
  const pair=choices[Math.floor(tick*3)%choices.length];
  lines.forEach((line,i)=>{line.textContent=pair[i];cards[i].classList.toggle('speaking',i===Math.floor(tick)%2);});
  lastFeed=tick;
  feed.hidden=false;
 }
 function event(e,match){
  switch(e.type){
   case 'fight': post('fight',true);break;
   case 'hit':
    post(e.blocked?'block':e.combo>1?'combo':'hit',e.combo===3&&!e.blocked);
    if(match&&e.combo>=3&&!e.blocked)lines[1].textContent=names[match.fighters[e.attacker].kind]+' ka combo? Darling, ab toh rival ko break chahiye!';
    break;
   case 'specialStart':
    pass=0;post('special',true);
    if(match?.special){
     const fighter=names[match.fighters[e.owner].kind];
     lines[0].textContent=fighter+' ka special! Oye guru, thoko taali!';
     lines[1].textContent=fighter+' ne drama ka budget badha diya, darling!';
    }
    break;
   case 'specialHit':
    pass=e.pass;
    if(['throw','dhobi'].includes(e.kind))post('throw',true);
    else if(e.pass===1)post('hit',true);
    break;
   case 'roundEnd': post(e.knockout?'ko':'round',true);break;
   case 'matchEnd': post('finish',true);break;
  }
 }
 function place(node,point,minX,maxX,minY,maxY){
  screen.copy(point).project(camera);
  node.style.left=THREE.MathUtils.clamp((screen.x+1)*50,minX,maxX)+'%';
  node.style.top=THREE.MathUtils.clamp((1-screen.y)*50,minY,maxY)+'%';
 }
 function update(match,views,driver,paused){
  if(!match){feed.hidden=true;for(const node of bubbles)node.hidden=true;return;}
  tick=match.tick/60;
  const active=['fight','special','knockout','roundEnd','over'].includes(match.phase);
  feed.hidden=!active||!lines[0].textContent||paused;
  const special=match.special;
  const show=!!special&&!!attackerLines[special.kind]&&!paused;
  bubbles.forEach(bubble=>{bubble.hidden=!show;});
  if(!show){superKind=null;return;}
  if(superKind!==special.kind){superKind=special.kind;pass=special.hits;}
  const {owner,target,kind}=special;
  const ownerView=kind==='safari'&&driver?.root.visible?driver:views[owner];
  const targetView=views[target];
  const ownerPoint=ownerView.bones.head.bone.getWorldPosition(new THREE.Vector3());
  const targetPoint=targetView.bones.head.bone.getWorldPosition(new THREE.Vector3());
  ownerPoint.y+=.26;targetPoint.y+=.28;
  const ownerLeft=ownerPoint.x<=targetPoint.x;
  bubbles[0].textContent=attackerLines[kind][pass>0?1:0];
  const opponent=match.fighters[target].kind;
  bubbles[1].textContent=pass>0?hurtLines[opponent][(pass-1)%2]:opponent==='spin'?incoming.spin:incoming[kind];
  place(bubbles[0],ownerPoint,ownerLeft?14:57,ownerLeft?43:86,25,69);
  place(bubbles[1],targetPoint,ownerLeft?57:14,ownerLeft?86:43,25,71);
 }
 function reset(){
  tick=0;lastFeed=-Infinity;superKind=null;pass=0;
  lines.forEach(line=>line.textContent='');
  for(const node of [feed,...bubbles])node.hidden=true;
 }
 return {event,update,reset};
}
