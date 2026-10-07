import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createPortalHandler} from './http.mjs';
import {livePortalConfiguration} from './live-config.mjs';
import {createInvitationHandler} from './invitation-http.mjs';

const assetFiles=[
  ['/brand-logo.png','image/png','../../src/assets/brand/horizontal-logo.png'],
  ['/','text/html; charset=utf-8','./ui/live-index.html'],
  ['/client-workspace.js','text/javascript; charset=utf-8','./ui/client-workspace.js'],
  ['/app.js','text/javascript; charset=utf-8','./ui/app.js'],
  ['/auth-client.js','text/javascript; charset=utf-8','./ui/auth-client.js'],
  ['/live-auth-client.js','text/javascript; charset=utf-8','./ui/live-auth-client.js'],
  ['/enquiries.js','text/javascript; charset=utf-8','./ui/enquiries.js'],
  ['/style.css','text/css; charset=utf-8','./ui/style.css']
];

export function createLivePortalApplication({portal,resolveOwnerSession,resolveSession=resolveOwnerSession,invitations,config,enquiryHandler,enquiryRoute,browserBundle}) {
  const checked=livePortalConfiguration(config);
  if(typeof resolveOwnerSession!=='function'||(enquiryHandler!==undefined&&typeof enquiryHandler!=='function')||(enquiryHandler!==undefined&&typeof enquiryRoute!=='function')||!Buffer.isBuffer(browserBundle)||browserBundle.length<1||browserBundle.length>1048576)throw Error('INVALID_CONFIGURATION');
  const assets=new Map(assetFiles.map(([path,type,file])=>[path,[type,readFileSync(new URL(file,import.meta.url))]]));
  assets.set('/firebase-auth-sdk.js',['text/javascript; charset=utf-8',browserBundle]);
  const portalHandler=createPortalHandler({portal,resolveSession,allowedOrigin:checked.origin});
  const invitationHandler=invitations?createInvitationHandler({invitations,allowedOrigin:checked.origin}):null;
  const csp=`default-src 'none'; script-src 'self' https://apis.google.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://${checked.web.authDomain}; frame-src https://${checked.web.authDomain}; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
  let active=0;
  const server=createServer({maxHeaderSize:16384},async(request,response)=>{
    for(const [name,value]of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':csp,'Cross-Origin-Opener-Policy':'same-origin-allow-popups','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}))response.setHeader(name,value);
    const send=(status,data)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(data));};
    let counted=false;
    try {
      if(typeof request.url!=='string'||request.url.length>4096||!request.url.startsWith('/')||request.url.startsWith('//'))return send(400,{error:'INVALID_REQUEST'});
      const url=new URL(request.url,'http://localhost');
      if(url.pathname==='/health'&&!url.search&&request.method==='GET')return send(200,{status:'ok',mode:'live-portal',providerAccessChecked:false});
      if(url.pathname==='/robots.txt'&&!url.search&&request.method==='GET'){response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});response.end('User-agent: *\nDisallow: /\n');return;}
      const privateApi=url.pathname.startsWith('/api/portal/')||url.pathname.startsWith('/api/admin/')||url.pathname.startsWith('/api/invitations/');
      if(privateApi&&((request.headers.origin!==undefined&&request.headers.origin!==checked.origin)||request.headers['sec-fetch-site']==='cross-site'))return send(403,{error:'ORIGIN_DENIED'});
      if(active>=checked.maxConcurrentRequests){response.setHeader('Retry-After','5');return send(503,{error:'SERVICE_UNAVAILABLE'});}
      active++;counted=true;
      if(invitationHandler&&url.pathname.startsWith('/api/invitations/'))return await invitationHandler(request,response);
      if(enquiryHandler&&enquiryRoute(url.pathname))return await enquiryHandler(request,response);
      if(url.pathname.startsWith('/api/portal/'))return await portalHandler(request,response);
      if(url.pathname==='/auth-config.json'&&!url.search&&request.method==='GET')return send(200,{mode:'firebase-live',firebase:checked.web,ownerConfigured:checked.owner!==null,enquiriesEnabled:enquiryHandler!==undefined,...(invitations?{invitationsEnabled:true}:{})});
      if(assets.has(url.pathname)&&!url.search&&request.method==='GET'){
        const [type,body]=assets.get(url.pathname);response.writeHead(200,{'Content-Type':type});response.end(body);return;
      }
      return send(404,{error:'NOT_FOUND'});
    }catch {
      if(!response.headersSent)send(503,{error:'SERVICE_UNAVAILABLE'});else response.destroy();
    }finally {if(counted)active--;}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
  return server;
}
