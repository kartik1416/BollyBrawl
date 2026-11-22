import {routeRoom} from '../../../cloudflare/router.js';
export const onRequest=({request,env})=>routeRoom(request,env);
