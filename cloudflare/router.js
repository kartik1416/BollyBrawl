const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function routeRoom(request,env){
 if(!env.ROOMS)return Response.json({error:'Online rooms are not connected yet. Deploy the room Worker and add the ROOMS binding in Cloudflare Pages. CPU and Training are available.'},{status:503});
 const url=new URL(request.url),action=url.pathname.split('/').at(-1);
 if(action==='events'){
  const code=(url.searchParams.get('code')||'').toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code))return Response.json({error:'Invalid room code.'},{status:400});
  return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
 }
 if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 if(Number(request.headers.get('content-length'))>4096)return Response.json({error:'Request too large'},{status:413});
 let body;try{const raw=await request.text();if(raw.length>4096)throw Error();body=JSON.parse(raw);}catch{return Response.json({error:'Invalid request'},{status:400});}
 for(let attempt=0;attempt<3;attempt++){
  const code=action==='create'?Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join(''):String(body.code||'').toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code))return Response.json({error:'Invalid room code.'},{status:400});
  const response=await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,code})}));
  if(action!=='create'||response.status!==409)return response;
 }
 return Response.json({error:'Try creating the room again.'},{status:503});
}
