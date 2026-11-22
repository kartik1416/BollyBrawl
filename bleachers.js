import * as THREE from 'three';

// Seat coordinates are measured from the FBX after its Y-up GLB conversion.
const rows=[[.554,.58],[.948,.20],[1.343,-.18],[1.738,-.56]];
const shirts=[0x963c39,0x346485,0xbb8a46,0x2c706a,0x654e79,0x7d8c59,0x40465a];
const skin=[0xae6a49,0xc68860,0x8f5239,0xd19a74,0x734333];
const scale=.78;

export function createBleachers(scene,source){
 const people=[];
 for(const sign of [-1,1]){
  const stand=source.clone(true);
  stand.position.set(sign*3.62,.09,-1.25);
  stand.rotation.y=-sign*.28;
  stand.scale.setScalar(scale);
  stand.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
  scene.add(stand);
  stand.updateMatrixWorld(true);
  rows.forEach(([y,z],row)=>{
   for(let i=0;i<7;i++){
    if((i+row*3+(sign>0?2:0))%9===0)continue;
    const index=people.length;
    const seat=stand.localToWorld(new THREE.Vector3(-1.71+i*.57,y,z+.02));
    people.push({seat,yaw:stand.rotation.y,phase:index*2.399,shirt:shirts[index%shirts.length],skin:skin[index%skin.length],size:.86+(index%5)*.055});
   }
  });
 }
 const material=new THREE.MeshStandardMaterial({roughness:.83});
 function batch(geometry,count){
  const mesh=new THREE.InstancedMesh(geometry,material,count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled=false;
  scene.add(mesh);
  return mesh;
 }
 const body=batch(new THREE.CapsuleGeometry(.10,.19,3,7),people.length);
 const head=batch(new THREE.SphereGeometry(.091,9,7),people.length);
 const hair=batch(new THREE.SphereGeometry(.086,8,6),people.length);
 const legs=batch(new THREE.CapsuleGeometry(.046,.13,2,6),people.length*4);
 const arms=batch(new THREE.CapsuleGeometry(.035,.125,2,6),people.length*4);
 const dummy=new THREE.Object3D(), color=new THREE.Color(), up=new THREE.Vector3(0,1,0);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3();
 function transform(person,x,y,z,target){
  const sin=Math.sin(person.yaw),cos=Math.cos(person.yaw),k=person.size;
  return target.set((x*cos+z*sin)*k+person.seat.x,y*k+person.seat.y,(-x*sin+z*cos)*k+person.seat.z);
 }
 function segment(mesh,index,p,from,to,baseLength){
  transform(p,...from,a);transform(p,...to,b);
  dummy.position.copy(a).lerp(b,.5);
  axis.subVectors(b,a);
  dummy.quaternion.setFromUnitVectors(up,axis.clone().normalize());
  dummy.scale.set(p.size,axis.length()/baseLength,p.size);
  dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
 }
 function place(mesh,index,p,x,y,z,sx,sy,sz,tilt=0){
  transform(p,x,y,z,dummy.position);
  dummy.rotation.set(tilt,p.yaw,0);
  dummy.scale.set(sx*p.size,sy*p.size,sz*p.size);
  dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
 }
 function tint(mesh,i,hex){mesh.setColorAt(i,color.setHex(hex));}
 people.forEach((p,i)=>{
  tint(body,i,p.shirt);tint(head,i,p.skin);tint(hair,i,0x281c18);
  for(let j=0;j<4;j++){tint(legs,i*4+j,0x292b35);tint(arms,i*4+j,j%2===0?p.shirt:p.skin);}
  for(const [side,k] of [[-1,0],[1,2]]){
   segment(legs,i*4+k,p,[side*.066,.055,0],[side*.077,.017,.21],.20);
   segment(legs,i*4+k+1,p,[side*.077,.017,.20],[side*.080,-.25,.23],.23);
  }
 });
 legs.instanceMatrix.needsUpdate=true;
 const bannerLines=['TIGER KI DAHAAD!','DON KA COMBO!','THOKO TAALI!','BHAI, GUARD UP!','KYA KICK HAI!','BABURAO OP!'];
 const banners=new Map();
 const fontReady=document.fonts.load('700 46px "Brawl"');
 for(const index of [8,18,32,43]){
  const person=people[index];
  if(!person)continue;
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=256;
  const ink=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.BoxGeometry(.86,.25,.023),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));
  const group=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:0x996c3f,roughness:.9});
  for(const x of [-.31,.31]){
   const handle=new THREE.Mesh(new THREE.BoxGeometry(.021,.27,.021),wood);
   handle.position.set(x,-.19,-.019);
   group.add(handle);
  }
  group.add(board);scene.add(group);
  function paint(){
   ink.fillStyle=index%2?'#14394e':'#3a191b';ink.fillRect(0,0,768,256);
   ink.strokeStyle='#ffc55a';ink.lineWidth=16;ink.strokeRect(10,10,748,236);
   ink.fillStyle='#fff1cc';ink.textAlign='center';ink.textBaseline='middle';
   ink.font='700 64px Brawl, sans-serif';ink.fillText(bannerLines[index%bannerLines.length],384,133,700);
   texture.needsUpdate=true;
  }
  paint();fontReady.then(paint);
  banners.set(index,group);
 }
 let excitement=0;
 function update(time,dt){
  excitement=Math.max(0,excitement-dt*.63);
  people.forEach((p,i)=>{
   const swing=Math.sin(time*5+p.phase), bounce=Math.sin(time*3.8+p.phase)*.014;
   const cheering=Math.max(0,Math.sin(time*1.8+p.phase)+excitement*.87-.47);
   place(body,i,p,0,.18+bounce,.01,1.12,1,.76,-.10);
   place(head,i,p,0,.405+bounce,.036,1,1.12,.89);
   place(hair,i,p,0,.448+bounce,.018,.98,.60,.95);
   const board=banners.get(i);
   if(board){transform(p,0,.70+bounce+.025*swing,.245,board.position);board.rotation.set(-.05,p.yaw,0);board.scale.setScalar(p.size);}
   for(const [side,k] of [[-1,0],[1,2]]){
    const shoulder=[side*.122,.274+bounce,.022];
    const holding=banners.has(i);
    const elbow=holding?[side*.24,.40+bounce,.18]:[side*(.15+.043*cheering),.13+.17*cheering,.083+.07*cheering];
    const hand=holding?[side*.31,.51+bounce+.025*swing,.245]:[side*(.11+.082*cheering)+.025*swing,.08+.44*cheering+.055*swing*cheering,.22-.11*cheering];
    segment(arms,i*4+k,p,shoulder,elbow,.154);
    segment(arms,i*4+k+1,p,elbow,hand,.175);
   }
  });
  for(const mesh of [body,head,hair,arms])mesh.instanceMatrix.needsUpdate=true;
 }
 update(0,0);
 return {count:people.length,update,cheer(){excitement=1;}};
}
