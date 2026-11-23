import {routeContent} from './content.js';
export {SiteContent} from './content.js';
import {routeRoom} from './router.js';
export {BollyRoom} from './worker.js';

// Workers Builds entry point: static game and room API deploy together.
export default {
 fetch(request,env){
  const {pathname}=new URL(request.url);
  if(pathname==='/api/content'||pathname.startsWith('/api/admin/')||pathname.startsWith('/media/'))return routeContent(request,env);
  if(pathname.startsWith('/api/room/'))return routeRoom(request,env);
  if(pathname.startsWith('/api/'))return Response.json({error:'Unknown API route'},{status:404});
  return env.ASSETS.fetch(request);
 }
};
