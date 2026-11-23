import {resolveAsset} from './media-config.js?v=editor17';
import * as THREE from 'three';
import {createEntranceProps} from './entrance-props.js?v=editor17';

const {lerp,smoothstep}=THREE.MathUtils;
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const labels={
 safari:['Radhe','Tiger ki dahad'], blast:['Whistle Baja','Ab dekho footwork'],
 spin:['Jhoome Jo Pathaan','Don ki entry'], spit:['Singham','Vimal Man ki entry'],
 burst:['Khal Nayak','Bawa ka andaaz'], slap:['Babu Rao Mast Hai','Baburao ka dance'],
};

export function createFighterPresentations(scene,{pose,solveArm,setFists,resetPose,tone,audioMixer}){
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.78});
 const hot=new THREE.MeshBasicMaterial({color:0xff8529});
 const {deer,pistol,flash,poseDeer}=createEntranceProps();
 const cigarette=new THREE.Group();
 function part(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(x,y,z);
  mesh.scale.set(sx,sy,sz);
  parent.add(mesh);
  return mesh;
 }
 const sphere=new THREE.IcosahedronGeometry(1,1);
 part(cigarette,new THREE.CylinderGeometry(.012,.012,.13,8),material(0xe3dbba),0,0,.065).rotation.x=Math.PI/2;
 part(cigarette,sphere,hot,0,0,.135,.014,.014,.014);
 const smoke=Array.from({length:4},()=>part(scene,sphere,new THREE.MeshBasicMaterial({
  color:0xb1b7bf,transparent:true,depthWrite:false
 }),0,0,0));
 const map=new THREE.TextureLoader().load(resolveAsset('./assets/vimal-packet.webp'));
 map.colorSpace=THREE.SRGBColorSpace;
 const face=new THREE.MeshBasicMaterial({map});
 const packet=part(scene,new THREE.BoxGeometry(.096,.123,.014),[hot,hot,hot,hot,face,face],0,0,0);
 scene.add(deer,pistol,cigarette);
 const pockets=[1,-1].map(sign=>{
  const edge=new THREE.QuadraticBezierCurve3(v(sign*.157,1.007,.128),v(sign*.199,1.002,.123),v(sign*.237,1.027,.087));
  return part(scene,new THREE.TubeGeometry(edge,14,.004,6,false),material(0x635e53),0,0,0);
 });
 const props=[deer,pistol,cigarette,packet,...smoke,...pockets];
 let active=null, playedShot=false, activeCar=null, activeDoor=null;
 const wheelRest=new WeakMap();
 const hide=()=>{for(const prop of props)prop.visible=false;};
 hide();
 function stop(){
  audioMixer.stopTrack('entrance');
  active=null;
  hide();
  if(activeCar)activeCar.visible=false;
  activeCar=null;
  if(activeDoor)activeDoor.node.quaternion.copy(activeDoor.rest);
  activeDoor=null;
 }
 function sync(paused,sound){
  if(!active||paused||!sound){audioMixer.stopTrack('entrance');return;}
  if(!audioMixer.isTrackActive('entrance'))audioMixer.playTrack('./assets/entry-'+active.kind+'.mp3',{channel:'entrance',offset:active.time,volume:.8});
 }
 function arms(view,left,right,fist=0,straighten=0){
  view.root.updateMatrixWorld(true);
  solveArm(view,'L',v(...left),straighten);
  solveArm(view,'R',v(...right),straighten);
  setFists(view,fist);
 }
 function footwork(view,beat,amount,spread=0){
  for(const [side,sign] of [['L',1],['R',-1]]){
   const swing=sign*beat;
   pose(view,'thigh.'+side,-swing*.47*amount,0,sign*spread,1);
   pose(view,'shin.'+side,Math.max(0,swing)*.63*amount,0,0,1);
  }
 }
 function walk(view,t,x,amount,pace){
  const beat=Math.sin(t*pace);
  view.root.position.x=x;
  view.root.position.y+=Math.abs(beat)*.045*amount;
  pose(view,'pelvis',0,.14*beat,0,1);
  pose(view,'chest',.05,-.18*beat,.035*beat,1);
  footwork(view,beat,amount,.04);
 }
 function phrase(time,keys){
  let next=keys.findIndex(key=>key[0]>time);
  if(next===-1)return keys.at(-1).slice(1);
  if(next===0)return keys[0].slice(1);
  const [start,...from]=keys[next-1], [end,...to]=keys[next];
  const mix=smoothstep(time,start,end);
  return from.map((value,index)=>lerp(value,to[index],mix));
 }
 function groundFeet(view){
  view.root.updateMatrixWorld(true);
  const sole=Math.min(...['L','R'].map(side=>
   view.bones['foot.'+side].bone.getWorldPosition(v(0,0,0)).y-view.footHeight[side]));
  view.root.position.y+=.065-sole;
 }
 function tiger(view,t,winning){
  const first=t<1.70, start=first?.47:2.02, end=first?1.37:2.92;
  const phase=THREE.MathUtils.clamp((t-start)/(end-start),0,1);
  if(phase>0&&phase<1){
   const tuck=smoothstep(phase,.04,.34)*(1-smoothstep(phase,.68,.96));
   const turn=smoothstep(phase,.035,.965);
   const direction=(first?1:-1)*(winning?-1:1);
   const pelvis=view.bones.pelvis.bone;
   view.root.updateMatrixWorld(true);
   const pivot=view.root.worldToLocal(pelvis.getWorldPosition(v(0,0,0)));
   const height=4*phase*(1-phase);
   view.root.rotation.set(0,1.04,0);
   const axis=v(1,0,0);
   view.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,direction*turn*Math.PI*2));
   const position=first?lerp(-.84,.33,phase):lerp(.33,-.12,phase);
   view.root.position.set(position,.065+1.28*height,first?lerp(.05,.66,phase):lerp(.66,.39,phase));
   view.root.position.add(pivot).sub(pivot.clone().applyQuaternion(view.root.quaternion));
   for(const side of ['L','R']){
    pose(view,'thigh.'+side,-1.79*tuck,0,0,1);
    pose(view,'shin.'+side,2.03*tuck,0,0,1);
    pose(view,'foot.'+side,-.27*tuck,0,0,1);
   }
   pose(view,'chest',.34*tuck,0,0,1);
   arms(view,[.21,1.95-.74*tuck,.26+.12*tuck],[-.21,1.95-.74*tuck,.26+.12*tuck],.15);
   view.root.updateMatrixWorld(true);
   const supports=[['head',.29],['hand.L',.16],['hand.R',.16],['foot.L',.12],['foot.R',.12],['toe.L',.065],['toe.R',.065],['shin.L',.10],['shin.R',.10]];
   const clearance=Math.min(...supports.map(([bone,radius])=>view.bones[bone].bone.getWorldPosition(v(0,0,0)).y-radius));
   view.root.position.y+=Math.max(0,.075-clearance);
   return;
  }
  if(t<3.19){
   const load=Math.max(
    smoothstep(t,.05,.30)*(1-smoothstep(t,.31,.47)),
    smoothstep(t,1.37,1.47)*(1-smoothstep(t,1.50,1.66)),
    smoothstep(t,1.70,1.88)*(1-smoothstep(t,1.9,2.02)),
    smoothstep(t,2.92,3.01)*(1-smoothstep(t,3.03,3.19))
   );
   view.root.rotation.y=1.04;
   view.root.position.x=t<.47?-.84:t<2.02?.33:-.12;
   view.root.position.z=t<.47?.05:t<2.02?.66:.39;
   for(const side of ['L','R']){
    pose(view,'thigh.'+side,-.72*load,0,0,1);
    pose(view,'shin.'+side,1.27*load,0,0,1);
   }
   pose(view,'chest',.32*load,0,0,1);
   arms(view,[.29,1.88-.65*load,.20-.34*load],[-.29,1.88-.65*load,.20-.34*load],.1);
   groundFeet(view);
   return;
  }
  const [x,turn,step,lift,drop,lx,ly,lz,rx,ry,rz]=phrase((t-3.19)%1.65,[
   [0,-.12,.22,0,0,.28,1.65,.39,-.30,1.37,.40],
   [.32,.28,-.33,.70,.20,.64,1.57,.20,-.05,1.37,.55],
   [.66,.49,-.16,-.30,.38,.13,1.34,.52,-.67,1.28,.12],
   [1.01,-.19,.48,-.74,.14,.59,1.71,.18,-.19,1.26,.58],
   [1.29,-.47,.08,.43,.35,.10,1.22,.56,-.58,1.61,.19],
   [1.65,-.12,.22,0,0,.28,1.65,.39,-.30,1.37,.40]
  ]);
  view.root.position.x=x;
  view.root.rotation.y=turn;
  footwork(view,lift,1,.19);
  pose(view,'chest',drop,step,step*.46,1);
  arms(view,[lx,ly,lz],[rx,ry,rz],.15);
  groundFeet(view);
 }
 function jon(view,t){
  const [x,yaw,knee,lx,ly,lz,rx,ry,rz]=phrase(t,[
   [0,-.58,.65,0,.32,1.32,.20,-.30,1.27,.20],
   [.55,-.38,.83,-.55,.26,1.70,.48,-.29,1.29,.37],
   [1.02,-.10,.61,.60,.27,1.38,.54,-.25,1.72,.42],
   [1.49,.18,.38,-.65,.29,1.76,.43,-.15,1.29,.49],
   [1.96,.52,.18,.56,.64,1.43,.34,-.16,1.60,.45],
   [2.44,.32,-.25,-.66,.18,1.43,.49,-.68,1.50,.25],
   [2.91,-.14,.23,.69,.67,1.49,.29,-.19,1.36,.49],
   [3.37,-.43,.27,-.62,.16,1.35,.47,-.64,1.53,.25],
   [3.84,-.16,.07,.65,.49,1.42,.36,-.17,1.66,.43],
   [4.33,.10,-.12,-.44,.64,1.55,.29,-.52,1.47,.24],
   [4.85,.04,0,0,.74,1.48,.18,-.74,1.48,.18],
   [5.5,0,0,0,.65,1.41,.20,-.65,1.41,.20]
  ]);
  view.root.position.x=x;
  view.root.rotation.y=yaw;
  pose(view,'chest',.04,-yaw*.36,knee*.13,1);
  pose(view,'head',-.06,-yaw*.38,0,1);
  footwork(view,knee,1,.13);
  arms(view,[lx,ly,lz],[rx,ry,rz],0,.54);
  groundFeet(view);
 }
 function vimal(view,t){
  const danceTime=t<2.76?t*1.13:t+.36*(1-smoothstep(t,2.76,3.25));
  const [sway,stance,lx,ly,lz,rx,ry,rz]=phrase(danceTime,[
   [0,0,.07,.24,1.13,.20,-.24,1.15,.22],
   [.44,-.23,.38,-.15,1.43,.51,-.43,1.78,.42],
   [.91,.24,-.43,-.17,1.40,.51,.09,1.71,.54],
   [1.36,-.24,.46,-.13,1.43,.52,-.44,1.81,.46],
   [1.83,.23,-.44,-.16,1.42,.51,.12,1.69,.55],
   [2.30,-.16,.38,-.12,1.43,.50,-.40,1.78,.47],
   [2.77,.16,-.30,-.17,1.39,.48,.03,1.67,.55],
   [3.16,0,0,.30,1.14,.28,-.31,1.13,.32],
   [3.6,0,0,.30,1.14,.28,-.32,1.35,.36],
   [4.3,0,0,.30,1.15,.28,-.29,1.39,.38],
   [4.88,-.06,0,.19,1.23,.34,-.27,1.48,.42],
   [5.5,0,0,.23,1.37,.35,-.24,1.41,.41]
  ]);
  const eat=smoothstep(t,3.49,3.98)*(1-smoothstep(t,4.42,4.85));
  view.root.rotation.y=sway;
  view.root.position.x=.19*stance;
  pose(view,'chest',.08+.15*eat,-sway*.73,.12*stance,1);
  pose(view,'head',-.31*eat,sway*.48,0,1);
  footwork(view,stance,.60,.10);
  groundFeet(view);
  view.root.updateMatrixWorld(true);
  const mouth=view.root.worldToLocal(view.bones.head.bone.localToWorld(view.mouthLocal.clone()));
  const right=v(rx,ry,rz).lerp(mouth.add(v(-.025,-.06,.055)),eat);
  arms(view,[lx,ly,lz],right.toArray(),lerp(.16,.65,eat),.72);
  packet.visible=t>=3.23&&t<4.87;
  packet.position.copy(view.bones['hand.R'].bone.getWorldPosition(v(0,0,0))).add(v(0,.045,.045));
  packet.rotation.set(-.35*eat,.13,.16);
 }
 function bawa(view,t,winning){
  const stride=smoothstep(t,0,winning?2.4:4.35);
  view.root.rotation.y=.38;
  walk(view,t,lerp(-2.3,0,stride),1-smoothstep(stride,.84,1),5.3);
  groundFeet(view);
  arms(view,[.197,1.035,.077],[-.197,1.035,.077],.45,.98);
  // The costume has a closed surface. Keep the wrists at the openings and
  // tuck the finger geometry under the cloth for the duration of this shot.
  for(const side of ['L','R']){
   const hand=view.bones['hand.'+side];
   hand.bone.scale.copy(hand.restScale).multiplyScalar(.12);
  }
  for(const pocket of pockets){
   pocket.visible=true;
   pocket.position.copy(view.root.position);
   pocket.quaternion.copy(view.root.quaternion);
  }
  view.root.updateMatrixWorld(true);
  const head=view.bones.head.bone;
  cigarette.visible=true;
  cigarette.position.copy(head.localToWorld(view.mouthLocal.clone()));
  cigarette.rotation.set(.24,.38,-.21);
  smoke.forEach((wisp,i)=>{
   const age=(t*.82+i*.24)%1;
   wisp.visible=true;
   wisp.position.copy(cigarette.position).add(v(.05+age*.18,.10+age*.43,.10));
   wisp.scale.setScalar(.02+age*.057);
   wisp.material.opacity=(1-age)*.32;
  });
 }
 function babu(view,t){
  const beat=t%1.92;
  const [x,lean,knee,lx,ly,lz,rx,ry,rz]=phrase(beat,[
   [0,-.32,-.17,0,.43,1.33,.27,-.42,1.34,.24],
   [.34,-.45,-.23,.80,.36,1.46,.43,-.49,1.16,.21],
   [.70,-.21,.06,-.20,.12,1.94,.23,-.13,1.94,.25],
   [.96,.19,.17,-.68,.41,1.64,.34,-.41,1.47,.42],
   [1.29,.42,.30,-.86,.48,1.13,.22,-.28,1.53,.47],
   [1.61,.20,.02,.20,.13,1.87,.29,-.12,1.89,.26],
   [1.92,-.32,-.17,0,.43,1.33,.27,-.42,1.34,.24]
  ]);
  view.root.position.x=x;
  view.root.rotation.y=lean*1.2;
  footwork(view,knee,1.24,.20);
  pose(view,'chest',.12,0,-lean,1);
  pose(view,'head',-.12*Math.sin(t*10),lean,0,1);
  arms(view,[lx,ly,lz],[rx,ry,rz],.06,.32);
  groundFeet(view);
 }
 function deerFall(t){
  const fall=smoothstep(t,1.02,1.70);
  deer.visible=true;deer.rotation.set(fall*Math.PI/2,0,0);
  const pivot=v(0,.85,0),turned=pivot.clone().applyQuaternion(deer.quaternion);
  deer.position.copy(v(2.05,.06-.65*fall,-.07+.22*fall)).add(pivot).sub(turned);
  poseDeer(t,fall);
 }
 function safari(view,t,winning,car,driver,wheels,door){
  if(winning){
   walk(view,t,0,.38,6);
   arms(view,[.46,1.45,.25],[-.31,1.91,.40],.78);
   pose(view,'head',-.16,-.28,0,1);
   return;
  }
  if(t<2.03){
   view.root.position.x=-1.20;
   view.root.rotation.y=.86;
   const recoil=Math.sin(Math.PI*smoothstep(t,1.01,1.27));
   arms(view,[.10,1.44+.08*recoil,.58],[-.10,1.46+.16*recoil,.62-.11*recoil],.9);
   pistol.visible=true;
   pistol.scale.setScalar(.67);
   const palm=view.bones['hand.R'].bone.localToWorld(v(0,.065,0));
   const aim=v(2.05,.88,-.07).sub(palm).normalize();
   pistol.quaternion.setFromUnitVectors(v(0,0,1),aim);
   const grip=v(0,-.10,-.075).multiplyScalar(.67).applyQuaternion(pistol.quaternion);
   pistol.position.copy(palm).sub(grip);
   flash.visible=t>=1.01&&t<1.12;
   deerFall(t);
   if(t>=1.01&&!playedShot){playedShot=true;tone(110,.23,.19,-75);}
   return;
  }
  deerFall(t);
  const arrived=smoothstep(t,2.03,4.14);
  const dismount=smoothstep(t,4.67,5.34);
  const reverse=smoothstep(t,6.03,8.43);
  if(car){
   activeCar=car;
   car.visible=true;
   car.rotation.y=Math.PI;
   const distance=2.90*(arrived-reverse);
   car.position.set(0,.075,-3.4+distance);
   for(const wheel of wheels){
    if(!wheelRest.has(wheel))wheelRest.set(wheel,wheel.rotation.x);
    wheel.rotation.x=wheelRest.get(wheel)+distance/.35;
   }
   driver.root.visible=t<4.67;
   if(door){
    activeDoor=door;
    car.updateMatrixWorld(true);
    const hingeAxis=v(0,1,0).applyQuaternion(door.node.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    const open=smoothstep(t,4.19,4.61)*(1-smoothstep(t,5.36,5.92));
    const swing=new THREE.Quaternion().setFromAxisAngle(hingeAxis,1.05*open);
    door.node.quaternion.copy(door.rest).premultiply(swing);
   }
  }
  view.root.visible=!car||t>=4.67;
  const walkForward=smoothstep(t,5.86,7.32);
  const turnIn=smoothstep(t,7.23,8.10);
  const side=-1.25-.21*dismount;
  view.root.position.z=lerp(-.73,1.42,walkForward);
  view.root.rotation.y=lerp(-1.31,0,dismount)+.60*turnIn;
  walk(view,t,lerp(side,-.15,turnIn),Math.max(smoothstep(t,4.67,4.88)*(1-smoothstep(t,5.23,5.44)),smoothstep(t,5.86,6.06)*(1-smoothstep(t,7.87,8.16))),8);
  const seated=1-dismount;
  pose(view,'chest',.45*seated,0,-.18*seated,1);
  for(const limb of ['L','R']){
   if(seated>0){
    pose(view,'thigh.'+limb,-.58*seated,0,0,1);
    pose(view,'shin.'+limb,1.01*seated,0,0,1);
   }
  }
  groundFeet(view);
  arms(view,[.36,1.15,.17],[-.31,1.25+.39*smoothstep(t,7.42,8.21),.34],.84);
 }
 return {
  start(shot,paused,sound){
   stop();
   active=shot;
   playedShot=false;
   sync(paused,sound);
   return labels[shot.kind];
  },
  sync,stop,
  animate(shot,view,winning,car,driver,wheels,door){
   hide();
   resetPose(view);
   view.root.position.set(0,.06,0);
   view.root.rotation.set(0,-.10,0);
   const t=shot.time;
   switch(shot.kind){
    case 'safari': safari(view,t,winning,car,driver,wheels,door); break;
    case 'blast': tiger(view,t,winning); break;
    case 'spin': jon(view,t); break;
    case 'spit': vimal(view,t); break;
    case 'burst': bawa(view,t,winning); break;
    case 'slap': babu(view,t); break;
   }
  },
 };
}
