import {setupTouchControls} from './touch-controls.js?v=mobile18';
import {initMediaConfig,resolveAsset} from './media-config.js?v=mobile18';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {createArenaManager,ARENAS} from './arenas.js?v=mobile18';
import {createRoomClient} from './room-client.js?v=mobile18';
import {createAudioMixer} from './audio-mixer.js?v=mobile18';
import {createFightDialogue} from './fight-dialogue.js?v=mobile18';
import {createFighterPresentations} from './fighter-presentations.js?v=mobile18';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {strikePhases,signatureMoves,signatureAmount,warmupPose} from './fight-motion.js?v=mobile18';
import {createBleachers} from './bleachers.js?v=mobile18';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createCharacterSpecials} from './character-specials.js?v=mobile18';
import {STEP,WARMUP_SECONDS,createMatch,advance,cpuInput,SPECIALS,specialLanding,specialReady} from './combat.js?v=mobile18';

await initMediaConfig();
const $=id=>document.getElementById(id),canvas=$('arena');
const gameShell=$('game-shell');
const viewport=()=>({width:gameShell.clientWidth||innerWidth,height:gameShell.clientHeight||innerHeight});
let layoutBlocked=false,orientationWasPaused=false;

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(matchMedia('(pointer:coarse)').matches?Math.min(devicePixelRatio,1.75):Math.min(Math.max(devicePixelRatio,2),2.5));renderer.setSize(viewport().width,viewport().height);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#17222a');scene.fog=new THREE.FogExp2('#17222a',.003);const camera=new THREE.PerspectiveCamera(42,viewport().width/viewport().height,.1,180);
scene.add(new THREE.HemisphereLight(0xc3d6e3,0x484039,2.2));const key=new THREE.DirectionalLight(0xffd9a4,3.8);key.position.set(-3,8,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.025;scene.add(key);const rim=new THREE.DirectionalLight(0x8ab5ff,2.8);rim.position.set(0,5,-5);scene.add(rim);
let selectedDifficulty='normal',selectedArena='filmcity',arenaManager=null,roomInfo=null,networkSeat=0,networkClock=0,onlineLoading=null,lastRemoteTick=-1;
let mode='cpu',match=null,paused=false,ready=false,helpWasPaused=false,acc=0,last=0,shake=0,callTimer=0,labelTimer=0,globalTime=0,views=[],stageReady=false,carReady=false,carRoot=null,driver=null,carWheels=[];
const attackKeys=[[],[]];
const held=new Set(),pressed=new Set(),touchHeld=new Set(),touchPressed=new Set();const axisQ=new THREE.Quaternion(),euler=new THREE.Euler(),tmpQ=new THREE.Quaternion();
const roster={
 safari:{name:'Asli Tiger',asset:'asli-tiger.glb',voice:'special-voice.mp3'},
 blast:{name:'Tiger Khauf',asset:'tiger-khauf.glb',voice:'tiger-special.mp3'},
 spin:{name:'Jon the Don',asset:'jon-the-don.glb',voice:'jon-special.mp3'},
 slap:{name:'Baburao',asset:'baburao.glb',voice:'babu-special.mp3'},
 burst:{name:'Bawa',asset:'bawa.glb',voice:'bawa-special.mp3'},
 spit:{name:'Vimal Man',asset:'vimal-man.glb',voice:'vimal-special.mp3'},
};
const stories={
 safari:['A street veteran who lets his fists set the rules.','Safari Run','Three Safari passes. Full-screen pressure.'],
 blast:['A quick-footed showman with a mean low sweep.','Backside Blast','Turns away. Blasts the rival across the arena.'],
 spin:['A smooth-talking Don who turns every fight into an entrance.','Spin Throw','Grab. Three spins. One hard landing.'],
 slap:['A neighborhood legend who always has a comeback.','Slap & Lota','Close-range slap into a flying lota.'],
 burst:['A hard-edged enforcer in a crisp white kurta.','Pachaas Tola','Four shots. Keep your guard ready.'],
 spit:['A stern inspector with an unorthodox last resort.','Saffron Spit','Packet, pinch, then a saffron spray.'],
};
const assetVersion='?v=mobile18';
const templates=new Map(), viewCache=[new Map(),new Map()];
let modelQueue=Promise.resolve();
let visibleRoster=null, previewPending=false;
let starting=false, voiceTriggered=false;
function templateFor(kind){
 if(!templates.has(kind)){
  const task=modelQueue.then(()=>loadAsset(kind,'./assets/models/'+roster[kind].asset+assetVersion)).catch(error=>{templates.delete(kind);throw error;});
  modelQueue=task.catch(()=>{});
  templates.set(kind,task);
 }
 return templates.get(kind);
}
function showRoster(kinds,assets){
 const nextViews=kinds.map((kind,id)=>{
  if(!viewCache[id].has(kind))viewCache[id].set(kind,createView(assets[id].scene,id,kind));
  return viewCache[id].get(kind);
 });
 for(const v of views)for(const object of [v.root,v.disk,v.shadow])object.visible=false;
 views=nextViews;visibleRoster=[...kinds];
}
let previewRequest=0, pickSlot=0, previewStarted=0;
function selectedRoster(){return [$('player-fighter').value,$('rival-fighter').value];}
function updateStories(kinds){
 const opponent=mode==='online'?'Player 2':mode==='local'?'Player 2':mode==='training'?'practice rival':'CPU opponent';
 $('pick-status').textContent=mode==='online'?'CHOOSE YOUR FIGHTER':pickSlot===0?'SELECT PLAYER 1':'SELECT '+opponent.toUpperCase();
 $('difficulty-control').hidden=mode!=='cpu';
 for(const [index,kind] of kinds.entries()){
  const slot=index?'rival':'player';
  const [bio,special,description]=stories[kind];
  $(index?'selected-rival-name':'selected-fighter-name').textContent=roster[kind].name.toUpperCase();
  $(slot+'-story-copy').textContent=bio;
  $(slot+'-special-name').textContent='SPECIAL · '+special.toUpperCase();
  $(slot+'-special-copy').textContent=description;
 }
 $('rival-story-label').textContent=['local','online'].includes(mode)?'02 · PLAYER TWO':mode==='training'?'02 · PRACTICE RIVAL':'02 · CPU OPPONENT';
 for(const button of document.querySelectorAll('[data-fighter]')){
  button.classList.toggle('unlocked',button.dataset.fighter===kinds[0]);
  button.classList.toggle('rival-picked',button.dataset.fighter===kinds[1]);
  const player=button.dataset.fighter===kinds[0], rival=button.dataset.fighter===kinds[1];
  const rivalTag=['local','online'].includes(mode)?'P2':'CPU';
  button.dataset.slot=player&&rival?'P1 / '+rivalTag:player?'P1':rival?rivalTag:'';
 }
}
async function previewMatchup(){
 const kinds=selectedRoster(), request=++previewRequest;
 updateStories(kinds);
 if(!ready||match||starting)return;
 previewPending=true;
 try{
  const assets=await Promise.all(kinds.map(templateFor));
  if(request===previewRequest&&!match&&!starting){showRoster(kinds,assets);previewStarted=globalTime;}
 }catch(error){if(request===previewRequest&&!match)notice('Could not load preview: '+error.message);}
 finally{if(request===previewRequest)previewPending=false;}
}
for(const id of ['player-fighter','rival-fighter']){
 const select=$(id);
 for(const [kind,{name}] of Object.entries(roster))select.add(new Option(name,kind));
 select.onchange=previewMatchup;
}
$('rival-fighter').value='spin';
function pickFighter(kind){
 if(mode==='online'){
  const slot=roomClient.session?.seat||0;
  $(slot?'rival-fighter':'player-fighter').value=kind;
  if(roomClient.session)roomClient.select({fighter:kind}).catch(error=>notice(error.message));
 }else{
  $(pickSlot===0?'player-fighter':'rival-fighter').value=kind;
  pickSlot=1-pickSlot;
 }
 previewMatchup();
}
for(const button of document.querySelectorAll('#menu [data-fighter]'))button.onclick=()=>pickFighter(button.dataset.fighter);
function selectDifficulty(value){
 selectedDifficulty=value;
 for(const button of document.querySelectorAll('[data-difficulty]'))
  button.setAttribute('aria-pressed',String(button.dataset.difficulty===value));
}
for(const button of document.querySelectorAll('[data-difficulty]'))button.onclick=()=>selectDifficulty(button.dataset.difficulty);
for(const id of ['special-label1','special-label2'])$(id).onclick=()=>{if(match&&!paused&&Number(id.slice(-1))-1===(mode==='online'?networkSeat:0))pressed.add('KeyL');};
const mapping={KeyA:'left',KeyD:'right',KeyW:'jump',KeyS:'crouch',KeyJ:'punch',KeyK:'kick',KeyU:'sweep',KeyI:'grabSignature',KeyL:'special',Space:'special',ShiftLeft:'block'};
function clearInput(){attackKeys.forEach(queue=>queue.length=0);held.clear();pressed.clear();touchHeld.clear();touchPressed.clear();document.querySelectorAll('#touch button').forEach(b=>b.classList.remove('active'));}
addEventListener('keydown',e=>{if(layoutBlocked)return;if(e.target instanceof HTMLInputElement)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)||(e.code==='Enter'&&match?.presentation&&!paused))e.preventDefault();if(!e.repeat){pressed.add(e.code);const a=mapping[e.code];const b={Numpad1:'punch',Digit1:'punch',Numpad2:'kick',Digit2:'kick'}[e.code];if(a==='punch'||a==='kick')attackKeys[0].push(a);if(b&&mode==='local')attackKeys[1].push(b);}held.add(e.code);if(e.code==='Escape'){if(!$('help-panel').classList.contains('hidden'))closeHelp();else togglePause();}if(e.code==='KeyR'&&ready&&match&&mode!=='online')startGame();if(e.code==='Enter'&&ready&&!match){startGame();}});addEventListener('keyup',e=>held.delete(e.code));addEventListener('blur',()=>{clearInput();if(match&&match.phase!=='over'&&mode!=='online')setPause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(match&&match.phase!=='over'&&mode!=='online')setPause(true);}});
for(let button of document.querySelectorAll('[data-input]')){let value=button.dataset.input;button.addEventListener('pointerdown',e=>{e.preventDefault();if(layoutBlocked)return;button.setPointerCapture(e.pointerId);touchHeld.add(value);touchPressed.add(value);if(value==='punch'||value==='kick')attackKeys[0].push(value);button.classList.add('active');});let end=e=>{e.preventDefault();touchHeld.delete(value);button.classList.remove('active');};button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',()=>{touchHeld.delete(value);button.classList.remove('active');});}
function readInput(player){let out={attacks:attackKeys[player].splice(0),skip:pressed.has('Enter')};if(player===0){for(let [code,name] of Object.entries(mapping))out[name] ||= ['jump','punch','kick','sweep','grabSignature','special'].includes(name)?pressed.has(code):held.has(code);if(mode!=='local'){out.left ||= held.has('ArrowLeft');out.right ||= held.has('ArrowRight');out.jump ||= pressed.has('ArrowUp');out.crouch ||= held.has('ArrowDown');}for(let name of touchHeld)if(!['jump','punch','kick','sweep','grabSignature','special'].includes(name))out[name]=true;for(let name of touchPressed)out[name]=true;}else{Object.assign(out,{left:held.has('ArrowLeft'),right:held.has('ArrowRight'),jump:pressed.has('ArrowUp'),crouch:held.has('ArrowDown'),block:held.has('ShiftRight')});for(let [n,name] of [['1','punch'],['2','kick'],['3','sweep']])out[name]=pressed.has('Numpad'+n)||pressed.has('Digit'+n);out.grabSignature=pressed.has('Numpad4')||pressed.has('Digit4');out.special=pressed.has('Numpad0')||pressed.has('Digit0');}return out;}
const audioMixer=createAudioMixer();
const knockoutVoice=new Audio(resolveAsset('./assets/knockout.mp3'));
knockoutVoice.preload='auto';knockoutVoice.id='knockout-voice';knockoutVoice.hidden=true;document.body.append(knockoutVoice);audioMixer.attach(knockoutVoice);
const finishVoice=new Audio(resolveAsset('./assets/samay-samapti.wav'));
finishVoice.preload='auto';finishVoice.id='finish-voice';finishVoice.hidden=true;document.body.append(finishVoice);audioMixer.attach(finishVoice);
function stopFinish(){finishVoice.pause();knockoutVoice.pause();}
function playFinishVoice(){
 if(!sound)return;
 specialVoice.pause();knockoutVoice.pause();finishVoice.currentTime=0;finishVoice.play().catch(()=>{});
}
function playKnockoutVoice(){
 if(!sound)return;
 specialVoice.pause();knockoutVoice.currentTime=0;knockoutVoice.play().catch(()=>{});
}
let audience=null,carDoor=null;
const specialVoice=new Audio('./assets/special-voice.mp3');specialVoice.preload='auto';specialVoice.id='special-voice';specialVoice.hidden=true;document.body.append(specialVoice);audioMixer.attach(specialVoice);let audio=null,sound=true;function tone(freq,duration=.1,gain=.06,slide=0){if(!sound)return;audio??=audioMixer.context;audio.resume();let osc=audio.createOscillator(),vol=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),audio.currentTime+duration);vol.gain.setValueAtTime(Math.min(.065,gain*.58),audio.currentTime);vol.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(vol).connect(audioMixer.output);osc.start();osc.stop(audio.currentTime+duration);}
$('sound').textContent='SOUND ON';$('sound').onclick=()=>{sound=!sound;specialVoice.muted=!sound;finishVoice.muted=!sound;knockoutVoice.muted=!sound;if(!sound)audioMixer.stopClips();$('sound').textContent=sound?'SOUND ON':'SOUND OFF';presentations.sync(paused,sound);if(sound)tone(440,.07);};
const dracoLoader=new DRACOLoader();
dracoLoader.setDecoderPath('./vendor/three/addons/libs/draco/gltf/').setDecoderConfig({type:'wasm'}).setWorkerLimit(2);
const loader=new GLTFLoader().setDRACOLoader(dracoLoader);
let loaded={fighter:0,car:0,stands:0,audio:0};
async function loadAsset(name,url){
 let failure;
 for(let attempt=0;attempt<4;attempt++){
  try{return await loadAssetOnce(name,url,attempt>0);}
  catch(error){failure=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,350*2**attempt));}
 }
 throw failure;
}
async function loadAssetOnce(name,url,retry=false){let response=await fetch(url,{signal:AbortSignal.timeout(20000),cache:retry?'reload':'default'});if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);let total=Number(response.headers.get('content-length'))||1,reader=response.body.getReader(),chunks=[],count=0;while(true){let {done,value}=await reader.read();if(done)break;chunks.push(value);count+=value.length;loaded[name]=Math.min(1,count/total);$('load-fill').style.width=((loaded.fighter*.35+loaded.car*.35+loaded.stands*.10+loaded.audio*.20)*100)+'%';$('load-status').textContent=`${name==='fighter'?'Fighter':name==='car'?'Safari':name==='stands'?'Crowd':'Fighter'} · ${(count/1048576).toFixed(1)} MB`; }let buffer=new Uint8Array(count),offset=0;for(let c of chunks){buffer.set(c,offset);offset+=c.length;}if(count<12||new DataView(buffer.buffer).getUint32(0,true)!==0x46546c67)throw new Error('Incomplete model download');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Model decoding timed out')),30000);loader.parse(buffer.buffer,'./assets/',value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
function createView(template,id,kind){let model=clone(template),root=new THREE.Group();root.add(model);scene.add(root);model.updateMatrixWorld(true);let bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replace(/[._]?([LR])$/,'.$1')]={bone:o,base:o.quaternion.clone(),restScale:o.scale.clone(),world:o.getWorldQuaternion(new THREE.Quaternion())};if(o.isMesh){if(o.morphTargetDictionary)for(let [n,index] of Object.entries(o.morphTargetDictionary))if(n.startsWith('Fist_'))o.morphTargetInfluences[index]=1;o.castShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.roughness=Math.max(.60,o.material.roughness??.7);o.material.side=THREE.FrontSide;}});let disk=new THREE.Mesh(new THREE.RingGeometry(.32,.37,48),new THREE.MeshBasicMaterial({color:id===0?0xedb95e:0xe06d62,transparent:true,opacity:.68,side:THREE.DoubleSide}));disk.rotation.x=-Math.PI/2;disk.position.y=.085;disk.visible=false;scene.add(disk);let shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.65),new THREE.MeshBasicMaterial({map:shadowTexture(),transparent:true,opacity:.42,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.075;scene.add(shadow);const mouthLocal=kind==='spit'?bones.head.bone.worldToLocal(model.localToWorld(new THREE.Vector3(0,1.744,.122))):kind==='burst'?bones.head.bone.worldToLocal(model.localToWorld(new THREE.Vector3(.042,1.741,.115))):null;const footHeight=Object.fromEntries(['L','R'].map(side=>[side,bones['foot.'+side].bone.getWorldPosition(new THREE.Vector3()).y]));return {root,model,bones,disk,shadow,id,mouthLocal,footHeight};}
let shadowTex;function shadowTexture(){if(shadowTex)return shadowTex;let c=document.createElement('canvas');c.width=c.height=64;let x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return shadowTex=new THREE.CanvasTexture(c);}
function pose(view,name,x=0,y=0,z=0,blend=.45){let b=view.bones[name];if(!b)return;euler.set(x,y,z,'XYZ');axisQ.setFromEuler(euler);tmpQ.copy(b.world).invert().multiply(axisQ).multiply(b.world);let target=b.base.clone().multiply(tmpQ);b.bone.quaternion.slerp(target,blend);}
function animateFighter(view,f,dt){const t=globalTime+view.id*.61,walk=Math.sin(f.walk*10),air=f.y>.03;let crouch=f.crouch?1:0,atk=f.attack,motion=atk?strikePhases(atk):null,extend=motion?.strike??0;const warmup=match?.phase==='intro'?warmupPose(1-match.phaseTime/WARMUP_SECONDS,view.id):!match?warmupPose(((globalTime-previewStarted)%5.2)/3.8,view.id):null;const gesture=f.taunt&&!f.stun?signatureMoves[f.kind]:null;const gestureBlend=gesture?(atk?motion.load*.35:signatureAmount(f.taunt)):0;if(match?.phase!=='special'){const fists=warmup?1-.88*warmup.stretch:gesture?1-.78*gestureBlend:1;if(view.fists!==fists){setFists(view,fists);view.fists=fists;}}let offsets={};const p=(n,x=0,y=0,z=0)=>offsets[n]=[x,y,z];
 // A relaxed boxing guard, authored relative to the model's A-pose.
 p('upper_arm.L',-.15,-.60,-.18);p('upper_arm.R',-.15,.60,.18);p('forearm.L',-1.80,0,0);p('forearm.R',-1.80,0,0);p('hand.L',0,0,0);p('hand.R',0,0,0);p('chest',.02*Math.sin(t*2),0,0);p('head',0,0,0);
 const rushing=!!atk?.approaching;
 const readyStep=f.state==='idle'&&!f.attack&&!f.stun?Math.sin(t*5.3):0;
 if(f.state==='idle'){
  p('thigh.L',-.10+readyStep*.16,0,0);
  p('thigh.R',-.10-readyStep*.16,0,0);
  p('shin.L',.19+Math.max(0,readyStep)*.15,0,0);
  p('shin.R',.19+Math.max(0,-readyStep)*.15,0,0);
  p('chest',.075+Math.sin(t*5.3)*.028,readyStep*.11,Math.sin(t*2.65)*.038);
  p('head',-.035,-readyStep*.045,0);
 }
 if(f.state==='walk'||rushing){p('thigh.L',walk*.27,0,0);p('thigh.R',-walk*.27,0,0);p('shin.L',Math.max(0,-walk)*.35,0,0);p('shin.R',Math.max(0,walk)*.35,0,0);}
 if(crouch||atk?.name==='sweep'||atk?.lowJab){crouch=1;p('thigh.L',-.85,0,0);p('thigh.R',-.85,0,0);p('shin.L',1.5,0,0);p('shin.R',1.5,0,0);p('chest',.22,0,0);}
 if(air){p('thigh.L',-.5,0,0);p('thigh.R',-.25,0,0);p('shin.L',.8,0,0);p('shin.R',.6,0,0);}
 if(f.block){p('upper_arm.L',-.5,-.9,0);p('upper_arm.R',-.5,.9,0);p('forearm.L',-1.65,0,0);p('forearm.R',-1.65,0,0);p('chest',.1,0,0);}
 if(atk?.name==='punch'&&!rushing){
  const side=atk.side,dir=side==='L'?1:-1;
  p('upper_arm.'+side,-.25,-dir*(1.1+extend*.35),dir*.35);
  p('forearm.'+side,-1.8+extend*1.8,0,0);
  p('pelvis',.03*motion.weight,-dir*(extend*.28-motion.load*.20),dir*.06*motion.weight);
  p('chest',.11*extend,-dir*(extend*(atk.style==='straight'?.41:.65)-motion.load*.28),dir*.08*extend);
 }
 if(atk?.name==='kick'&&!rushing){
  const side=atk.side,dir=side==='L'?1:-1;
  const round=atk.style==='roundhouse';
  const support=side==='L'?'R':'L';
  const chamber=motion.chamber;
  p('pelvis',-.09*motion.weight,-dir*(round?.78:.32)*extend,dir*.12*motion.weight);
  p('thigh.'+side,-chamber*1.21-extend*(air?1.79:round?1.48:1.51),dir*extend*(round?.63:.10),dir*(chamber*.16+extend*(round?.54:.11)));
  p('shin.'+side,chamber*1.68+extend*.10,0,0);
  p('foot.'+side,-.27*extend+.18*chamber,0,0);
  if(!air){
   p('thigh.'+support,-.08*motion.weight,dir*.25*extend,-dir*.09*motion.weight);
   p('shin.'+support,.18*motion.weight,0,0);
   p('foot.'+support,-.10*motion.weight,dir*(round?.54:.18)*extend,0);
  }
  p('chest',-.20*extend,-dir*(round?.49:.20)*extend,-dir*.20*motion.weight);
 }
 if(atk?.name==='sweep'){p('thigh.R',-extend*1.05,.25,0);p('shin.R',1.4*(1-extend),0,0);p('chest',.3,extend*.3,0);}
 if(f.stun){const recoil=Math.min(1,f.stun/13);p('chest',-(f.hitMove==='kick'?.52:.35)*recoil,.17*recoil,.13*recoil);p('head',-.26*recoil,-.18*recoil,0);p('thigh.R',-.23*recoil,0,0);p('shin.R',.32*recoil,0,0);}
 if(gesture&&!atk){
  p('chest',...gesture.chest.map(v=>v*gestureBlend));
  p('head',...gesture.head.map(v=>v*gestureBlend));
  if(gesture.kick){p('thigh.R',-1.24*gestureBlend,.36*gestureBlend,.31*gestureBlend);p('shin.R',.51*gestureBlend,0,0);}
 }
 if(warmup){
  p('chest',...warmup.chest);
  p('head',...warmup.head);
  p('pelvis',.10*warmup.weight,0,(warmup.legL-warmup.legR)*.09);
  p('thigh.L',-.68*warmup.legL,0,.09*warmup.legL);
  p('shin.L',1.05*warmup.legL,0,0);
  p('foot.L',-.24*warmup.legL,0,0);
  p('thigh.R',-.68*warmup.legR,0,-.09*warmup.legR);
  p('shin.R',1.05*warmup.legR,0,0);
  p('foot.R',-.24*warmup.legR,0,0);
 }
 if(f.hp<=0){p('chest',0,0,0);p('head',0,0,0);p('upper_arm.L',0,0,.15);p('upper_arm.R',0,0,-.15);p('forearm.L',0,0,0);p('forearm.R',0,0,0);crouch=0;}
 for(let n in view.bones){let a=offsets[n]||[0,0,0];pose(view,n,...a,atk?.name==='kick'||atk?.name==='punch'?1-Math.exp(-dt*58):1-Math.exp(-dt*35));}
 let targetY=.06+f.y-crouch*.25+(f.state==='idle'?-.022+Math.abs(readyStep)*.021:0);const renderX=f.x+(motion?f.facing*(extend*(atk.name==='punch'?.18:.12)-motion.load*.055):0);view.root.position.set(mode==='online'&&match?.phase==='fight'?THREE.MathUtils.lerp(view.root.position.x,renderX,1-Math.exp(-dt*24)):renderX,targetY,0);view.root.rotation.set(0,(f.facing>0?1:-1)*(match?.phase==='intro'?1.02:match?Math.PI/2:.78),0);view.disk.position.x=f.x;view.disk.material.opacity=air?.25:.65;view.shadow.position.x=f.x;view.shadow.position.z=0;view.shadow.material.opacity=.42/(1+f.y);view.shadow.scale.setScalar(1+f.y*.15);view.root.updateMatrixWorld(true);
 if(atk?.name==='kick'&&!air){
  const support=atk.side==='L'?'R':'L';
  const ankle=view.bones['foot.'+support].bone.getWorldPosition(new THREE.Vector3());
  view.root.position.y+=THREE.MathUtils.clamp(.06+view.footHeight[support]-ankle.y,-.10,.10)*motion.weight;
 }
 if(f.hp>0&&!f.stun){
  for(const side of ['L','R']){
   const sign=side==='L'?1:-1, striking=atk?.name==='punch'&&atk.side===side;
   const target=f.block?new THREE.Vector3(sign*.15,1.64,.17):new THREE.Vector3(sign*.19,side==='L'?1.50:1.61,side==='L'?.36:.19);
   if(f.state==='idle'){target.z+=.045*readyStep*sign;target.y+=.026*Math.sin(t*5.3+sign*.8);}
   if(rushing){target.y-=.12;target.z+=sign*walk*.18;}
   if(warmup){
    target.lerp(new THREE.Vector3(sign*.80,1.56+warmup.stretch*.23,.16),warmup.stretch);
    target.y-=warmup.weight*.23;
    target.z+=sign*(warmup.legL-warmup.legR)*.11;
   }
   if(gesture)target.lerp(new THREE.Vector3(...(side==='L'?gesture.left:gesture.right)),gestureBlend);
   if(atk?.name==='kick'&&!rushing){target.x+=sign*motion.weight*.09;target.y-=motion.weight*(side===atk.side?.28:.10);}
   if(atk?.name==='grab'){
    target.x=sign*(.18+.29*motion.load-.08*extend);
    target.y=1.50+.13*motion.load;
    target.z=.20+.56*extend;
   }
   if(striking){
    target.z-=motion.load*(atk.signature?.25:.14);
    if(atk.signature)target.x+=sign*motion.load*.18;
    target.z=THREE.MathUtils.lerp(target.z,atk.style==='hook'?.56:.74,extend);
    target.x+=sign*(atk.style==='hook'?(.40*Math.sin(extend*Math.PI)-.22*extend):-.09*extend);
    target.y+=atk.lowJab?-.33:atk.style==='cross'?.035*extend:0;
   }
   solveArm(view,side,target,striking?extend:0);
  }
 }
if(f.hp<=0){view.koTime=f.ko?.time??((view.koTime||0)+dt);let fall=Math.min(Math.PI/2,view.koTime*2.7);view.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),f.facing>0?Math.PI/2:-Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-fall));view.root.position.y=.22+f.y;}else view.koTime=0;view.model.traverse(o=>{if(o.isMesh&&o.material.emissive){o.material.emissive.set(f.flash>0?0xffaa66:0x000000);o.material.emissiveIntensity=.19*Math.min(1,f.flash/.12);}});
}
let tauntBubble=null;
const sparks=[];const sparkGeo=new THREE.SphereGeometry(.025,5,4);function impact(e){let color=e.blocked?0xa0d6ff:e.signature?0xff7b35:0xffcc76;for(let i=0;i<(e.signature?23:14);i++){let mesh=new THREE.Mesh(sparkGeo,new THREE.MeshBasicMaterial({color}));mesh.position.set(e.x,e.y,-.15);scene.add(mesh);sparks.push({mesh,v:new THREE.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*2),life:.3+Math.random()*.15});}shake=e.blocked?.025:.065;tone(e.blocked?240:100,.11,e.blocked?.035:.10,-60);$('hit-label').textContent=e.blocked?'GUARD':e.combo>1?`${e.combo} HIT COMBO`:e.signature?signatureMoves[e.signature].name.toUpperCase():e.move==='sweep'?'LOW SWEEP':e.move.toUpperCase();$('hit-label').style.left=e.attacker===0?'8%':'76%';labelTimer=.65;}
function call(text,duration=1){$('callout').textContent=text;$('callout').style.opacity=1;callTimer=duration;}
const presentations=createFighterPresentations(scene,{pose,solveArm,setFists,resetPose:resetCinematicPose,tone,audioMixer});
function startShowcase(){
 const shot=match.presentation;
 const [track,line]=presentations.start(shot,paused,sound);
 const card=$('fighter-presentation');
 card.querySelector('small').textContent=match.phase==='victory'?'MATCH WINNER':track;
 card.querySelector('strong').textContent=roster[shot.kind].name;
 card.querySelector('span').textContent=line;
 card.classList.remove('hidden');
 document.body.classList.add('showcase');
 $('callout').style.opacity=0;
 clearInput();
}
function endShowcase(){
 presentations.stop();
 $('fighter-presentation').classList.add('hidden');
 document.body.classList.remove('showcase');
 views.forEach(view=>{resetCinematicPose(view);setFists(view,1);view.fists=1;});
}
$('skip-presentation').onclick=()=>pressed.add('Enter');
const fightDialogue=createFightDialogue({camera,element:$});
function handleEvents(events){for(let e of events){fightDialogue.event(e,match);if(e.type==='presentationStart')startShowcase();if(e.type==='presentationEnd')endShowcase();if(e.type==='hit'){impact(e);if(tauntBubble?.id===e.target)tauntBubble=null;}if(e.type==='taunt')tauntBubble=e;if(e.type==='specialUnavailable')call(e.cooldown?'SUPER RECHARGING':'SUPER NEEDS A FULL METER',.9);if(e.type==='specialStart')startSpecialPresentation(e);if(e.type==='specialHit'){if(['throw','dhobi','signature'].includes(e.kind)){impact({...e,signature:match.special.signature,move:e.kind==='throw'?'throw':'signature',combo:e.kind==='dhobi'?e.pass:1,blocked:false});continue;}if(e.kind==='blast')tone(73,.35,.12,-48);impact({...e,move:({spin:'SPIN THROW',blast:'BLAST',slap:e.pass===1?'SLAP':'LOTA',burst:'BURST',spit:'SPIT'})[e.kind]??'SAFARI',combo:e.pass,blocked:false});$('hit-label').textContent='';}if(e.type==='specialEnd')endSpecialPresentation();if(e.type==='fight'){audience?.cheer();call('FIGHT.',.65);tone(440,.13);}if(e.type==='newRound'){tauntBubble=null;views.forEach(resetCinematicPose);}if(e.type==='newRound')call('ROUND '+match.round,1.6);if(e.type==='jump')tone(180,.1,.02,120);if(e.type==='roundEnd'){if(e.knockout){if(mode!=='online')match.phaseTime=Math.max(match.phaseTime,3.2);playKnockoutVoice();}if(e.knockout)audience?.cheer();call(e.knockout?'K.O.':e.winner===null?'DRAW.':e.winner===0?'ROUND WON.':'ROUND LOST.',2.3);if(!e.knockout)tone(e.winner===0?500:170,.3);}if(e.type==='matchEnd'){playFinishVoice();showResult();}}}
function updateHUD(){for(let i=0;i<2;i++){$('bar'+(i+1)).style.width=match.fighters[i].hp+'%';$('hp'+(i+1)).textContent=match.fighters[i].hp;$('wins'+(i+1)).textContent=Array.from({length:2},(_,n)=>n<match.wins[i]?'◆':'◇').join(' ');}$('timer').textContent=mode==='training'?'∞':String(Math.ceil(match.time)).padStart(2,'0');$('round').textContent=String(match.round).padStart(2,'0');for(let i=0;i<2;i++){let f=match.fighters[i],can=specialReady(f);$('special-bar'+(i+1)).style.width=(can?100:f.meter)+'%';$('special-label'+(i+1)).textContent=f.specialBuffer?'SUPER QUEUED':can?'SUPER READY':f.specialCooldown>0?'RECHARGING':Math.floor(f.meter)+'%';$('special-label'+(i+1)).closest('.special-meter').classList.toggle('ready',can);}$('touch-special').classList.toggle('ready',specialReady(match.fighters[0]));}
async function startGame(){if(!ready||starting||layoutBlocked)return;if(mode==='online'){await readyOnline();return;}starting=true;await audioMixer.resume();const kinds=match?match.roster:[$('player-fighter').value,$('rival-fighter').value];
 try{showRoster(kinds,await Promise.all(kinds.map(templateFor)));}catch(error){notice('Could not load fighter: '+error.message);return;}finally{starting=false;}
fightDialogue.reset();endShowcase();endSpecialPresentation();stopFinish();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));match=createMatch(mode,kinds,true);match.difficulty=selectedDifficulty;paused=false;clearInput();acc=0;document.body.classList.add('in-game');for(let n of ['menu','result','pause-panel','room-panel'])$(n).classList.add('hidden');$('hud').classList.remove('hidden');$('controls').classList.remove('hidden');if(matchMedia('(pointer:coarse)').matches)$('touch').classList.remove('hidden');$('mode-label').textContent=mode==='cpu'?'VS CPU':mode==='local'?'LOCAL VERSUS':mode==='online'?'ONLINE VERSUS':'TRAINING';$('player-name').textContent=roster[kinds[0]].name.toUpperCase();$('opponent-name').textContent=roster[kinds[1]].name.toUpperCase();$('p1-label').textContent='YOU';$('p2-label').textContent=mode==='cpu'?'CPU':mode==='local'?'PLAYER 2':'TRAINING';if(match.presentation)startShowcase();else{call('ROUND 1',1.2);tone(330,.1);}updateHUD();}
function openFront(){openMatchup(mode);}
function openMatchup(nextMode=mode){
 pickSlot=0;mode=nextMode;
 $('menu').classList.remove('hidden');
 for(const button of document.querySelectorAll('[data-mode]')){button.classList.toggle('selected',button.dataset.mode===mode);button.setAttribute('aria-pressed',String(button.dataset.mode===mode));}
 $('room-panel').classList.toggle('hidden',mode!=='online');
 $('start').textContent=mode==='online'?'READY':'FIGHT';
 previewMatchup();
}
function mainMenu(){if(roomClient.session)roomClient.leave().catch(()=>{});roomInfo=null;tauntBubble=null;fightDialogue.reset();endShowcase();endSpecialPresentation();stopFinish();match=null;paused=false;openFront();clearInput();for(let n of ['result','pause-panel','hud','controls','touch'])$(n).classList.add('hidden');document.body.classList.remove('in-game');$('callout').textContent='';$('hit-label').textContent='';}
function setPause(value){if(!match||match.phase==='over')return;if(mode==='online'){roomClient.pause(value).catch(error=>notice(error.message));return;}paused=value;presentations.sync(paused,sound);if(value){specialVoice.pause();audioMixer.stopClips();finishVoice.pause();knockoutVoice.pause();}else if(match.phase==='special'&&voiceTriggered&&sound)audioMixer.playClip('./assets/'+roster[match.special.kind].voice,match.special.time);clearInput();$('pause-panel').classList.toggle('hidden',!value);$('pause').textContent=value?'RESUME':'PAUSE';}
function togglePause(){setPause(!paused);}function showResult(){$('result').classList.remove('hidden');let win=match.winner; $('result-title').textContent=win===null?'DRAW':win===(mode==='online'?networkSeat:0)?'VICTORY':mode==='local'?'PLAYER 2 WINS':'DEFEAT';$('result-eyebrow').textContent=win===(mode==='online'?networkSeat:0)?'YOU WIN':win===null?'DRAW':mode==='local'?'PLAYER 2 WINS':'RIVAL WINS';$('result-copy').textContent=`Final score ${match.wins[0]} — ${match.wins[1]}. ${win===0?'The street is yours.':'One more round?'}`;}
$('start').onclick=startGame;$('rematch').onclick=startGame;$('resume').onclick=()=>setPause(false);$('quit').onclick=mainMenu;$('result-menu').onclick=mainMenu;$('pause').onclick=togglePause;
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=async()=>{
 if(roomClient.session&&button.dataset.mode!=='online')await roomClient.leave();
 roomInfo=null;openMatchup(button.dataset.mode);
};
$('help').onclick=()=>{if(mode==='online'&&match){notice('A/D MOVE / W JUMP / J PUNCH / K KICK / I GRAB / L SUPER / SHIFT GUARD');return;}helpWasPaused=paused;if(match)paused=true;specialVoice.pause();clearInput();$('help-panel').classList.remove('hidden');};function closeHelp(){$('help-panel').classList.add('hidden');paused=helpWasPaused;if(match?.phase==='special'&&voiceTriggered&&!paused&&sound)audioMixer.playClip('./assets/'+roster[match.special.kind].voice,match.special.time);clearInput();}$('help-close').onclick=closeHelp;
function resize(){renderer.setSize(viewport().width,viewport().height);camera.aspect=viewport().width/viewport().height;camera.updateProjectionMatrix();}addEventListener('resize',resize);
async function boot(){
 try{
  const [fighter,car,stands]=await Promise.all([
   loadAsset('fighter','./assets/models/asli-tiger.glb'+assetVersion),
   loadAsset('car','./assets/models/safari-runtime.glb'+assetVersion),
   loadAsset('stands','./assets/models/bleachers.glb'+assetVersion)
  ]);
  arenaManager=createArenaManager(scene,renderer);selectArena(selectedArena,false);
  audience=createBleachers(scene,stands.scene);stageReady=true;
  templates.set('safari',Promise.resolve(fighter));
  showRoster(['safari','safari'],[fighter,fighter]);createCar(car.scene,fighter.scene);
  $('load-status').textContent='Preparing entrance and fight audio';
  await audioMixer.preload([
   ...Object.values(roster).map(f=>'./assets/'+f.voice),
   ...Object.keys(roster).map(kind=>'./assets/entry-'+kind+'.mp3'),
   './assets/battle-music.mp3'
  ]);
  loaded.audio=1;$('load-fill').style.width='100%';
  ready=true;$('loading').classList.add('hidden');mainMenu();updateOrientation();
   for(const kind of Object.keys(roster))templateFor(kind).catch(()=>{});
 }catch(error){
  console.error(error);$('load-status').textContent='Could not load the scene: '+error.message;
  $('loading').querySelector('h2').textContent='LOADING FAILED';
 }
}
const previewFighters=[{x:-1.42,y:0,facing:1,hp:100,state:'idle',walk:0,stun:0,flash:0},{x:1.42,y:0,facing:-1,hp:100,state:'idle',walk:0,stun:0,flash:0}];
function frame(ms){requestAnimationFrame(frame);let dt=Math.min((ms-last)/1000||0,.08);last=ms;if(layoutBlocked)return;if(!paused)globalTime+=dt;if(match&&!paused&&!layoutBlocked&&mode!=='online'){acc+=dt;let steps=0;while(acc>=STEP&&steps++<5){let inputs=[readInput(0),mode==='cpu'&&match.phase==='fight'?cpuInput(match):mode==='local'?readInput(1):{}];handleEvents(advance(match,inputs));pressed.clear();touchPressed.clear();acc-=STEP;}updateHUD();}else if(mode!=='online'||!match||paused){acc=0;attackKeys.forEach(queue=>queue.length=0);pressed.clear();touchPressed.clear();}

 if(mode==='online'&&match&&!paused&&!layoutBlocked){
  networkClock+=dt;
  if(networkClock>=.05){
   networkClock=0;
   if(!networkSending){
    networkSending=true;
    const input=readInput(0);pressed.clear();touchPressed.clear();
    roomClient.input(input).finally(()=>{networkSending=false;});
   }
  }
  updateHUD();
 }
 if(ready){let fs=match?match.fighters:previewFighters;for(let i=0;i<2;i++){const visible=match?.presentation?match.presentation.id===i:!!match||(!!visibleRoster);views[i].root.visible=visible;views[i].disk.visible=false;views[i].shadow.visible=visible;animateFighter(views[i],fs[i],dt);}if(match?.phase==='special')animateSpecial(dt);if(match?.presentation){const shot=match.presentation;const view=views[shot.id];presentations.animate(shot,view,match.phase==='victory',carRoot,driver,carWheels,carDoor);view.shadow.position.x=view.root.position.x;view.shadow.position.z=view.root.position.z;view.shadow.visible=view.root.visible;}if(!paused)audience?.update(globalTime,dt);}
 for(let i=sparks.length-1;i>=0;i--){let s=sparks[i];s.life-=dt;s.v.y-=8*dt;s.mesh.position.addScaledVector(s.v,dt);s.mesh.scale.setScalar(Math.max(0,s.life*3));if(s.life<=0){scene.remove(s.mesh);s.mesh.material.dispose();sparks.splice(i,1);}}
 if(callTimer>0){callTimer-=dt;if(callTimer<=0)$('callout').style.opacity=0;}if(labelTimer>0){labelTimer-=dt;if(labelTimer<=0)$('hit-label').textContent='';}
 const cinematic=match?.phase==='special', closeSpecial=cinematic&&match.special.kind!=='safari';const propSpecial=closeSpecial&&['slap','burst','spit'].includes(match.special.kind);const focus=match?match.fighters.flatMap(f=>f.hp<=0?[f.x,f.x-f.facing*1.9]:[f.x]):[-1.42,1.42];const lo=Math.min(...focus),hi=Math.max(...focus),mid=match?.presentation?0:closeSpecial?match.special.center+(propSpecial?match.special.facing*.52:0):cinematic?0:(lo+hi)/2;let distance=match?.presentation?5.7:closeSpecial?4.8:cinematic?9:hi-lo;let camZ=match?.presentation?5.2:closeSpecial?5.4:cinematic?7:match?6.1:camera.aspect<.85?9:7.0;let fov=match?THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan((distance+2.5)/((cinematic?14:11)*camera.aspect))),camera.aspect>1.65?32:40,78):camera.aspect<.85?56:38;if(match&&!cinematic&&!match.presentation&&camera.aspect<.85)camZ=Math.max(camZ,(distance+2.1)/(2*Math.tan(THREE.MathUtils.degToRad(fov/2))*camera.aspect));const lift=match?.presentation?.kind==='blast'?.44:match&&!cinematic?Math.max(...match.fighters.map(f=>f.y)):0;camera.fov=THREE.MathUtils.lerp(camera.fov,fov+lift*5,.10);camera.updateProjectionMatrix();camera.position.lerp(new THREE.Vector3(mid,cinematic?3.1:match?2.25:1.85,camZ),.07);camera.lookAt(mid,match?1.0+lift*.53:1.03,0);if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake*=.84;if(shake<.002)shake=0;}updateTauntBubble();fightDialogue.update(match,views,driver,paused);
 const battleActive=match&&['fight','special'].includes(match.phase)&&!paused&&!layoutBlocked&&sound;
 if(battleActive){
  if(!audioMixer.isTrackActive('battle'))audioMixer.playTrack('./assets/battle-music.mp3',{channel:'battle',loop:true,volume:.14});
  audioMixer.setTrackVolume('battle',match.phase==='special'?.045:.14);
 }else audioMixer.stopTrack('battle');
 renderer.render(scene,camera);}
