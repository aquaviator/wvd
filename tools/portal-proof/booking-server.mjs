import {createServer} from 'node:http';
import {bookingAssets,renderBookingPage} from './booking-assets.mjs';
import {createCallAvailabilityHandler} from './call-http.mjs';
import {createBookingHandler} from './booking-http.mjs';
import {createBookingManagementHandler} from './booking-management-http.mjs';
// Standalone booking host. It does not mount the proof portal's local-auth or
// emulator APIs, listen automatically, acquire credentials, provision or deploy.
export function createBookingServer(runtime){
 const origin=runtime?.binding?.origin,mode=runtime?.binding?.firebase?.mode;
 if(runtime?.management!==runtime?.callManagement?.management||!['live','emulator'].includes(mode)||typeof runtime?.admit!=='function'||runtime.callAvailability?.admit!==runtime.admit||runtime.callBooking?.admit!==runtime.admit||runtime.callManagement?.admit!==runtime.admit||runtime.callBooking?.productId!==runtime.binding.firebase.productId||runtime.callBooking?.calendarId!==runtime.binding.calendarId||runtime.callManagement?.productId!==runtime.callBooking.productId||runtime.callManagement?.calendarId!==runtime.callBooking.calendarId)throw Error('INVALID_CONFIGURATION');
 const handlers={availability:createCallAvailabilityHandler({...runtime.callAvailability,allowedOrigin:origin}),booking:createBookingHandler({...runtime.callBooking,allowedOrigin:origin}),management:createBookingManagementHandler({...runtime.callManagement,allowedOrigin:origin})};
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
 const server=createServer({maxHeaderSize:16384},async(request,response)=>{
  const send=(status,value)=>{response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
  try{
   if(typeof request.url!=='string'||request.url.length>4096)return send(400,{error:'INVALID_REQUEST'});
   const url=new URL(request.url,'http://localhost');
   if(url.pathname.startsWith('/api/calls/manage/'))return await handlers.management(request,response);
   if(['/api/calls/book','/api/calls/cancel','/api/calls/reschedule'].includes(url.pathname))return await handlers.booking(request,response);
   if(url.pathname==='/api/calls/availability')return await handlers.availability(request,response);
   if(request.method==='GET'&&!url.search){
    if(url.pathname==='/'){response.writeHead(302,{...headers,Location:'/book'});response.end();return;}
    if(url.pathname==='/health')return send(200,{status:'RUNNING',providerAccessChecked:false});
    const asset=bookingAssets.get(url.pathname==='/book/manage'?'/book':url.pathname);
    if(asset){response.writeHead(200,{...headers,'Content-Type':asset[0]});response.end(['/book','/book/manage'].includes(url.pathname)?renderBookingPage({managed:url.pathname==='/book/manage',booking:runtime.callBooking,management:runtime.management,mode}):asset[1]);return;}
   }
   return send(404,{error:'NOT_FOUND'});
  }catch{if(response.headersSent)response.destroy();else send(503,{error:'SERVICE_UNAVAILABLE'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;return server;
}
