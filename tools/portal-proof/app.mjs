import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {firebaseConfiguration} from './firebase-config.mjs';
import {createPortalHandler} from './http.mjs';
import {createInvitationHandler} from './invitation-http.mjs';
import {createCallAvailabilityHandler} from './call-http.mjs';
import {createBookingManagementHandler} from './booking-management-http.mjs';
import {createBookingHandler} from './booking-http.mjs';

const assets = new Map([
  ['/brand-logo.png', ['image/png',readFileSync(new URL('../../src/assets/brand/horizontal-logo.png',import.meta.url))]],
  ['/', ['text/html; charset=utf-8',readFileSync(new URL('./ui/index.html',import.meta.url))]],
  ['/app.js', ['text/javascript; charset=utf-8',readFileSync(new URL('./ui/app.js',import.meta.url))]],
  ['/auth-client.js', ['text/javascript; charset=utf-8',readFileSync(new URL('./ui/auth-client.js',import.meta.url))]],
  ['/style.css', ['text/css; charset=utf-8',readFileSync(new URL('./ui/style.css',import.meta.url))]]
]);
const bookingAssets=new Map([
  ['/book',['text/html; charset=utf-8',readFileSync(new URL('./ui/booking.html',import.meta.url))]],
  ['/booking.js',['text/javascript; charset=utf-8',readFileSync(new URL('./ui/booking.js',import.meta.url))]],
  ['/booking.css',['text/css; charset=utf-8',readFileSync(new URL('./ui/booking.css',import.meta.url))]]
]);
export function createApplication({portal,auth,allowedOrigin,firebaseEmulator,invitations,callAvailability,callBooking,callManagement,deliverableReader,deliverableCatalogue}) {
  if (new URL(allowedOrigin).origin!==allowedOrigin) throw new Error('INVALID_CONFIGURATION');
  let authConfig={mode:'local'},authConnect='';
  if(firebaseEmulator!==undefined) {
    const config=firebaseConfiguration(firebaseEmulator);
    if(config.mode!=='emulator'||!/^http:\/\/(127\.0\.0\.1|localhost)(:[1-9][0-9]{0,4})?$/.test(allowedOrigin))throw Error('ISOLATED_EMULATORS_REQUIRED');
    authConnect='http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST;
    authConfig={mode:'firebase-emulator',authOrigin:authConnect};
  }
  if(invitations!==undefined&&firebaseEmulator===undefined)throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(callAvailability!==undefined&&firebaseEmulator===undefined)throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(callBooking!==undefined&&firebaseEmulator===undefined)throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(callManagement!==undefined&&(firebaseEmulator===undefined||callBooking===undefined||callManagement.productId!==callBooking.productId||callManagement.calendarId!==callBooking.calendarId))throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(deliverableReader!==undefined&&firebaseEmulator===undefined)throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(deliverableCatalogue!==undefined&&firebaseEmulator===undefined)throw Error('ISOLATED_EMULATORS_REQUIRED');
  if(deliverableReader!==undefined)authConfig.deliverablesEnabled=true;
  const callHandler=callAvailability===undefined?null:createCallAvailabilityHandler({...callAvailability,allowedOrigin});
  const bookingHandler=callBooking===undefined?null:createBookingHandler({...callBooking,allowedOrigin});
  const managementHandler=callManagement===undefined?null:createBookingManagementHandler({...callManagement,allowedOrigin});
  const invitationHandler=invitations===undefined?null:createInvitationHandler({invitations,allowedOrigin});
  if(invitationHandler)authConfig.invitationsEnabled=true;
  const portalHandler=createPortalHandler({portal,allowedOrigin,resolveSession:raw=>auth.resolveSession(raw),deliverableReader,deliverableCatalogue});
  const server=createServer({maxHeaderSize:16384},async (request,response) => {
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ${authConnect}; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`};
    const send=(status,data) => { response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'}); response.end(JSON.stringify(data)); };
    try {
      if (typeof request.url!=='string' || request.url.length>4096) return send(400,{error:'INVALID_REQUEST'});
      const url=new URL(request.url,'http://localhost');
      if(url.pathname.startsWith('/api/calls/manage/')&&managementHandler)return managementHandler(request,response);
      if(['/api/calls/book','/api/calls/cancel','/api/calls/reschedule'].includes(url.pathname)&&bookingHandler)return bookingHandler(request,response);
      if(url.pathname.startsWith('/api/calls/')&&callHandler)return callHandler(request,response);
      if(url.pathname.startsWith('/api/invitations/')&&invitationHandler)return invitationHandler(request,response);
      if (url.pathname.startsWith('/api/portal/')) return portalHandler(request,response);
      if(url.pathname==='/auth-config.json'&&!url.search&&request.method==='GET')return send(200,authConfig);
      if(callBooking!==undefined&&callAvailability!==undefined&&(bookingAssets.has(url.pathname)||url.pathname==='/book/manage'&&managementHandler)&&!url.search&&request.method==='GET'){
        const [type,body]=bookingAssets.get(url.pathname==='/book/manage'?'/book':url.pathname);response.writeHead(200,{...headers,'Content-Type':type});response.end(['/book','/book/manage'].includes(url.pathname)?body.toString().replace('data-cancellation-enabled="false"',`data-cancellation-enabled="${typeof callBooking.cancel==='function'}"`).replace('data-rescheduling-enabled="false"',`data-rescheduling-enabled="${typeof callBooking.reschedule==='function'}"`).replace('data-management-enabled="false"',`data-management-enabled="${Boolean(managementHandler)}"`).replace('data-link-lifecycle="false"',`data-link-lifecycle="${typeof callManagement?.management?.replace==='function'&&typeof callManagement?.management?.revoke==='function'}"`).replace('data-managed-availability="false"',`data-managed-availability="${typeof callManagement?.management?.availability==='function'}"`).replace('data-managed-mode="false"',`data-managed-mode="${url.pathname==='/book/manage'}"`):body);return;
      }
      if (assets.has(url.pathname) && !url.search && request.method==='GET') {
        const [type,body]=assets.get(url.pathname);response.writeHead(200,{...headers,'Content-Type':type});response.end(body);return;
      }
      if(firebaseEmulator!==undefined&&url.pathname.startsWith('/api/auth/'))return send(404,{error:'NOT_FOUND'});
      const routes={'/api/auth/login':['email','password'],'/api/auth/redeem':['invitationToken','password'],'/api/auth/logout':[]};
      const fields=Object.hasOwn(routes,url.pathname)?routes[url.pathname]:null;
      if (!fields) return send(404,{error:'NOT_FOUND'});
      if (request.method!=='POST') return send(405,{error:'METHOD_NOT_ALLOWED'});
      if (request.headers.origin!==allowedOrigin) return send(403,{error:'ORIGIN_DENIED'});
      if (url.search || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type']??'')) return send(400,{error:'INVALID_REQUEST'});
      if (request.headers['content-length']!==undefined && (!/^\d+$/.test(request.headers['content-length']) || Number(request.headers['content-length'])>4096)) return send(413,{error:'REQUEST_TOO_LARGE'});
      let size=0;const chunks=[];
      for await (const chunk of request) {size+=chunk.length;if(size>4096)return send(413,{error:'REQUEST_TOO_LARGE'});chunks.push(chunk);}
      if(request.headers['content-length']!==undefined && Number(request.headers['content-length'])!==size)return send(400,{error:'INVALID_REQUEST'});
      let input;try {input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'INVALID_REQUEST'});}
      if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length!==fields.length || !fields.every(x=>Object.hasOwn(input,x)&&typeof input[x]==='string')) return send(400,{error:'INVALID_REQUEST'});
      const peer=request.socket.remoteAddress;
      if (url.pathname==='/api/auth/login') return send(200,await auth.login(input.email,input.password,peer));
      if (url.pathname==='/api/auth/redeem') return send(200,await auth.redeem(input.invitationToken,input.password,peer));
      const match=/^Bearer ([^\s]+)$/.exec(request.headers.authorization??'');
      if (!match || !auth.resolveSession(match[1])) return send(401,{error:'UNAUTHENTICATED'});
      auth.logout(match[1]);return send(200,{signedOut:true});
    } catch(error) {
      const name=error instanceof Error?error.message:'';
      const status={INVALID_REQUEST:400,INVALID_PASSWORD:400,INVALID_INVITATION:400,UNAUTHENTICATED:401,RATE_LIMITED:429,AUTH_BUSY:503}[name]??503;
      if (!response.headersSent) send(status,{error:status===503?'SERVICE_UNAVAILABLE':name});
      else response.destroy();
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
  return server;
}
