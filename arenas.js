import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const ARENAS=[
 {id:'filmcity',name:'FILM CITY BACKLOT',place:'Mumbai · studio road',tag:'TAKE ONE'},
 {id:'akhada',name:'DHOBI PACHAD AKHADA',place:'Old city · mitti ka maidan',tag:'DESI DANGAL'},
 {id:'cinema',name:'MONSOON CINEMA',place:'Mumbai · last show',tag:'HOUSEFULL'}
];

export function createArenaManager(scene,renderer){
 const loader=new THREE.TextureLoader();
 const maxAnisotropy=renderer.capabilities.getMaxAnisotropy();
 const groups=new Map();
 const textureCache=new Map(),materials=[];
 const hemisphere=scene.children.find(light=>light.isHemisphereLight);
 const directional=scene.children.filter(light=>light.isDirectionalLight);
 let selected='filmcity';
 const v=(x,y,z)=>new THREE.Vector3(x,y,z);
 function photo(name,key,tile){
  const url='./assets/materials/'+name+'-'+key+'.jpg';
  const cacheKey=url+tile;
  if(!textureCache.has(cacheKey)){
   const map=loader.load(url);
   map.wrapS=map.wrapT=THREE.RepeatWrapping;
   map.repeat.set(tile,tile);map.anisotropy=maxAnisotropy;
   if(key==='Diffuse')map.colorSpace=THREE.SRGBColorSpace;
   textureCache.set(cacheKey,map);
  }
  return textureCache.get(cacheKey);
 }
 function surface(name,color,tile=1,roughness=.8){
  const material=new THREE.MeshStandardMaterial({
   color,map:photo(name,'Diffuse',tile),normalMap:photo(name,'nor_gl',tile),
   roughnessMap:photo(name,'Rough',tile),roughness,normalScale:new THREE.Vector2(.35,.35)
  });
  materials.push(material);return material;
 }
 const plaster=surface('plastered_wall_02',0xc4b08b,2);
 const pale=surface('plastered_wall_02',0xe1d5b2,2);
 const concrete=surface('plastered_wall_02',0xa8a69c,5);
 const bricks=surface('red_brick',0xa67c66,2.5);
 const earth=surface('dirt_floor',0xc19a6b,4);
 const asphalt=surface('asphalt_02',0xa0a1a3,12);
 const wood=new THREE.MeshStandardMaterial({color:0x70543a,roughness:.91});
 const metal=new THREE.MeshStandardMaterial({color:0x42464a,metalness:.65,roughness:.54});
 const dark=new THREE.MeshStandardMaterial({color:0x161d22,roughness:.77});
 const red=new THREE.MeshStandardMaterial({color:0x733127,roughness:.76});
 const ochre=new THREE.MeshStandardMaterial({color:0xba8144,roughness:.85});
 const warm=new THREE.MeshStandardMaterial({color:0xffca7a,emissive:0xfca242,emissiveIntensity:1.4,roughness:.4});
 function box(group,x,y,z,w,h,d,mat,rotation=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);mesh.rotation.y=rotation;
  mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
 }
 function bar(group,from,to,radius,mat){
  const a=v(...from),b=v(...to),delta=b.clone().sub(a);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),12),mat);
  mesh.position.copy(a).lerp(b,.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),delta.normalize());
  mesh.castShadow=true;group.add(mesh);return mesh;
 }
 function sign(group,text,x,y,z,w,h,background='#17222b',ink='#efe3bc'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  function draw(){
   ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);
   ctx.strokeStyle=ink;ctx.lineWidth=9;ctx.strokeRect(15,15,994,226);
   ctx.font='700 94px Brawl, sans-serif';ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(text,512,133,950);map.needsUpdate=true;
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=maxAnisotropy;
  draw();document.fonts.load('700 94px Brawl').then(draw);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.7}));
  mesh.position.set(x,y,z);group.add(mesh);return mesh;
 }
 function ground(group,mat){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(38,38),mat);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.055;mesh.receiveShadow=true;group.add(mesh);
 }
 function cable(group,points){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>v(...p)));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,.018,6,false),dark);
  group.add(mesh);return mesh;
 }
 function crate(group,x,z,size=.55){
  box(group,x,.06+size/2,z,size,size,size,wood);
  for(const shift of [-.33,.33]){
   box(group,x+size*shift,.06+size/2,z+size/2+.014,.038,size,.024,ochre);
   box(group,x,.06+size/2+shift*size,z+size/2+.024,size,.032,.025,ochre);
  }
 }
 function lamp(group,x,z,height=4,studio=false){
  bar(group,[x,.06,z],[x,height,z],.045,metal);
  if(studio){
   for(const angle of [0,2.1,4.2])bar(group,[x,.42,z],[x+Math.cos(angle)*.45,.06,z+Math.sin(angle)*.45],.025,metal);
   box(group,x,height,z,.72,.55,.25,dark);
   box(group,x,height,z+.14,.55,.37,.018,warm);
   for(const offset of [-.41,.41])box(group,x+offset,height,z+.14,.19,.55,.04,dark,offset);
  }else{
   bar(group,[x,height,z],[x-.65,height+.2,z],.04,metal);
   box(group,x-.65,height+.14,z,.48,.09,.29,dark);
   box(group,x-.65,height+.08,z,.37,.02,.22,warm);
  }
 }
 function facade(group,x,z,w,h,mat,label,trim=red){
  box(group,x,h/2+.06,z,w,h,.55,mat);
  box(group,x,h+.13,z+.10,w+.28,.22,.78,trim);
  box(group,x,.26,z+.29,w+.22,.37,.63,concrete);
  const bays=Math.max(2,Math.floor(w/1.5));
  for(let i=0;i<bays;i++){
   const xx=x-w/2+(i+.5)*w/bays;
   box(group,xx,1.37,z+.29,.86,2.02,.10,dark);
   box(group,xx,1.37,z+.36,.72,1.85,.04,metal);
   for(let slat=0;slat<16;slat++)box(group,xx,.52+slat*.112,z+.393,.73,.025,.024,dark);
   if(h>3.4){
    box(group,xx,3.14,z+.30,.82,.90,.06,wood);
    box(group,xx,3.14,z+.35,.66,.75,.04,dark);
    box(group,xx,3.14,z+.39,.04,.8,.04,pale);
    box(group,xx,3.14,z+.39,.7,.04,.04,pale);
   }
  }
  if(label)sign(group,label,x,2.61,z+.37,w*.87,.55);
 }
 function filmcity(){
  const group=new THREE.Group();ground(group,asphalt);
  facade(group,0,-16,18,6.6,pale,'BOLLYBRAWL STUDIOS',metal);
  for(const x of [-6,-2,2,6]){
   box(group,x,7.0,-16,1.5,.8,1.5,metal);
   box(group,x,7.45,-16,1.7,.12,1.7,dark);
  }
  // A production camera with reel housings, matte box, rails and a spread tripod.
  const rig=new THREE.Group();
  for(const angle of [0,2.1,4.2])bar(rig,[0,1.05,0],[Math.cos(angle)*.48,.07,Math.sin(angle)*.48],.026,metal);
  box(rig,0,1.14,0,.32,.16,.30,metal);
  box(rig,0,1.48,0,.43,.46,.63,dark);
  bar(rig,[0,1.48,.29],[0,1.48,.57],.105,metal);
  box(rig,0,1.48,.65,.39,.30,.15,dark);
  for(const x of [-.16,.16]){
   const reel=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.07,24),metal);
   reel.rotation.x=Math.PI/2;reel.position.set(x,1.84,0);rig.add(reel);
  }
  bar(rig,[.12,1.25,-.22],[.35,1.36,-.56],.016,metal);
  rig.position.set(-1.65,.06,-4.25);rig.rotation.y=-.3;group.add(rig);
  lamp(group,1.72,-4.0,2.70,true);
  facade(group,-4.4,-5,4.7,4.8,plaster,'POLICE CHOWKI');
  facade(group,4.6,-5.5,4.8,5.4,bricks,'STUDIO 07',metal);
  // The gate stays open along the central vehicle and fighter entrance.
  for(const x of [-1.75,1.75])box(group,x,2.6,-7.1,.34,5.15,.56,pale);
  box(group,0,5.12,-7.1,4.0,.38,.70,red);
  sign(group,'FILM CITY · BACKLOT',0,5.13,-6.72,3.78,.48,'#5b241b');
  for(const x of [-7.2,7.2]){
   box(group,x,2.0,-1.9,1.2,4,.5,plaster);
   lamp(group,x*.8,-3.6,4.2,true);
   crate(group,x*.85,-2.6);
   crate(group,x*.85+.37,-3.15,.44);
   for(let row=0;row<4;row++)for(let col=0;col<3;col++)
    box(group,x+(col-1)*.36,.22+row*.22,-3.6,.42,.20,.32,ochre,.05*(col-1));
  }
  // Scaffolding behind the false-front set, with visible braces and work deck.
  for(const x of [2.6,4.2,5.8,7.4]){
   bar(group,[x,.08,-6.3],[x,6.2,-6.3],.033,metal);
   for(const y of [1.5,3.1,4.7])bar(group,[2.6,y,-6.3],[7.4,y,-6.3],.028,metal);
  }
  for(const x of [2.6,4.2,5.8])bar(group,[x,1.5,-6.3],[x+1.6,3.1,-6.3],.025,metal);
  box(group,5,4.6,-6.4,5,.10,1.1,wood);
  cable(group,[[-6.4,.08,1],[-6,.09,-1],[-5.2,.08,-2.2],[-5.8,.09,-3.4]]);
  cable(group,[[-7,5.4,-5],[0,4.65,-7.1],[7,6.0,-6]]);
  sign(group,'QUIET ON SET',-5.9,1.38,-2.79,.95,.40,'#e1b84a','#261e16');
  const chair=new THREE.Group();
  for(const x of [-.26,.26])for(const z of [-.22,.22])bar(chair,[x,.08,z],[x,.77,-z],.024,metal);
  box(chair,0,.65,0,.58,.045,.48,dark);box(chair,0,1,-.22,.57,.29,.045,dark);
  sign(chair,'DIRECTOR',0,1,-.19,.50,.20);
  chair.position.set(-5.8,0,-2.25);group.add(chair);
  for(const x of [-.16,.16])box(group,x,.059,2.5,.026,.006,1.8,pale);
  return group;
 }
 function akhada(){
  const group=new THREE.Group();ground(group,concrete);
  facade(group,0,-15,17,5.2,plaster,'MITTI KA MAIDAN',red);
  box(group,0,5.35,-15,17.4,.20,.88,pale);
  const pit=new THREE.Mesh(new THREE.CircleGeometry(4.3,96),earth);
  pit.rotation.x=-Math.PI/2;pit.position.y=.059;pit.receiveShadow=true;group.add(pit);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(4.35,.085,10,96),ochre);
  rim.rotation.x=Math.PI/2;rim.position.y=.07;group.add(rim);
  facade(group,-4.6,-5.5,4.9,4.6,plaster,'USTAAD AKHADA',red);
  facade(group,4.9,-6.1,5.0,4.2,bricks,'DHOBI GHAT',wood);
  for(const signum of [-1,1]){
   for(let i=0;i<4;i++){
    const x=signum*(5.4+i*.64),z=-3.1+(i%2)*.75;
    box(group,x,.48,z,.72,.82,1.03,concrete);
    box(group,x,.90,z,.73,.10,.95,pale);
    box(group,x,.91,z,.53,.025,.75,dark);
   }
   bar(group,[signum*7,.06,-3],[signum*7,4.6,-3],.055,wood);
  }
  const rope=cable(group,[[-7,4.25,-3],[0,3.82,-5.7],[7,4.25,-3]]);
  for(let i=0;i<14;i++){
   const u=(i+.5)/14,point=rope.geometry.parameters.path.getPoint(u);
   const fabric=new THREE.PlaneGeometry(.60,.93,8,12);
   const positions=fabric.attributes.position;
   for(let point=0;point<positions.count;point++){
    const y=positions.getY(point);
    positions.setZ(point,.055*Math.sin(positions.getX(point)*22+i)*(1-(y+.465)/.93));
   }
   fabric.computeVertexNormals();
   const cloth=new THREE.Mesh(fabric,new THREE.MeshStandardMaterial({color:[0xe3d8b7,0x876952,0x78999c,0xb9ada2][i%4],roughness:1,side:THREE.DoubleSide}));
   cloth.position.copy(point);cloth.position.y-=.49;cloth.rotation.y=(u-.5)*.6;
   group.add(cloth);
   for(const dx of [-.24,.24])box(group,point.x+dx,point.y-.02,point.z,.034,.09,.04,wood);
  }
  for(const x of [-2.2,2.2]){
   box(group,x,1.95,-7,.35,3.8,.47,pale);
   box(group,x,3.84,-7,.58,.17,.68,red);
  }
  box(group,0,3.89,-7,4.9,.26,.64,red);
  sign(group,'DHOBI PACHAD AKHADA',0,3.91,-6.65,4.55,.49,'#8b4b2b');
  for(const x of [-5.9,5.9]){
   lamp(group,x,-3.2,3.7);
   for(let i=0;i<3;i++){
    const pot=new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.18,.02),new THREE.Vector2(.23,.22),new THREE.Vector2(.12,.42),new THREE.Vector2(.13,.48)],24),ochre);
    pot.position.set(x+i*.43,.065,-1.9);pot.castShadow=true;group.add(pot);
   }
   const club=bar(group,[x,.08,-2.5],[x+.1,1.23,-2.5],.075,wood);
   box(group,x,1.08,-2.5,.21,.45,.23,wood,.08);
  }
  return group;
 }
 function cinema(){
  const group=new THREE.Group();ground(group,asphalt);
  facade(group,0,-7.4,13,6.5,bricks,'',red);
  box(group,0,2.44,-6.74,9.6,.33,2.05,red);
  for(const x of [-4.4,-2.2,0,2.2,4.4]){
   box(group,x,1.18,-7,1.22,2.20,.09,dark);
   box(group,x,1.25,-6.93,.055,1.9,.07,metal);
   for(const yy of [.64,1.24,1.84])box(group,x,yy,-6.87,.92,.025,.025,ochre);
  }
  sign(group,'BOLLY CINEMA',0,4.42,-6.98,10.6,1.02,'#301a26','#ffca67');
  sign(group,'TONIGHT · BOLLYBRAWL · LAST SHOW',0,2.49,-5.69,8.9,.37,'#dfcba4','#2f211e');
  for(let i=0;i<23;i++){
   box(group,-4.6+i*.42,2.25,-5.76,.09,.09,.09,warm);
   if(i%2===0)box(group,-5.2+i*.46,5.14,-7.03,.11,.11,.11,warm);
  }
  for(const [index,x] of [-5.8,-3.9,3.9,5.8].entries()){
   box(group,x,1.47,-6.98,1.22,2.13,.10,metal);
   const title=['TIGER RETURNS','DON KA BADLA','DANGAL NIGHT','AAKHIRI ROUND'][index];
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;
   const ctx=canvas.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,768);
   grad.addColorStop(0,index%2?'#063c4f':'#6b1b18');grad.addColorStop(1,'#0a0d14');
   ctx.fillStyle=grad;ctx.fillRect(0,0,512,768);
   ctx.fillStyle='#e3ad54';ctx.beginPath();ctx.arc(256,296,136,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#141724';ctx.beginPath();ctx.arc(256,262,48,0,Math.PI*2);ctx.fill();ctx.fillRect(193,307,126,210);
   ctx.font='700 43px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f1dfbf';ctx.fillText(title,256,655,480);
   const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
   const poster=new THREE.Mesh(new THREE.PlaneGeometry(1.09,1.97),new THREE.MeshStandardMaterial({map,roughness:.6}));
   poster.position.set(x,1.47,-6.91);group.add(poster);
  }
  for(const signum of [-1,1]){
   facade(group,signum*7,-3.8,2.9,3.8,plaster,signum<0?'TICKET WINDOW':'CHAI · SAMOSA',metal);
   lamp(group,signum*6.25,-1.8,4.0);
   for(let i=0;i<6;i++){
    const x=signum*(5.55+i*.24);
    box(group,x,.30,-2.30,.26,.54,.31,ochre);
   }
   box(group,signum*6.6,1,-2,.9,.15,.55,wood);
  }
  // Thin reflective puddles remain flush with the gameplay floor.
  const water=new THREE.MeshPhysicalMaterial({color:0x4c565d,roughness:.10,metalness:.35,transparent:true,opacity:.50,clearcoat:1});
  for(const [x,z,sx,sz] of [[-2,2.9,1.5,.47],[2.8,1.9,.91,.30],[-4.5,-3.9,.72,.46]]){
   const puddle=new THREE.Mesh(new THREE.CircleGeometry(1,48),water);
   puddle.rotation.x=-Math.PI/2;puddle.scale.set(sx,sz,1);puddle.position.set(x,.061,z);group.add(puddle);
  }
  return group;
 }
 function compact(group){
  group.updateMatrixWorld(true);
  const buckets=new Map(),meshes=[];
  group.traverse(mesh=>{
   if(!mesh.isMesh||Array.isArray(mesh.material))return;
   if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrixWorld);
   // All static geometry uses position, normal and UV attributes.
   if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
   buckets.get(mesh.material).push(geometry);meshes.push(mesh);
  });
  for(const mesh of meshes)mesh.removeFromParent();
  for(const [material,geometry] of buckets){
   const merged=mergeGeometries(geometry,false);
   const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
   for(const source of geometry)source.dispose();
  }
 }
 function select(id){
  if(!ARENAS.some(arena=>arena.id===id))id='filmcity';
  if(!groups.has(id)){
   const group=({filmcity,akhada,cinema})[id]();
   compact(group);
   group.name='Arena_'+id;groups.set(id,group);scene.add(group);
  }
  selected=id;
  const night=id==='cinema',original=false;
  if(hemisphere){
   hemisphere.intensity=original?2.2:night?1.6:2.3;
   hemisphere.color.set(original?0xc3d6e3:night?0xa5bed8:0xd8e5e7);
   hemisphere.groundColor.set(original?0x484039:night?0x333b4b:0x675a45);
  }
  if(directional[0]){
   directional[0].intensity=night?2.6:3.8;
   directional[0].color.set(original?0xffd9a4:night?0xffc77b:0xffe1b1);
  }
  if(directional[1]){
   directional[1].intensity=original?2.8:night?1.7:1.0;
   directional[1].color.set(original?0x8ab5ff:night?0x668ccd:0xbcd9ee);
  }
  for(const [key,group] of groups)group.visible=key===id;
  scene.background.set(id==='cinema'?0x182d40:id==='filmcity'?0x617a86:id==='akhada'?0x817460:0x17222a);
  scene.fog.color.copy(scene.background);
  return ARENAS.find(arena=>arena.id===id);
 }
 select('filmcity');
 return {select,get current(){return selected;},get group(){return groups.get(selected);}};
}