boot();requestAnimationFrame(frame);
// Read-only QA snapshot: no external service, account, or telemetry.
window.gameSnapshot=()=>({ready,stageReady,carReady,entranceCar:match?.presentation&&carRoot?.visible?carRoot.position.toArray():null,audience:audience?.count,mode,paused,layoutBlocked,viewport:viewport(),arena:selectedArena,room:roomInfo?{code:roomInfo.code,seat:networkSeat,players:roomInfo.players}:null,preview:!match&&!previewPending?visibleRoster:null,special:match?.special?{kind:match.special.kind,time:match.special.time,hits:match.special.hits,owner:match.special.owner}:null,match:match?{phase:match.phase,presentation:match.presentation?{...match.presentation}:null,round:match.round,wins:[...match.wins],time:match.time,fighters:match.fighters.map(f=>({kind:f.kind,x:f.x,y:f.y,hp:f.hp,state:f.state,attack:f.attack?.name,airborne:f.y>.03,link:f.attack?.link,style:f.attack?.style,hits:f.hits,meter:f.meter,specialReady:specialReady(f)}))}:null,poses:views.map(view=>({height:view.root.position.y,upright:new THREE.Vector3(0,1,0).applyQuaternion(view.root.quaternion).y})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});


function solveArm(view,side,targetLocal,straighten=0){
 const upper=view.bones['upper_arm.'+side]?.bone,lower=view.bones['forearm.'+side]?.bone,hand=view.bones['hand.'+side]?.bone;if(!upper||!lower||!hand)return;
 const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3()),target=view.root.localToWorld(targetLocal.clone());let l1=a.distanceTo(b),l2=b.distanceTo(c),delta=target.clone().sub(a),distance=THREE.MathUtils.clamp(delta.length(),.05,l1+l2-.004),dir=delta.normalize();
 const pole=view.root.localToWorld(new THREE.Vector3(side==='L'?.44:-.44,1.10,.05)).sub(a);let perpendicular=pole.addScaledVector(dir,-pole.dot(dir)).normalize();let along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));const elbow=a.clone().addScaledVector(dir,along).addScaledVector(perpendicular,height);
 const rotate=(bone,from,to)=>{let world=bone.getWorldQuaternion(new THREE.Quaternion()),change=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());world.premultiply(change);let parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.slerp(parent.multiply(world),.85);bone.updateWorldMatrix(false,true);};
 rotate(upper,b.clone().sub(a),elbow.clone().sub(a));let newB=lower.getWorldPosition(new THREE.Vector3()),newC=hand.getWorldPosition(new THREE.Vector3());rotate(lower,newC.sub(newB),target.sub(newB));alignWrist(view,side,straighten);
}
function createCar(model,fighterTemplate){
 carRoot=new THREE.Group();const normalized=new THREE.Group();let box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.position.y-=box.min.y;normalized.add(model);let scale=4.6/Math.max(size.x,size.z);normalized.scale.setScalar(scale);carRoot.add(normalized);
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;let materials=Array.isArray(o.material)?o.material:[o.material];let next=materials.map(mat=>{if(/glass|window|windscreen/i.test(o.name+' '+mat.name))return new THREE.MeshPhysicalMaterial({color:0x9eb8c4,transparent:true,opacity:.16,roughness:.1,metalness:.1,depthWrite:false,side:THREE.DoubleSide});let m=mat.clone();m.roughness=Math.max(.28,m.roughness||.4);for(let value of Object.values(m))if(value?.isTexture)value.anisotropy=renderer.capabilities.getMaxAnisotropy();return m;});o.material=Array.isArray(o.material)?next:next[0];}if(/^wheel_(fr|fl|rr|rl)$/.test(o.name))carWheels.push(o);});
 const door=model.getObjectByName('door_rf_dummy');
 if(door)carDoor={node:door,rest:door.quaternion.clone()};
 scene.add(carRoot);carRoot.visible=false;driver=createView(fighterTemplate,2);driver.disk.visible=false;driver.shadow.visible=false;carRoot.add(driver.root);driver.root.scale.setScalar(.72);driver.root.position.set(.43,.13,-.20);driver.root.rotation.y=Math.PI;driver.root.visible=true;carReady=true;
}
function playSpecialVoice(){
 voiceTriggered=true;
 if(sound)audioMixer.playClip('./assets/'+roster[match.special.kind].voice,mode==='online'?match.special.time:0);
}
function startSpecialPresentation(){
 const {kind}=match.special;
 document.body.classList.add('cinematic');
 $('callout').textContent='';
 $('hit-label').textContent='';
 carRoot.visible=kind==='safari';
 specialVoice.src='./assets/'+roster[kind].voice;
 specialVoice.muted=!sound;finishVoice.muted=!sound;knockoutVoice.muted=!sound;
 playSpecialVoice();
 clearInput();
}
function endSpecialPresentation(){
 document.body.classList.remove('cinematic');
 $('special-banner').classList.add('hidden');
 if(carRoot)carRoot.visible=false;
 for(const puff of gasPuffs)puff.visible=false;
 characterSpecials.reset();
 for(const view of views)setFists(view,1);
 voiceTriggered=false;
 specialVoice.pause();audioMixer.stopClips();
 specialVoice.currentTime=0;
}
function setFists(view,value){
 view.model.traverse(o=>{
  for(const [name,index] of Object.entries(o.morphTargetDictionary??{}))
   if(name.startsWith('Fist_'))o.morphTargetInfluences[index]=value;
 });
}
function resetCinematicPose(view){
 for(const {bone,base,restScale} of Object.values(view.bones)){bone.quaternion.copy(base);bone.scale.copy(restScale);}
}
function groundEffects(view){
 view.disk.visible=false;
 view.shadow.position.x=view.root.position.x;
 view.shadow.position.z=view.root.position.z;
}
function landingPose(view,s,fromX,fromY,fromZ,airtime,height,releaseRotation){
 const impact=s.launchAt??SPECIALS[s.kind].impacts[0];
 const progress=THREE.MathUtils.clamp((s.time-impact)/airtime,0,1);
 const recovery=match.fighters[s.target].hp>0?THREE.MathUtils.smoothstep(s.time,impact+airtime, SPECIALS[s.kind].duration-.06):0;
 const yaw=-s.facing*Math.PI/2;
 view.root.position.set(THREE.MathUtils.lerp(fromX,specialLanding(s),progress),
  THREE.MathUtils.lerp(fromY,.22,progress)+height*Math.sin(Math.PI*progress)-.16*recovery,
  fromZ*(1-progress));
 view.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
 view.root.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2*(releaseRotation?1:progress)*(1-recovery)));
 if(releaseRotation)view.root.quaternion.slerp(releaseRotation,1-progress);
}
function animateSpin(s,owner,victim){
 const {time:t,facing:dir,center}=s, yaw=dir*Math.PI/2;
 const grab=THREE.MathUtils.smoothstep(t,.68,1.34);
 const spin=THREE.MathUtils.clamp((t-1.34)/(SPECIALS.spin.impacts[0]-1.34),0,1);
 const angle=yaw+dir*3*Math.PI*2*spin;
 const ownerX=center-dir*.42;
 owner.root.position.set(THREE.MathUtils.lerp(s.ownerX,ownerX,THREE.MathUtils.smoothstep(t,.52,1.30)),.06,0);
 owner.root.rotation.set(0,t<1.34?yaw*grab:angle,0);
 resetCinematicPose(owner);
 setFists(owner,grab);
 pose(owner,'chest',-.12*(1-grab),-.08*grab,.11*(1-grab));
 owner.root.updateMatrixWorld(true);
 const release=THREE.MathUtils.smoothstep(t,3.40,4.08);
 const arms=grab*(1-release);
 solveArm(owner,'L',new THREE.Vector3(THREE.MathUtils.lerp(.78,.17,arms),1.45,.13+arms*.46));
 solveArm(owner,'R',new THREE.Vector3(-THREE.MathUtils.lerp(.78,.17,arms),1.45,.13+arms*.46));
 const radius=.78, lift=.38*Math.sin(spin*Math.PI);
 if(t<SPECIALS.spin.impacts[0]){
  const pull=THREE.MathUtils.smoothstep(t,.69,1.34);
  victim.root.position.set(THREE.MathUtils.lerp(s.targetX,ownerX+Math.sin(angle)*radius,pull),.06+lift,Math.cos(angle)*radius*pull);
  victim.root.rotation.set(-.17*pull,angle+Math.PI,0);
  if(t>=.69){
   resetCinematicPose(victim);
   pose(victim,'thigh.L',-.44*pull,0,0);
   pose(victim,'thigh.R',-.27*pull,0,0);
   pose(victim,'shin.L',.55*pull,0,0);
   pose(victim,'shin.R',.40*pull,0,0);
  }
 }else{
  resetCinematicPose(victim);
  landingPose(victim,s,ownerX+dir*radius,.06,0,.82,.92);
 }
}
const gasPuffs=[];
const characterSpecials=createCharacterSpecials(scene,{pose,solveArm,setFists,resetPose:resetCinematicPose,landingPose});
function animateGas(s,x){
 const elapsed=s.time-SPECIALS.blast.impacts[0];
 if(elapsed<0)return;
 if(gasPuffs.length===0){
  const geometry=new THREE.SphereGeometry(1,10,8);
  for(let i=0;i<12;i++){
   const puff=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:i%2?0x9ac756:0xb5a750,transparent:true,depthWrite:false}));
   gasPuffs.push(puff);
   scene.add(puff);
  }
 }
 for(const [i,puff] of gasPuffs.entries()){
  const age=elapsed-i*.027;
  puff.visible=age>=0&&age<.75;
  if(!puff.visible)continue;
  puff.position.set(x+s.facing*(.19+age*2.05),.77+age*.58+Math.sin(i*2.2)*.13,Math.cos(i*1.4)*(.07+age*.38));
  puff.scale.setScalar(.08+age*.32);
  puff.material.opacity=.56*(1-age/.75);
 }
}
function animateBlast(s,owner,victim){
 const {time:t,facing:dir,center}=s,yaw=dir*Math.PI/2;
 const turn=THREE.MathUtils.smoothstep(t,.10,.70)*(1-THREE.MathUtils.smoothstep(t,1.92,2.72));
 const sit=THREE.MathUtils.smoothstep(t,.60,1.24)*(1-THREE.MathUtils.smoothstep(t,1.64,2.12));
 const pulse=Math.max(0,1-Math.abs(t-1.45)*8);
 const ownerX=center-dir*.42;
 const x=THREE.MathUtils.lerp(s.ownerX,ownerX,THREE.MathUtils.smoothstep(t,0,.80))+dir*(.16*sit+.10*pulse);
 owner.root.position.set(x,.06-.22*sit,0);
 owner.root.rotation.set(0,yaw+dir*Math.PI*turn,0);
 resetCinematicPose(owner);
 pose(owner,'chest',.66*sit,0,0,1);
 pose(owner,'head',-.27*sit,0,0,1);
 for(const side of ['L','R']){
  pose(owner,'thigh.'+side,-.97*sit,0,0,1);
  pose(owner,'shin.'+side,1.43*sit,0,0,1);
  pose(owner,'upper_arm.'+side,-.48*sit,0,0);
  pose(owner,'forearm.'+side,-.71*sit,0,0);
 }
 const victimX=center+dir*.56;
 if(t<SPECIALS.blast.impacts[0]){
  victim.root.position.x=THREE.MathUtils.lerp(s.targetX,victimX,THREE.MathUtils.smoothstep(t,.16,.91));
  victim.root.rotation.set(0,-yaw,0);
 }else{
  resetCinematicPose(victim);
  landingPose(victim,s,victimX,.06,0,.59,.52);
 }
 animateGas(s,x);
}
function animateSpecial(dt){
 const s=match.special;if(!s)return;
 if(s.kind!=='safari'){
  const owner=views[s.owner],victim=views[s.target];
  if(s.kind==='spin')animateSpin(s,owner,victim);
  else if(s.kind==='blast')animateBlast(s,owner,victim);
  else characterSpecials.animate(s,owner,victim);
  groundEffects(owner);groundEffects(victim);return;
 }
 if(!carRoot)return;
 let t=s.time,dir=s.facing,carX=-dir*9,travel=dir;
 // Entry, three alternating arcade passes, then departure. Hit timings match combat.js.
 if(t<1.4)carX=THREE.MathUtils.lerp(-dir*9,-dir*3.7,THREE.MathUtils.smoothstep(t,0,1.4));
 else if(t<2)carX=-dir*3.7;
 else if(t<3.1){carX=THREE.MathUtils.lerp(-dir*7,dir*7,(t-2)/1.1);travel=dir;}
 else if(t<3.3){carX=dir*7;travel=-dir;}
 else if(t<4.4){carX=THREE.MathUtils.lerp(dir*7,-dir*7,(t-3.3)/1.1);travel=-dir;}
 else if(t<4.6){carX=-dir*7;travel=dir;}
 else if(t<5.7){carX=THREE.MathUtils.lerp(-dir*7,dir*7,(t-4.6)/1.1);travel=dir;}
 else carX=dir*(7+(t-5.7)*6);
 carRoot.position.set(carX,.06+Math.sin(t*24)*.008,.05);carRoot.rotation.y=travel>0?-Math.PI/2:Math.PI/2;
 for(let wheel of carWheels)wheel.rotation.x+=dt*(t<2?2:32)*travel;
 views[s.owner].root.visible=false;views[s.owner].disk.visible=false;views[s.owner].shadow.visible=false;let victim=views[s.target];victim.root.position.x=0;victim.disk.position.x=0;victim.shadow.position.x=0;
 if(s.hits>0){victim.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),match.fighters[s.target].facing>0?Math.PI/2:-Math.PI/2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));victim.root.position.y=.13+Math.abs(Math.sin(t*8))*.05;}
 for(let n in driver.bones)pose(driver,n,0,0,0);for(let side of ['L','R']){pose(driver,'thigh.'+side,-1.45,0,0);pose(driver,'shin.'+side,1.45,0,0);pose(driver,'upper_arm.'+side,-.3,side==='L'?-1:1,0);pose(driver,'forearm.'+side,-1.2,0,0);}pose(driver,'chest',.08,0,0);driver.root.updateMatrixWorld(true);
}

