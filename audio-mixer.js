export function createAudioMixer(){
 const context=new AudioContext();
 const master=context.createGain();
 const limiter=context.createDynamicsCompressor();
 limiter.threshold.value=-6;
 limiter.knee.value=8;
 limiter.ratio.value=12;
 limiter.attack.value=.004;
 limiter.release.value=.18;
 master.gain.value=.78;
 master.connect(limiter).connect(context.destination);
 const clips=new Map(),elements=new WeakMap(),buffers=new Map(),levels=new Map(),starts=new Map(),activeSources=new Set();
 const absolute=url=>new URL(url,location.href).href;
 async function measure(url){
  url=absolute(url);
  if(!clips.has(url))clips.set(url,(async()=>{
   const response=await fetch(url);
   if(!response.ok)throw new Error('Audio load failed');
   const buffer=await context.decodeAudioData(await response.arrayBuffer());
   buffers.set(url,buffer);
   let onset=0;
   for(;onset<buffer.length;onset+=256){
    let audible=false;
    for(let channel=0;channel<buffer.numberOfChannels&&!audible;channel++){
     const data=buffer.getChannelData(channel);
     for(let i=onset;i<Math.min(onset+256,buffer.length);i++)
      if(Math.abs(data[i])>.003){audible=true;break;}
    }
    if(audible)break;
   }
   starts.set(url,Math.max(0,onset/buffer.sampleRate-.005));
   let sum=0,count=0;
   for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const samples=buffer.getChannelData(channel);
    for(let offset=0;offset<samples.length;offset+=2048){
     let power=0;
     const end=Math.min(offset+2048,samples.length);
     for(let i=offset;i<end;i++){power+=samples[i]*samples[i];}
     if(power/(end-offset)>.0001){sum+=power;count+=end-offset;}
    }
   }
   const rms=Math.sqrt(sum/Math.max(1,count));
   const level=Math.min(8,.125/Math.max(.01,rms));
   levels.set(url,level);return level;
  })());
  return clips.get(url);
 }
 function attach(element,role='voice'){
  if(elements.has(element))return;
  const gain=context.createGain();
  const source=context.createMediaElementSource(element);
  const compressor=context.createDynamicsCompressor();
  compressor.threshold.value=-15;
  compressor.knee.value=10;
  compressor.ratio.value=3;
  compressor.attack.value=.008;
  compressor.release.value=.18;
  source.connect(gain).connect(compressor).connect(master);
  elements.set(element,{gain,role});
  element.volume=1;
  const balance=()=>{
   const url=element.currentSrc||element.src;
   gain.gain.value=role==='music'?.45:.72;
   measure(url).then(level=>{
    if(url===(element.currentSrc||element.src))gain.gain.setTargetAtTime(level*(role==='music'?.80:1),context.currentTime,.08);
   }).catch(()=>{});
  };
  element.addEventListener('loadedmetadata',balance);
  element.addEventListener('play',()=>{context.resume();balance();});
  if(element.src)balance();
 }
 const tracks=new Map();
 function stopTrack(channel){
  const track=tracks.get(channel);tracks.delete(channel);
  if(track?.source)try{track.source.stop();}catch{}
 }
 function playTrack(url,{channel='special',offset=0,loop=false,volume=1}={}){
  stopTrack(channel);
  const track={volume,source:null,gain:null};tracks.set(channel,track);
  url=absolute(url);
  const start=()=>{
   if(tracks.get(channel)!==track)return;
   const buffer=buffers.get(url),begin=offset+(starts.get(url)||0);
   if(begin>=buffer.duration){tracks.delete(channel);return;}
   const source=context.createBufferSource(),gain=context.createGain();
   track.source=source;track.gain=gain;track.level=levels.get(url)||1;
   source.buffer=buffer;source.loop=loop;gain.gain.value=track.level*track.volume;
   source.connect(gain).connect(master);
   source.onended=()=>{source.disconnect();gain.disconnect();if(tracks.get(channel)===track)tracks.delete(channel);};
   source.start(context.currentTime,Math.max(0,begin));
  };
  Promise.all([context.resume(),measure(url)]).then(start).catch(()=>{if(tracks.get(channel)===track)tracks.delete(channel);clips.delete(url);});
 }
 function setTrackVolume(channel,volume){const track=tracks.get(channel);if(track){track.volume=volume;if(track.gain)track.gain.gain.setTargetAtTime(track.level*volume,context.currentTime,.08);}}
 return {context,output:master,attach,playTrack,stopTrack,setTrackVolume,isTrackActive:channel=>tracks.has(channel),playClip:(url,offset=0)=>playTrack(url,{offset}),stopClips:()=>stopTrack('special'),preload:urls=>Promise.all(urls.map(measure)),resume(){return context.resume();}};


}
