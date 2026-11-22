export function createRoomClient({onState,onError,onClose}){
 let session=null,stream=null,busy=false,reconnect=null;
 async function post(action,body={}){
  const response=await fetch('/api/room/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,...body})});
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('The room service is unavailable on this host. Versus CPU and Training are still available.');
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'The room server could not complete the request.');
  return data;
 }
 async function connect(action,body){
  if(session)await leave();
  const data=await post(action,body);
  session={code:data.code,token:data.token,seat:data.seat};
  const credentials=session;
  function open(){
   if(session!==credentials)return;
   const endpoint='/api/room/events?'+new URLSearchParams({code:data.code,token:data.token});
   const socket=data.transport==='websocket';
   const connection=socket?new WebSocket(new URL(endpoint,location.href).href.replace(/^http/,'ws')):new EventSource(endpoint);
   stream=connection;
   connection.onmessage=event=>{
    if(session!==credentials)return;
    const packet=JSON.parse(event.data);
    if(packet.closed){close();onClose(packet.message);return;}
    onState(packet,session);
   };
   connection.onerror=()=>{if(session===credentials)onError('Connection interrupted. Reconnecting to the room...');};
   if(socket)connection.onclose=()=>{if(session===credentials){onError('Connection interrupted. Reconnecting to the room...');reconnect=setTimeout(open,1500);}};
  }
  open();
  return data;
 }
 function close(){session=null;clearTimeout(reconnect);stream?.close();stream=null;}
 async function leave(){
  if(session)try{await post('leave');}catch{}
  close();
 }
 return {
  create:body=>connect('create',body),
  join:body=>connect('join',body),
  select:body=>post('select',body),
  ready:()=>post('ready',{ready:true}),
  pause:paused=>post('pause',{paused}),
  get session(){return session;},
  async input(input){
   if(!session||busy)return false;
   if(stream instanceof WebSocket){if(stream.readyState!==WebSocket.OPEN)return false;stream.send(JSON.stringify({type:'input',input}));return true;}
   busy=true;
   try{await post('input',{input});return true;}catch(error){onError(error.message);return false;}finally{busy=false;}
  },
  leave,close
 };
}
