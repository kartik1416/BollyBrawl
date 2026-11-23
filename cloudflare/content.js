import {MEDIA_SLOTS} from '../media-slots.js';
import {ADMIN_VERIFIER} from './admin-verifier.js';
const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
const unhex=text=>Uint8Array.from(text.match(/../g),n=>parseInt(n,16));
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const error=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const CHUNK=64*1024,MAX=8*1024*1024;
export async function routeContent(request,env){
 if(!env.CONTENT)return json({error:'Content editor storage is not configured.'},503);
 return env.CONTENT.get(env.CONTENT.idFromName('site-content')).fetch(request);
}
export class SiteContent{
 constructor(ctx){this.ctx=ctx;}
 async fetch(request){
  try{
   const url=new URL(request.url),path=url.pathname;
   if(path==='/api/content')return json({overrides:await this.ctx.storage.get('overrides')||{}});
   if(path.startsWith('/media/'))return await this.media(request,path.slice(7));
   if(request.method!=='GET'&&request.headers.get('Origin')!==url.origin)error('Request origin rejected.',403);
   if(path==='/api/admin/login'){
    if(request.method!=='POST')error('Method not allowed',405);
    const ip=request.headers.get('CF-Connecting-IP')||'local',key='attempt:'+hex(await crypto.subtle.digest('SHA-256',encoder.encode(ip)));
    let attempts=await this.ctx.storage.get(key)||{count:0,until:Date.now()+900000};
    if(attempts.until<Date.now())attempts={count:0,until:Date.now()+900000};
    if(attempts.count>=5)error('Too many attempts. Try again in 15 minutes.',429);
    attempts.count++;await this.ctx.storage.put(key,attempts);
    const body=await this.body(request);
    const material=await crypto.subtle.importKey('raw',encoder.encode(String(body.password||'')),'PBKDF2',false,['deriveBits']);
    const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(ADMIN_VERIFIER.salt),iterations:100000,hash:'SHA-256'},material,256));
    let mismatch=hash.length^ADMIN_VERIFIER.hash.length;for(let i=0;i<hash.length;i++)mismatch|=hash.charCodeAt(i)^ADMIN_VERIFIER.hash.charCodeAt(i);
    if(body.username!=='Admin'||mismatch)error('Incorrect username or password.',401);
    await this.ctx.storage.delete(key);
    const token=hex(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+8*3600000;
    const sessions=await this.ctx.storage.list({prefix:'session:'});for(const [k,v] of sessions)if(v< Date.now())await this.ctx.storage.delete(k);
    await this.ctx.storage.put('session:'+token,expires);
    return json({ok:true},200,{'Set-Cookie':this.cookie(token,url,8*3600)});
   }
   const token=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)bb_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
   if(!token||(await this.ctx.storage.get('session:'+token)||0)<Date.now())error('Please sign in.',401);
   if(path==='/api/admin/logout'){
    if(request.method!=='POST')error('Method not allowed',405);
    await this.ctx.storage.delete('session:'+token);return json({ok:true},200,{'Set-Cookie':this.cookie('',url,0)});
   }
   if(path==='/api/admin/state'&&request.method==='GET')return json({slots:MEDIA_SLOTS,overrides:await this.ctx.storage.get('overrides')||{}});
   if(path==='/api/admin/upload'&&request.method==='POST'){
    const slot=url.searchParams.get('slot'),spec=MEDIA_SLOTS[slot];if(!spec)error('Unknown media slot.');
    if(Number(request.headers.get('content-length'))>MAX)error('Maximum upload size is 8 MB.',413);
    const reader=request.body?.getReader();if(!reader)error('Empty upload.');
    let size=0;const pieces=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX){await reader.cancel();error('Maximum upload size is 8 MB.',413);}pieces.push(value);}
    if(!size)error('Empty upload.');const bytes=new Uint8Array(size);let offset=0;for(const part of pieces){bytes.set(part,offset);offset+=part.length;}
    const mime=this.detect(bytes);if(!mime.startsWith(spec.type+'/'))error('The file does not match this slot. Use PNG, JPEG, WebP, MP3, WAV or OGG.');
    const id=crypto.randomUUID(),count=Math.ceil(size/CHUNK),prefix='media:'+id;
    const chunks={};for(let i=0;i<count;i++)chunks[prefix+':'+i]=bytes.slice(i*CHUNK,(i+1)*CHUNK).buffer;
    let old;
    await this.ctx.storage.transaction(async storage=>{
     old=await storage.get('overrides')||{};const previous=old[slot]?.id;
     await storage.put(chunks);await storage.put(prefix,{mime,size,count});
     old[slot]={id,url:'/media/'+id,mime,size,updated:Date.now()};await storage.put('overrides',old);
     if(previous)await this.remove(storage,previous);
    });
    return json({ok:true,overrides:old});
   }
   if(path==='/api/admin/reset'&&request.method==='POST'){
    const {slot}=await this.body(request);if(!MEDIA_SLOTS[slot])error('Unknown media slot.');
    await this.ctx.storage.transaction(async storage=>{const overrides=await storage.get('overrides')||{};if(overrides[slot])await this.remove(storage,overrides[slot].id);delete overrides[slot];await storage.put('overrides',overrides);});return json({ok:true});
   }
   error('Not found',404);
  }catch(e){return json({error:e.status?e.message:'Content service failed. Please retry.'},e.status||500);}
 }
 cookie(token,url,age){return `bb_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${age}${url.protocol==='https:'?'; Secure':''}`;}
 async body(request){const text=await request.text();if(text.length>2048)error('Request too large',413);try{return JSON.parse(text);}catch{error('Invalid JSON');}}
 detect(b){const ascii=(n,start=0)=>String.fromCharCode(...b.slice(start,start+n));if(b[0]===137&&ascii(3,1)==='PNG')return 'image/png';if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(ascii(4)==='RIFF'&&ascii(4,8)==='WEBP')return 'image/webp';if(ascii(3)==='ID3'||(b[0]===255&&(b[1]&224)===224))return 'audio/mpeg';if(ascii(4)==='RIFF'&&ascii(4,8)==='WAVE')return 'audio/wav';if(ascii(4)==='OggS')return 'audio/ogg';return '';}
 async remove(storage,id){const key='media:'+id,meta=await storage.get(key);if(meta){await storage.delete(Array.from({length:meta.count},(_,i)=>key+':'+i));await storage.delete(key);}}
 async media(request,id){
  if(!/^[a-f0-9-]{36}$/.test(id))error('Not found',404);
  const meta=await this.ctx.storage.get('media:'+id);if(!meta)error('Not found',404);
  const headers={'Content-Type':meta.mime,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','ETag':'"'+id+'"'};
  let start=0,end=meta.size-1,status=200;const range=request.headers.get('Range');
  if(range){const match=range.match(/^bytes=(\d+)-(\d*)$/);if(!match)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+meta.size}});start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+meta.size}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${meta.size}`;}
  headers['Content-Length']=String(end-start+1);if(request.method==='HEAD')return new Response(null,{status,headers});
  const first=Math.floor(start/CHUNK),last=Math.floor(end/CHUNK),keys=Array.from({length:last-first+1},(_,i)=>'media:'+id+':'+(first+i));
  const parts=await this.ctx.storage.get(keys),bytes=new Uint8Array((last-first+1)*CHUNK);for(let i=0;i<keys.length;i++)bytes.set(new Uint8Array(parts.get(keys[i])),i*CHUNK);
  return new Response(bytes.slice(start-first*CHUNK,end-first*CHUNK+1),{status,headers});
 }
}
