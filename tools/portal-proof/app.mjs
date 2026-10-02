import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createPortalHandler} from './http.mjs';

const assets = new Map([
  ['/', ['text/html; charset=utf-8',readFileSync(new URL('./ui/index.html',import.meta.url))]],
  ['/app.js', ['text/javascript; charset=utf-8',readFileSync(new URL('./ui/app.js',import.meta.url))]],
  ['/style.css', ['text/css; charset=utf-8',readFileSync(new URL('./ui/style.css',import.meta.url))]]
]);
export function createApplication({portal,auth,allowedOrigin}) {
  if (new URL(allowedOrigin).origin!==allowedOrigin) throw new Error('INVALID_CONFIGURATION');
  const portalHandler=createPortalHandler({portal,allowedOrigin,resolveSession:raw=>auth.resolveSession(raw)});
  const server=createServer({maxHeaderSize:16384},async (request,response) => {
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
    const send=(status,data) => { response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'}); response.end(JSON.stringify(data)); };
    try {
      if (typeof request.url!=='string' || request.url.length>4096) return send(400,{error:'INVALID_REQUEST'});
      const url=new URL(request.url,'http://localhost');
      if (url.pathname.startsWith('/api/portal/')) return portalHandler(request,response);
      if (assets.has(url.pathname) && !url.search && request.method==='GET') {
        const [type,body]=assets.get(url.pathname);response.writeHead(200,{...headers,'Content-Type':type});response.end(body);return;
      }
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
