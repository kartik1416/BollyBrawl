import {routeRoom} from './router.js';
export {BollyRoom} from './worker.js';

// Workers Builds entry point: static game and room API deploy together.
export default {
 fetch(request,env){
  const {pathname}=new URL(request.url);
  if(pathname.startsWith('/api/room/'))return routeRoom(request,env);
  if(pathname.startsWith('/api/'))return Response.json({error:'Unknown API route'},{status:404});
  return env.ASSETS.fetch(request);
 }
};
