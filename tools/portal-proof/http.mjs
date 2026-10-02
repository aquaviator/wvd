import {createBoundary} from './boundary.mjs';

// Node HTTP adapter. No default identity, development bypass or cookie session.
// The host must supply a real server-side bearer-token resolver and TLS.
export function createPortalHandler({portal, resolveSession, allowedOrigin}) {
  const boundary = createBoundary({portal, resolveSession, allowedOrigin});
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
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) return reject(415,'UNSUPPORTED_MEDIA_TYPE');
        const length = request.headers['content-length'];
        if (length !== undefined && !/^\d+$/.test(length)) return reject(400,'INVALID_REQUEST');
        if (Number(length) > 32768) return reject(413,'REQUEST_TOO_LARGE');
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > 32768) return reject(413,'REQUEST_TOO_LARGE');
          chunks.push(buffer);
        }
        if (length !== undefined && Number(length) !== bytes) return reject(400,'INVALID_REQUEST');
        rawBody = Buffer.concat(chunks,bytes).toString('utf8');
      }
      send(await boundary({action:route[1],method:request.method,origin:request.headers.origin,rawBody,sessionToken:match[1]}));
    } catch {
      if (!response.headersSent) reject(503,'SERVICE_UNAVAILABLE');
      else response.destroy();
    }
  };
}