function updateTauntBubble(){
 const bubble=$('taunt-bubble');
 const fighter=tauntBubble&&match?.fighters[tauntBubble.id];
 if(!fighter?.taunt||(match.phase!=='fight'&&!['throw','dhobi','signature'].includes(match.special?.kind))){
  bubble.classList.add('hidden');
  return;
 }
 const move=signatureMoves[tauntBubble.kind];
 bubble.querySelector('strong').textContent=move.name;
 bubble.querySelector('span').textContent=move.line;
 const head=views[tauntBubble.id].bones.head.bone.getWorldPosition(new THREE.Vector3());
 head.y+=.40;
 head.project(camera);
 bubble.style.left=THREE.MathUtils.clamp((head.x+1)*50,15,85)+'%';
 bubble.style.top=THREE.MathUtils.clamp((1-head.y)*50,23,76)+'%';
 bubble.classList.remove('hidden');
}
function alignWrist(view,side,straighten){
 const binding=view.bones['hand.'+side],lower=view.bones['forearm.'+side].bone,hand=binding.bone;
 const rotation=hand.getWorldQuaternion(new THREE.Quaternion());
 const axis=hand.getWorldPosition(new THREE.Vector3()).sub(lower.getWorldPosition(new THREE.Vector3())).normalize();
 if(straighten>0){
  const handAxis=new THREE.Vector3(0,1,0).applyQuaternion(rotation);
  const delta=new THREE.Quaternion().setFromUnitVectors(handAxis,axis);
  rotation.slerp(delta.multiply(rotation.clone()),straighten*.85);
 }
 const palm=new THREE.Vector3(0,0,1).applyQuaternion(binding.world.clone().invert()).applyQuaternion(rotation);
 const desired=new THREE.Vector3(0,0,-1).applyQuaternion(view.root.getWorldQuaternion(new THREE.Quaternion()));
 palm.addScaledVector(axis,-palm.dot(axis)).normalize();
 desired.addScaledVector(axis,-desired.dot(axis)).normalize();
 const angle=Math.atan2(axis.dot(palm.clone().cross(desired)),palm.dot(desired));
 rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));
 const parent=hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 hand.quaternion.slerp(parent.multiply(rotation),.8);
 hand.updateWorldMatrix(false,true);
}
let noticeTimeout;
function notice(text){$('notice').textContent=text;$('notice').classList.remove('hidden');clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>$('notice').classList.add('hidden'),2500);}

