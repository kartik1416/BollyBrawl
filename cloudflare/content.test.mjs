// Integration: ADMIN_TEST_PASSWORD=<configured password> node cloudflare/content.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.CONTENT_TEST_URL||'http://127.0.0.1:8802';
if(!process.env.ADMIN_TEST_PASSWORD)throw Error('Set ADMIN_TEST_PASSWORD for the editor integration test.');
let cookie='';
async function call(path,options={}){return fetch(base+path,{...options,headers:{Origin:base,Cookie:cookie,...options.headers}});}
const denied=await call('/api/admin/state');assert.equal(denied.status,401);
const csrf=await fetch(base+'/api/admin/login',{method:'POST',body:'{}'});assert.equal(csrf.status,403);
const bad=await call('/api/admin/login',{method:'POST',body:JSON.stringify({username:'Admin',password:'incorrect'})});assert.equal(bad.status,401);
const login=await call('/api/admin/login',{method:'POST',body:JSON.stringify({username:'Admin',password:process.env.ADMIN_TEST_PASSWORD})});assert.equal(login.status,200,await login.clone().text());
assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);cookie=login.headers.get('set-cookie').split(';')[0];
const state=await(await call('/api/admin/state')).json();assert.ok(state.slots['special-safari']);
for(const [slot,file] of [['special-safari','assets/special-voice.mp3'],['wordmark','assets/ui/bollybrawl-wordmark.webp']]){
 const original=await fs.readFile(file);
 const upload=await call('/api/admin/upload?slot='+slot,{method:'POST',body:original});assert.equal(upload.status,200,await upload.clone().text());
 const config=await(await fetch(base+'/api/content')).json(),url=config.overrides[slot].url;
 const served=await fetch(base+url);assert.deepEqual(Buffer.from(await served.arrayBuffer()),original);
 const range=await fetch(base+url,{headers:{Range:'bytes=0-15'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),original.subarray(0,16));
 const reset=await call('/api/admin/reset',{method:'POST',body:JSON.stringify({slot})});assert.equal(reset.status,200);
 assert.equal((await fetch(base+url)).status,404);
}
const wrong=await call('/api/admin/upload?slot=wordmark',{method:'POST',body:await fs.readFile('assets/special-voice.mp3')});assert.equal(wrong.status,400);
assert.equal((await call('/api/admin/logout',{method:'POST'})).status,200);assert.equal((await call('/api/admin/state')).status,401);
console.log('Content editor passed: authentication, CSRF, audio/image uploads, public delivery, range requests, restore, type validation and logout.');
