import {readJsonBody} from './http-body.mjs';
import {createBoundary} from './boundary.mjs';

// Node HTTP adapter. No default identity, development bypass or cookie session.
// The host must supply a real server-side bearer-token resolver and TLS.
export function createPortalHandler({portal, resolveSession, allowedOrigin,deliverableReader}) {
  const boundary = createBoundary({portal, resolveSession, allowedOrigin,deliverableReader});
  return async (request, response) => {
    const send = result => {
      response.writeHead(result.status, {
        ...result.headers, 'Content-Type':'application/json; charset=utf-8',
        'X-Content-Type-Options':'nosniff'
      });
      response.end(JSON.stringify(result.data));
    };
    const reject = (status, error) => send({status,headers:{'Cache-Control':'no-store'},data:{error}});
    try {
      if (typeof request.url !== 'string' || request.url.length > 4096) return reject(400,'INVALID_REQUEST');
      const url = new URL(request.url, 'http://localhost');
      const route = /^\/api\/portal\/([a-z-]+)$/.exec(url.pathname);
      if (!route) return reject(404,'NOT_FOUND');
      const auth = request.headers.authorization;
      const match = typeof auth === 'string' && /^Bearer ([^\s]+)$/.exec(auth);
      if (!match || match[1].length > 8192) return reject(401,'UNAUTHENTICATED');
      let rawBody;
      if (request.method === 'GET') {
        const input = {};
        for (const [key,value] of url.searchParams) {
          if (Object.hasOwn(input,key)) return reject(400,'INVALID_REQUEST');
          // defineProperty prevents query keys from changing the prototype.
          Object.defineProperty(input,key,{value,enumerable:true});
        }
        rawBody = JSON.stringify(input);
      } else {
        if (url.search) return reject(400,'INVALID_REQUEST');
        rawBody = await readJsonBody(request);
      }
      send(await boundary({action:route[1],method:request.method,origin:request.headers.origin,rawBody,sessionToken:match[1]}));
    } catch (error) {
      if (!response.headersSent) {
        const known=error?.httpStatus;
        reject([400,413,415].includes(known)?known:503,[400,413,415].includes(known)?error.message:'SERVICE_UNAVAILABLE');
      }
      else response.destroy();
    }
  };
}
