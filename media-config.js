import {MEDIA_SLOTS} from './media-slots.js';
let overrides={};
export function resolveAsset(value){
 const url=new URL(value,location.href);
 if(url.origin!==location.origin)return value;
 const slot=Object.keys(MEDIA_SLOTS).find(key=>MEDIA_SLOTS[key].path===url.pathname);
 return slot&&overrides[slot]?.url||value;
}
export async function initMediaConfig(){
 try{
  const response=await fetch('/api/content',{cache:'no-store',signal:AbortSignal.timeout(4500)});
  if(response.ok)overrides=(await response.json()).overrides||{};
 }catch{} // Static/local hosts use the original assets.
 for(const img of document.querySelectorAll('img[src]'))img.src=resolveAsset(img.src);
 const selectors={safari:'.fighter-photo',spin:'.jon-photo',blast:'.tiger-photo',slap:'.baburao-photo',burst:'.bawa-photo',spit:'.vimal-photo'};
 const style=document.createElement('style');
 for(const [kind,selector] of Object.entries(selectors))if(overrides['portrait-'+kind])style.textContent+=`${selector}{background-image:url("${overrides['portrait-'+kind].url}")!important}`;
 for(const arena of ['filmcity','akhada','cinema'])if(overrides[arena])style.textContent+=`.arena-card[data-arena=${arena}]{background-image:url("${overrides[arena].url}")!important}`;
 document.head.append(style);
}
