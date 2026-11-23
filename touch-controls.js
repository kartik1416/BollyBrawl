export function setupTouchControls({beforeOpen,afterClose}){
 const $=id=>document.getElementById(id),key='bollybrawl.touch.v1';
 const defaults={size:1,opacity:.85,leftHanded:false},settings={...defaults};
 try{Object.assign(settings,JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
 function apply(){
  settings.size=Math.max(.8,Math.min(1.25,Number(settings.size)||1));settings.opacity=Math.max(.35,Math.min(1,Number(settings.opacity)||.85));
  document.documentElement.style.setProperty('--touch-scale',settings.size);document.documentElement.style.setProperty('--touch-opacity',settings.opacity);
  document.body.classList.toggle('left-handed',settings.leftHanded===true);
  $('touch-size').value=settings.size;$('touch-opacity').value=settings.opacity;$('touch-left-handed').checked=settings.leftHanded===true;
  $('touch-size-value').textContent=Math.round(settings.size*100)+'%';$('touch-opacity-value').textContent=Math.round(settings.opacity*100)+'%';
  try{localStorage.setItem(key,JSON.stringify(settings));}catch{}
 }
 $('touch-size').oninput=e=>{settings.size=Number(e.target.value);apply();};
 $('touch-opacity').oninput=e=>{settings.opacity=Number(e.target.value);apply();};
 $('touch-left-handed').onchange=e=>{settings.leftHanded=e.target.checked;apply();};
 $('touch-reset').onclick=()=>{Object.assign(settings,defaults);apply();};
 $('touch-config').onclick=()=>{beforeOpen();$('touch-settings').classList.remove('hidden');};
 $('touch-settings-close').onclick=()=>{$('touch-settings').classList.add('hidden');afterClose();};
 $('fullscreen').onclick=async()=>{
  const target=document.documentElement;
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(target.requestFullscreen){await target.requestFullscreen();try{await screen.orientation?.lock('landscape');}catch{}}else $('fullscreen-tip').textContent='On iPhone, hide the browser toolbar or use Add to Home Screen for more space.';}
  catch{$('fullscreen-tip').textContent='Use your browser’s full-screen option or Add to Home Screen.';}
 };
 apply();
}
