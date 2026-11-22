import * as THREE from 'three';

export function createEntranceProps(){
 const material=(color,roughness=.68,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const coat=material(0x955e39), belly=material(0xbc9064), fur=material(0xd9c7ab);
 const dark=material(0x27201b), antler=material(0x997b53), eye=material(0x15120f,.18);
 const steel=material(0x444950,.34,.78), polymer=material(0x202123,.83), black=material(0x101013);
 const deer=new THREE.Group(), pistol=new THREE.Group();
 const oval=new THREE.SphereGeometry(1,24,16);
 function mesh(parent,geometry,mat,x=0,y=0,z=0){
  const part=new THREE.Mesh(geometry,mat);
  part.position.set(x,y,z);
  part.castShadow=true;
  parent.add(part);
  return part;
 }
 function sculpt(parent,mat,x,y,z,width,height,depth,tilt=0){
  const part=mesh(parent,oval,mat,x,y,z);
  part.scale.set(width,height,depth);
  part.rotation.z=tilt;
  return part;
 }
 function limb(parent,mat,from,to,start,end){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),axis=b.clone().sub(a);
  const part=mesh(parent,new THREE.CylinderGeometry(end,start,axis.length(),12),mat);
  part.position.copy(a).lerp(b,.5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
 }
 // Continuous coat surface from shoulders to rump, with the belly and spots in vertex color.
 const profile=[
  [-.57,.89,.008,.01],[-.46,.88,.155,.12],[-.31,.88,.24,.19],
  [-.13,.87,.222,.181],[.10,.86,.192,.166],[.28,.86,.222,.192],
  [.41,.87,.201,.174],[.52,.90,.112,.095],[.56,.92,.004,.004]
 ];
 const spine=new THREE.CatmullRomCurve3(profile.map(([x,y,h])=>new THREE.Vector3(x,y,h)));
 const width=new THREE.CatmullRomCurve3(profile.map(([x,y,h,w])=>new THREE.Vector3(x,0,w)));
 const coatColor=new THREE.Color(0x925632), bellyColor=new THREE.Color(0xd3b087), spotColor=new THREE.Color(0xe5d1ae);
 const spots=Array.from({length:23},(_,i)=>[
  -.38+(i%8)*.11+(Math.floor(i/8)%2)*.049,
  .87+Math.floor(i/8)*.069+Math.sin(i*2.11)*.019,
  .018+(i%5)*.002
 ]);
 const points=[],colors=[],triangles=[];
 const rings=96,sides=56;
 for(let i=0;i<=rings;i++){
  const center=spine.getPoint(i/rings),depth=width.getPoint(i/rings).z;
  for(let j=0;j<=sides;j++){
   const angle=j/sides*Math.PI*2, dy=Math.cos(angle), dz=Math.sin(angle);
   const x=center.x,y=center.y+center.z*dy,z=depth*dz;
   points.push(x,y,z);
   const tint=coatColor.clone().lerp(bellyColor,THREE.MathUtils.smoothstep(-dy,.44,.93)*.84);
   tint.multiplyScalar(1+.035*Math.sin(x*169+y*223)*Math.cos(z*198-y*195)-.12*Math.max(0,dy));
   if(Math.abs(dz)>.62){
    for(const [sx,sy,r] of spots){
     const d=Math.hypot(x-sx,(y-sy)*1.20);
     if(d<r)tint.lerp(spotColor,1-THREE.MathUtils.smoothstep(d,r*.55,r));
    }
   }
   colors.push(tint.r,tint.g,tint.b);
   if(i>0&&j>0){
    const end=i*(sides+1)+j,prev=end-sides-1;
    triangles.push(prev-1,prev,end-1,prev,end,end-1);
   }
  }
 }
 const body=new THREE.BufferGeometry();
 body.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 body.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 body.setIndex(triangles);
 body.computeVertexNormals();
 mesh(deer,body,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87}));
 sculpt(deer,fur,.49,.86,0,.09,.143,.135,-.27);
 sculpt(deer,coat,.54,.965,0,.115,.052,.058,-.39);
 const neck=new THREE.Group();
 neck.position.set(-.36,.95,0);
 deer.add(neck);
 sculpt(neck,coat,-.086,.17,0,.153,.305,.12,.49);
 sculpt(neck,belly,-.163,.19,0,.089,.25,.077,.49);
 sculpt(neck,coat,-.224,.39,0,.179,.108,.11,.27);
 sculpt(neck,belly,-.346,.356,0,.103,.065,.079,.24);
 sculpt(neck,dark,-.418,.36,0,.041,.034,.064);
 for(const sign of [-1,1]){
  sculpt(neck,eye,-.25,.417,sign*.096,.027,.021,.012);
  const ear=sculpt(neck,coat,-.128,.495,sign*.13,.108,.043,.038,-.43);
  ear.rotation.y=sign*.65;
  const inner=sculpt(neck,fur,-.133,.5,sign*.147,.075,.024,.024,-.43);
  inner.rotation.y=sign*.65;
  const branch=[[ -.167,.461,sign*.061],[-.125,.59,sign*.10],[-.065,.705,sign*.16],[.031,.78,sign*.19],[.115,.863,sign*.195]];
  for(let i=1;i<branch.length;i++)limb(neck,antler,branch[i-1],branch[i],.022-.004*i,.018-.004*i);
  limb(neck,antler,branch[2],[-.14,.82,sign*.17],.011,.003);
  limb(neck,antler,branch[3],[.011,.907,sign*.18],.009,.002);
 }
 const legs=[];
 for(const side of [-1,1]){
  for(const rear of [false,true]){
   const leg=new THREE.Group();
   leg.position.set(rear?.34:-.34,.84,side*.13);
   deer.add(leg);
   sculpt(leg,coat,0,-.118,0,rear?.116:.083,.21,.078,rear?-.28:.10);
   const knee=rear?-.105:.015, hock=rear?.025:.005;
   limb(leg,coat,[0,-.17,0],[knee,-.41,0],.056,.037);
   limb(leg,belly,[knee,-.41,0],[hock,-.58,0],.036,.024);
   limb(leg,coat,[hock,-.58,0],[hock-.028,-.78,0],.027,.019);
   sculpt(leg,dark,hock-.05,-.802,0,.054,.031,.033);
   legs.push({leg,side,rear});
  }
 }
 function outline(points,width,mat,x=0){
  const shape=new THREE.Shape();
  points.forEach(([z,y],index)=>index?shape.lineTo(z,y):shape.moveTo(z,y));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:width,bevelSize:.006,bevelThickness:.004,bevelSegments:2,steps:1});
  geometry.rotateY(-Math.PI/2);
  return mesh(pistol,geometry,mat,x+width/2);
 }
 outline([[-.11,.046],[.233,.046],[.244,.026],[.226,-.025],[-.116,-.022],[-.13,.002]],.055,steel);
 outline([[-.12,-.025],[.17,-.025],[.15,-.055],[-.013,-.064],[-.049,-.164],[-.131,-.166],[-.146,-.143]],.048,polymer);
 outline([[-.039,-.051],[.104,-.050],[.097,-.106],[-.028,-.113],[-.038,-.094],[.069,-.090],[.074,-.068],[-.042,-.069]],.021,polymer);
 outline([[.024,-.058],[.041,-.060],[.034,-.080],[.018,-.089],[.011,-.084]],.010,steel);
 for(const side of [-1,1]){
  for(let i=0;i<6;i++){
   const groove=mesh(pistol,new THREE.BoxGeometry(.004,.037,.004),black,side*.029,.009,-.104+i*.010);
   groove.rotation.x=-.23;
  }
  mesh(pistol,new THREE.BoxGeometry(.004,.013,.062),black,side*.028,.023,.072);
 }
 for(const z of [-.104,.201])mesh(pistol,new THREE.BoxGeometry(.025,.017,.019),black,0,.055,z);
 const bore=mesh(pistol,new THREE.CylinderGeometry(.015,.015,.008,20),black,0,.011,.246);
 bore.rotation.x=Math.PI/2;
 const flash=mesh(pistol,new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffd27c}),0,.011,.34);
 flash.scale.set(.047,.05,.12);

 return {deer,pistol,flash,poseDeer(time,fall){
  neck.rotation.z=.08*Math.sin(time*4)*(1-fall)-.22*fall;
  for(const {leg,side,rear} of legs){
   const reaction=Math.sin(Math.PI*fall);
   leg.rotation.z=(rear?-1:1)*side*(.018*Math.sin(time*5)+reaction*.42)+fall*(rear?.28:-.34);
  }
 }};
}