let networkSending=false;
const roomClient=createRoomClient({
 onState:receiveRoom,
 onError:text=>{if(mode==='online'){$('room-error').textContent=text;if(match){paused=true;$('pause-panel').classList.remove('hidden');$('pause-panel').querySelector('h2').textContent='RECONNECTING';}}},
 onClose:text=>{roomInfo=null;mainMenu();notice(text);}
});
function selectArena(id,notify=true){
 selectedArena=ARENAS.some(arena=>arena.id===id)?id:'filmcity';
 const info=arenaManager?.select(selectedArena)||ARENAS.find(arena=>arena.id===selectedArena);
 for(const button of document.querySelectorAll('[data-arena]')){
  button.classList.toggle('selected',button.dataset.arena===selectedArena);
  button.setAttribute('aria-pressed',String(button.dataset.arena===selectedArena));
 }
 $('location').textContent=info.name;
 $('menu').querySelector('.matchup-arena').textContent=info.name;
 if(notify&&roomClient.session&&networkSeat===0)roomClient.select({arena:selectedArena}).catch(error=>notice(error.message));
}
for(const button of document.querySelectorAll('[data-arena]'))button.onclick=()=>{
 if(roomClient.session&&networkSeat!==0){notice('The room creator selects the arena.');return;}
 selectArena(button.dataset.arena);
};
function showRoomSession(){
 const session=roomClient.session;
 $('room-connect').hidden=!!session;
 $('room-session').hidden=!session;
 $('room-code-label').textContent=session?.code||'';
 $('room-error').textContent='';
}
async function roomAction(action){
 try{
  $('room-error').textContent='';
  audioMixer.resume();
  const data=await roomClient[action]({
   code:$('room-code').value.trim().toUpperCase(),
   fighter:$('player-fighter').value,arena:selectedArena
  });
  networkSeat=data.seat;roomInfo=data.room;showRoomSession();
 }catch(error){$('room-error').textContent=error.message;}
}
$('room-create').onclick=()=>roomAction('create');
$('room-join').onclick=()=>roomAction('join');
$('room-code').onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();roomAction('join');}};
$('room-close').onclick=()=>$('room-panel').classList.add('hidden');
$('room-leave').onclick=async()=>{await roomClient.leave();roomInfo=null;showRoomSession();};
$('room-copy').onclick=async()=>{
 try{await navigator.clipboard.writeText(roomClient.session.code);notice('Room code copied.');}
 catch{notice('Room code: '+roomClient.session.code);}
};
async function receiveRoom(packet,session){
 roomInfo=packet.room;networkSeat=session.seat;
 $('room-error').textContent='';
 showRoomSession();
 const players=packet.room.players;
 $('room-status').textContent=!players[1]?'Waiting for another fighter. Share this code.':
  players.every(p=>p.ready)?'Both fighters ready. Loading match.':
  players[session.seat]?.ready?'READY. Waiting for your opponent.':'Both fighters connected. Choose your fighter, then press READY.';
 if(!packet.match){
  if(match&&mode==='online'){
   match=null;document.body.classList.remove('in-game');$('menu').classList.remove('hidden');
   for(const id of ['hud','controls','result','pause-panel','touch'])$(id).classList.add('hidden');
   $('room-panel').classList.remove('hidden');clearInput();endSpecialPresentation();fightDialogue.reset();
  }
  const old=selectedRoster().join(',');
  players.forEach((p,index)=>{if(p)$(index?'rival-fighter':'player-fighter').value=p.fighter;});
  if(packet.room.arena!==selectedArena)selectArena(packet.room.arena,false);
  if(old!==selectedRoster().join(','))previewMatchup();
  return;
 }
 if(!match){
  if(onlineLoading)return;
  onlineLoading=(async()=>{
   const kinds=packet.match.roster;
   const assets=await Promise.all(kinds.map(templateFor));
   if(roomClient.session?.code!==session.code)return;
   showRoster(kinds,assets);selectArena(packet.room.arena,false);
   fightDialogue.reset();endShowcase();endSpecialPresentation();stopFinish();
   mode='online';lastRemoteTick=-1;match=packet.match;clearInput();paused=false;if(layoutBlocked)roomClient.pause(true).catch(()=>{});
   document.body.classList.add('in-game');
   for(const id of ['menu','room-panel','result','pause-panel'])$(id).classList.add('hidden');
   $('hud').classList.remove('hidden');$('controls').classList.remove('hidden');
   if(matchMedia('(pointer:coarse)').matches)$('touch').classList.remove('hidden');
   $('player-name').textContent=roster[kinds[0]].name.toUpperCase();
   $('opponent-name').textContent=roster[kinds[1]].name.toUpperCase();
   $('p1-label').textContent=networkSeat===0?'YOU':'RIVAL';
   $('p2-label').textContent=networkSeat===1?'YOU':'RIVAL';
   $('mode-label').textContent='ONLINE VERSUS';
  })();
  try{await onlineLoading;}catch(error){notice(error.message);}finally{onlineLoading=null;}
 }
 if(!match)return;
 const wasPaused=paused;
 paused=packet.room.paused;
 $('pause').textContent=paused?'RESUME':'PAUSE';
 $('pause-panel').classList.toggle('hidden',!paused);
 if(paused){
  $('pause-panel').querySelector('h2').textContent=packet.room.reason.includes('disconnect')?'WAITING FOR RIVAL':'PAUSED';
  if(!wasPaused)audioMixer.stopClips();
 }else if(wasPaused&&match.phase==='special'&&sound){
  audioMixer.playClip('./assets/'+roster[match.special.kind].voice,match.special.time);
 }
 if(packet.match.tick<=lastRemoteTick)return;
 match=packet.match;lastRemoteTick=match.tick;
 handleEvents(packet.events||[]);updateHUD();
}
async function readyOnline(){
 audioMixer.resume();
 if(!roomClient.session){$('room-panel').classList.remove('hidden');return;}
 try{
  $('start').disabled=true;
  const kinds=roomInfo.players.filter(Boolean).map(p=>p.fighter);
  await Promise.all(kinds.map(templateFor));
  await roomClient.ready();
 }catch(error){notice(error.message);}finally{$('start').disabled=false;}
}
let touchWasPaused=false;
setupTouchControls({beforeOpen(){touchWasPaused=paused;if(match&&!paused)setPause(true);$('pause-panel').classList.add('hidden');clearInput();},afterClose(){if(match&&!touchWasPaused)setPause(false);}});
document.addEventListener('pointerdown',()=>audioMixer.resume());

function updateOrientation(){
 const mobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
 const blocked=mobile&&innerHeight>innerWidth;
 $('rotate-device').hidden=!blocked;
 document.body.classList.toggle('mobile-device',mobile);document.documentElement.classList.toggle('portrait-gate',blocked);
 if(blocked&&!layoutBlocked){
  orientationWasPaused=paused;layoutBlocked=true;clearInput();
  if(match&&match.phase!=='over'&&!paused)setPause(true);
 }else if(!blocked&&layoutBlocked){
  layoutBlocked=false;
  if(match&&match.phase!=='over'&&!orientationWasPaused)setPause(false);
 }
 requestAnimationFrame(resize);
}
addEventListener('resize',updateOrientation);
addEventListener('orientationchange',updateOrientation);visualViewport?.addEventListener('resize',updateOrientation);
updateOrientation();
