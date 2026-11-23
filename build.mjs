import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,'dist');
// Clear only our generated output, never the source assets.
if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Invalid output directory');
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
const files=['index.html','mobile-shell.js','touch-controls.js','admin.html','admin.js','admin.css','media-slots.js','media-config.js','style.css','main.js','combat.js','fight-motion.js','character-specials.js','fighter-presentations.js','entrance-props.js','bleachers.js','arenas.js','audio-mixer.js','fight-dialogue.js','room-client.js','site.webmanifest','_headers','_routes.json'];
for(const file of files)await fs.copyFile(path.join(root,file),path.join(output,file));
for(const dir of ['assets','vendor'])await fs.cp(path.join(root,dir),path.join(output,dir),{recursive:true,filter:source=>{
 const relative=path.relative(root,source).replaceAll('\\','/');
 if(/^assets\/[^/]+\.glb$/.test(relative)||/^assets\/entry-.+\.wav$/.test(relative))return false;
 return !/(home-reference|outfit-reference|arena-street|arena\.png|its-done-bro)/.test(relative);
}});
let bytes=0,count=0,max=0;
async function check(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else{const size=(await fs.stat(file)).size;if(size>25*1024*1024)throw Error('Cloudflare Pages file limit exceeded: '+file);bytes+=size;max=Math.max(max,size);count++;}}}
await check(output);console.log(`Built ${count} files; ${(bytes/1048576).toFixed(2)} MiB total; largest ${(max/1048576).toFixed(2)} MiB.`);
