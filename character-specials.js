import {resolveAsset} from './media-config.js?v=mobile18';
import * as THREE from 'three';
import {SPECIALS,specialLanding} from './combat.js?v=editor17';

const {smoothstep,lerp,clamp}=THREE.MathUtils;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const travel=(t,start,end)=>clamp((t-start)/(end-start),0,1);

export function createCharacterSpecials(scene,{pose,solveArm,setFists,resetPose,landingPose}){
 const steel=new THREE.MeshStandardMaterial({color:0xc4aa72,metalness:.74,roughness:.29});
 const dark=new THREE.MeshStandardMaterial({color:0x242623,metalness:.38,roughness:.46});
 const wood=new THREE.MeshStandardMaterial({color:0x633720,roughness:.63});
 const orange=new THREE.MeshBasicMaterial({color:0xffb33a});
 const hot=new THREE.MeshBasicMaterial({color:0xffffc7});

 // A rounded brass lota with a neck and rolled rim.
 const lota=new THREE.Mesh(new THREE.LatheGeometry([
  [0,-.102],[.071,-.101],[.105,-.083],[.134,-.038],[.139,.006],[.128,.042],
  [.100,.072],[.060,.087],[.053,.109],[.077,.118],[.080,.131],[.061,.132],
  [.048,.117],[.046,.091],[.046,.073]
 ].map(([r,y])=>new THREE.Vector2(r,y)),32),steel);
 lota.castShadow=true;

 // Stylized AK-style arcade prop, aimed along local +Z.
 const rifle=new THREE.Group();
 function box(x,y,z,w,h,l,material,tilt=0){
  const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),material);
  part.position.set(x,y,z);
  part.rotation.x=tilt;
  rifle.add(part);
  return part;
 }
 function barrel(z,length,radius){
  const part=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),dark);
  part.rotation.x=Math.PI/2;
  part.position.z=z;
  rifle.add(part);
 }
 box(0,0,.015,.074,.082,.34,dark);
 box(0,-.011,-.283,.067,.091,.25,wood,-.11);
 box(0,0,.247,.068,.071,.17,wood);
 box(0,-.079,-.082,.044,.113,.046,wood,-.36);
 box(0,-.087,.101,.058,.127,.075,dark,.21);
 box(0,-.167,.133,.058,.074,.075,dark,.50);
 box(0,.053,.31,.026,.074,.032,dark);
 barrel(.43,.24,.014);
 barrel(.565,.054,.022);
 const flash=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),hot);
 flash.position.z=.62;
 rifle.add(flash);
 const tracer=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,1,6),orange);
 tracer.rotation.z=Math.PI/2;

 const packetTexture=new THREE.TextureLoader().load(resolveAsset('./assets/vimal-packet.webp'));
 packetTexture.colorSpace=THREE.SRGBColorSpace;
 const packetFace=new THREE.MeshBasicMaterial({map:packetTexture});
 const packet=new THREE.Mesh(new THREE.BoxGeometry(.10,.126,.015),
   [orange,orange,orange,orange,packetFace,packetFace]);
 const flecks=Array.from({length:22},(_,i)=>new THREE.Mesh(
  new THREE.IcosahedronGeometry(.038+(i%3)*.009,0),
  new THREE.MeshBasicMaterial({color:i%3?0xe34117:0xffad2b,transparent:true,depthWrite:false})
 ));
 const spear=new THREE.Group();
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.023,.026,1.45,10),wood);
 shaft.rotation.x=Math.PI/2;
 shaft.position.z=.24;
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.072,.32,4),steel);
 tip.rotation.x=Math.PI/2;
 tip.position.z=1.06;
 spear.add(shaft,tip);
 const props=[lota,rifle,tracer,packet,spear,...flecks];
 for(const prop of props){prop.visible=false;scene.add(prop);}
 const reset=()=>{for(const prop of props)prop.visible=false;};

 function stage(s,owner,victim){
  const approach=smoothstep(s.time,0,.60);
  const yaw=s.facing*Math.PI/2;
  const origin=s.center-s.facing*.42;
  const target=s.center+s.facing*.66;
  owner.root.position.set(lerp(s.ownerX,origin,approach),.06,0);
  owner.root.rotation.set(0,yaw,0);
  victim.root.position.set(lerp(s.targetX,target,approach),.06,0);
  victim.root.rotation.set(0,-yaw,0);
  resetPose(owner);
  resetPose(victim);
  return {origin,target,yaw};
 }
 function gesture(view,left,right){
  view.root.updateMatrixWorld(true);
  solveArm(view,'L',v(...left));
  solveArm(view,'R',v(...right));
 }
 function stagger(victim,time,strength=.24){
  pose(victim,'chest',-.43*time,0,strength*time,1);
  pose(victim,'head',-.23*time,0,-strength*time,1);
  pose(victim,'upper_arm.L',-.45*time,0,-.44*time);
  pose(victim,'upper_arm.R',-.33*time,0,.44*time);
 }
 function slap(s,owner,victim,{origin,target,yaw}){
  const t=s.time,[slapAt,hitAt]=SPECIALS.slap.impacts;
  const wind=smoothstep(t,.22,.65);
  const swing=smoothstep(t,.65,slapAt+.09);
  const draw=smoothstep(t,1.13,1.70);
  const release=hitAt-.36;
  const toss=smoothstep(t,1.77,release);
  const recover=smoothstep(t,release,2.70);
  const left=[lerp(.39,.13,draw),1.47,.25];
  const right=t<1.20
   ?[lerp(-.23,lerp(-.52,.38,swing),wind),1.45+.26*wind-.025*swing,.19+.46*swing]
   :[lerp(-.39,-.18,toss),lerp(1.11,1.84,draw)-.30*toss-.17*recover,.19+.48*toss];
  pose(owner,'chest',.11*toss,lerp(-.42,.36,swing)*wind*(1-draw),0,1);
  gesture(owner,left,right);
  setFists(owner,t<1.20?0:.58);
  const flinch=Math.max(0,1-(t-slapAt)/.38)*Number(t>=slapAt);
  stagger(victim,flinch);
  const close=smoothstep(t,.15,.70)*(1-smoothstep(t,slapAt,1.48));
  victim.root.position.x+=s.facing*(.16*flinch-.36*close);
  lota.visible=t>=1.22&&t<hitAt+.45;
  if(lota.visible){
   if(t<release)lota.position.copy(owner.bones['hand.R'].bone.getWorldPosition(v(0,0,0))).add(v(0,.045,0));
   else{
    const a=travel(t,release,hitAt), rebound=travel(t,hitAt,hitAt+.42);
    lota.position.set(lerp(origin+s.facing*.50,target,a)+s.facing*.32*rebound,
     lerp(1.58,1.29,a)+.31*Math.sin(Math.PI*a)-.94*rebound,0);
   }
   lota.rotation.set(t*9,yaw,t*3);
  }
  if(t>=hitAt)landingPose(victim,{...s,launchAt:hitAt},target,.06,0,.76,.56);
 }
 function burst(s,owner,victim,{target,yaw}){
  const t=s.time, times=SPECIALS.burst.impacts;
  const aim=smoothstep(t,.17,.87)*(1-smoothstep(t,2.36,3.15));
  const latest=times.filter(hit=>hit<=t).at(-1)??-1;
  const kick=clamp(1-(t-latest)/.14,0,1);
  pose(owner,'chest',-.13*aim-.12*kick,0,-.10*aim,1);
  gesture(owner,[.20,1.29+.13*aim,.28+.30*aim],[-.19,1.26+.15*aim,.22+.16*aim]);
  rifle.visible=t>=.18&&t<3.09;
  rifle.position.copy(owner.root.localToWorld(v(0,1.12+.25*aim,.24-.045*kick)));
  rifle.rotation.set(-.18*(1-aim)-.11*kick,yaw,0);
  flash.visible=kick>.52;
  flash.scale.set(.11*kick,.11*kick,.23*kick);
  tracer.visible=kick>.64;
  const muzzle=rifle.localToWorld(v(0,0,.59));
  const span=target-muzzle.x;
  tracer.position.set(muzzle.x+span*.5,muzzle.y,.012);
  tracer.scale.y=Math.max(.03,Math.abs(span));
  stagger(victim,kick,.30);
  victim.root.position.x+=s.facing*.075*kick;
  if(t>=times.at(-1))landingPose(victim,{...s,launchAt:times.at(-1)},target,.06,0,.72,.47);
 }
 function spit(s,owner,victim,{target,yaw}){
  const t=s.time, hitAt=SPECIALS.spit.impacts[0];
  const raise=smoothstep(t,.32,.99);
  const lower=smoothstep(t,1.30,1.67);
  const eat=raise*(1-lower);
  const chew=smoothstep(t,1.10,1.34)*(1-smoothstep(t,1.65,1.97));
  const lean=smoothstep(t,1.64,2.04)*(1-smoothstep(t,2.23,2.62));
  pose(owner,'head',-.19*eat+.32*lean+Math.sin(t*34)*.033*chew,0,0,1);
  pose(owner,'chest',.29*lean,0,0,1);
  owner.root.updateMatrixWorld(true);
  const head=owner.bones.head.bone;
  const mouth=head.localToWorld(owner.mouthLocal.clone());
  const lift=v(-.29,1.29,.37).lerp(owner.root.worldToLocal(mouth.clone()).add(v(-.075,-.09,.05)),eat);
  gesture(owner,[.23,1.36,.27],lift.toArray());
  setFists(owner,.33);
  packet.visible=t>=.17&&t<=1.38;
  const hand=owner.bones['hand.R'].bone.getWorldPosition(v(0,0,0));
  packet.position.copy(hand).add(v(0,.065,.065)).lerp(mouth.clone().add(v(.023*s.facing,-.058,.027)),eat*.82);
  packet.rotation.set(-.15-1.12*eat,.21*s.facing,-.18*s.facing);
  for(const [i,drop] of flecks.entries()){
   const age=(t-(hitAt-.25)-i*.010)/.40;
   drop.visible=age>=0&&age<1;
   if(!drop.visible)continue;
   drop.position.set(lerp(mouth.x,target+.20*s.facing,age),mouth.y-.46*age+Math.sin(i*1.62)*age*.21,
    mouth.z+Math.cos(i*1.68)*age*.23);
   drop.material.opacity=1-age*.83;
  }
  if(t>=hitAt)landingPose(victim,s,target,.06,0,.62,.52);
 }
 function dhobiThrow(s,owner,victim){
  const t=s.time,release=SPECIALS.throw.impacts[0],dir=s.facing;
  const yaw=dir*Math.PI/2, origin=s.center-dir*.42;
  const close=smoothstep(t,0,.22), load=smoothstep(t,.17,.40);
  const lift=smoothstep(t,.32,.63), recover=smoothstep(t,release,1.39);
  const hold=1-recover;
  resetPose(owner);
  resetPose(victim);
  owner.root.position.set(lerp(s.ownerX,origin,close),.06-.22*load*(1-lift)*hold,0);
  owner.root.rotation.set(0,yaw-dir*.84*load*hold,0);
  pose(owner,'chest',(.40*load*(1-lift)+.12*lift)*hold,-dir*.23*load*hold,.07*hold,1);
  for(const side of ['L','R']){
   pose(owner,'thigh.'+side,-.65*load*(1-lift)*hold,0,0,1);
   pose(owner,'shin.'+side,1.04*load*(1-lift)*hold,0,0,1);
  }
  const wristLock=s.signature==='spit';
  const shoulderThrow=s.signature==='spin';
  const pivot=v(0,1,0);
  const rollAxis=v(0,0,1);
  const carryProgress=Math.min(t,release);
  const grab=smoothstep(carryProgress,0,.22);
  const raised=smoothstep(carryProgress,.32,.63);
  if(shoulderThrow)owner.root.rotation.y-=dir*raised*1.22;
  const toss=smoothstep(carryProgress,.72,release);
  victim.root.position.set(0,0,0);
  victim.root.quaternion.setFromAxisAngle(pivot,-yaw);
  victim.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(rollAxis,
   -dir*((wristLock?.95:shoulderThrow?2.16:1.55)*raised+.38*toss)));
  victim.root.updateMatrixWorld(true);
  const hip=victim.bones.pelvis.bone.getWorldPosition(v(0,0,0));
  const anchor=v(lerp(s.targetX,origin+dir*(.59-.33*raised+.44*toss),grab),
   hip.length()+(wristLock?.44:.80)*raised+.06,-.14*raised);
  victim.root.position.copy(anchor.sub(hip));
  victim.root.updateMatrixWorld(true);
  if(t<release){
   const grip=side=>owner.root.worldToLocal(victim.bones[side].bone.getWorldPosition(v(0,0,0))).toArray();
   gesture(owner,grip(shoulderThrow?'upper_arm.L':'pelvis'),grip(wristLock?'hand.R':'upper_arm.R'));
   pose(victim,'thigh.L',-.38*raised,0,0,1);
   pose(victim,'shin.R',.72*raised,0,0,1);
   setFists(owner,.34);
  }else{
   const start=victim.root.position.clone(),rotation=victim.root.quaternion.clone();
   gesture(owner,[.22,1.58,.48*hold+.18],[-.21,1.47,.50*hold+.18]);
   landingPose(victim,s,start.x,start.y,start.z,.49,.36,rotation);
  }
 }
 function doubleSlam(s,owner,victim){
  const {time:t,facing:dir,center}=s;
  const [first,second]=SPECIALS.dhobi.impacts;
  const {yaw}=stage(s,owner,victim);
  const grab=smoothstep(t,0,.24);
  const firstArc=smoothstep(t,.24,first);
  const returnArc=smoothstep(t,first+.08,second);
  const recovery=smoothstep(t,second,1.84);
  const swing=firstArc-2*returnArc;
  const lift=.94*Math.sin(Math.PI*firstArc)+1.23*Math.sin(Math.PI*returnArc);
  const ground=Math.max(firstArc,returnArc);
  owner.root.rotation.y=yaw-dir*.83*swing;
  pose(owner,'chest',.3*ground*(1-recovery),0,dir*.18*swing*(1-recovery),1);
  victim.root.rotation.set(-Math.PI/2*ground,-yaw,0,'YXZ');
  victim.root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(v(0,0,1),-dir*.95*swing));
  victim.root.position.set(0,0,0);
  victim.root.updateMatrixWorld(true);
  const shoulder=victim.bones['upper_arm.R'].bone.getWorldPosition(v(0,0,0));
  const gripX=lerp(s.targetX,center+dir*(.22+.64*swing),grab);
  const gripY=lerp(1.48,.27+lift+.77*(1-ground),grab);
  victim.root.position.copy(v(gripX,gripY,-.1).sub(shoulder));
  victim.root.updateMatrixWorld(true);
  const grip=owner.root.worldToLocal(victim.bones['upper_arm.R'].bone.getWorldPosition(v(0,0,0)));
  gesture(owner,[.32,1.32,.16],grip.lerp(v(-.25,1.39,.29),recovery).toArray());
  setFists(owner,.78);
  if(t>=second){
   const travel=smoothstep(t,second,1.7);
   victim.root.position.lerp(v(specialLanding(s),.16,0),travel);
   victim.root.rotation.set(-Math.PI/2,-yaw,0,'YXZ');
  }
 }
 function signatureStrike(s,owner,victim,positions){
  const t=s.time,hit=SPECIALS.signature.impacts[0],dir=s.facing;
  const {origin,target,yaw}=positions;
  const prep=smoothstep(t,.02,.32), drive=smoothstep(t,.33,hit);
  const recover=smoothstep(t,hit,1.19), follow=1-recover;
  const stunt=s.signature==='blast';
  const knee=s.signature==='safari';
  owner.root.position.x=origin+dir*drive*.28*follow;
  if(stunt){
   owner.root.position.y+=Math.sin(Math.PI*drive)*.52;
   owner.root.rotation.y=yaw+dir*drive*Math.PI*2;
   pose(owner,'thigh.R',-(.84*prep+.76*drive)*follow,.47*drive*follow,.22*follow,1);
   pose(owner,'shin.R',1.30*prep*(1-drive)*follow,0,0,1);
   pose(owner,'thigh.L',-.68*prep*follow,0,0,1);
   pose(owner,'shin.L',.95*prep*follow,0,0,1);
   gesture(owner,[.40,1.45,.18],[-.36,1.46,.14]);
  }else if(knee){
   pose(owner,'thigh.R',-(.49*prep+1.21*drive)*follow,0,0,1);
   pose(owner,'shin.R',1.76*drive*follow,0,0,1);
   pose(owner,'chest',.23*prep*follow,0,0,1);
   gesture(owner,[.15,1.64,.49],[-.15,1.64,.49]);
  }else{
   pose(owner,'chest',.24*drive*follow,-dir*.76*drive*follow,.15*follow,1);
   pose(owner,'pelvis',.10*prep,-dir*.31*drive*follow,0,1);
   gesture(owner,[.18,1.28,.41],[-.10,1.25,.19+.37*drive]);
   const hand=owner.bones['hand.R'].bone.getWorldPosition(v(0,0,0));
   spear.visible=t>.13&&t<1.20;
   spear.position.copy(hand);
   spear.rotation.set(.1*(1-drive),yaw,0);
  }
  if(t>=hit)landingPose(victim,s,target,.06,0,.40,.35);
 }
 const actions={slap,burst,spit};
 return {
  reset,
  animate(s,owner,victim){
   reset();
   if(s.kind==='dhobi')doubleSlam(s,owner,victim);
   else if(s.kind==='throw')dhobiThrow(s,owner,victim);
   else if(s.kind==='signature')signatureStrike(s,owner,victim,stage(s,owner,victim));
   else actions[s.kind](s,owner,victim,stage(s,owner,victim));
  },
 };
}









