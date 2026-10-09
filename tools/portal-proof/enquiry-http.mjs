import {readJsonBody} from './http-body.mjs';
import {ENQUIRY_BODY_LIMIT,normaliseEnquiryRequest,validEnquiryId} from './enquiry.mjs';

// Include malformed descendants so the live router fails them here instead of
// accidentally falling through to the Portal's HTML route.
export const enquiryRoute = pathname => typeof pathname === 'string' && /^\/api\/(?:enquiries|admin\/enquiries)(?:\/|$)/.test(pathname);
const validOrigin = value => {
  try { const url = new URL(value); return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))); } catch { return false; }
};

export function createEnquiryHandler({store,resolveOwnerSession,allowedPublicOrigins,maxConcurrentRequests,notify}) {
  if (['accept','list','read'].some(name => typeof store?.[name] !== 'function') || typeof resolveOwnerSession !== 'function' || !Array.isArray(allowedPublicOrigins) || allowedPublicOrigins.length < 1 || allowedPublicOrigins.length > 8 || new Set(allowedPublicOrigins).size !== allowedPublicOrigins.length || !allowedPublicOrigins.every(validOrigin) || !Number.isSafeInteger(maxConcurrentRequests) || maxConcurrentRequests < 1 || maxConcurrentRequests > 20 || (notify !== undefined && typeof notify !== 'function')) throw Error('INVALID_CONFIGURATION');
  const origins = new Set(allowedPublicOrigins);
  let inFlight = 0;

  return async (request,response) => {
    const send = (status,value,extra = {}) => {
      response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, noarchive',...extra});
      response.end(value === undefined ? undefined : JSON.stringify(value));
    };
    let counted = false;
    try {
      if (typeof request.url !== 'string' || request.url.length > 4096 || !request.url.startsWith('/') || request.url.startsWith('//')) return send(400,{error:'INVALID_REQUEST'});
      const url = new URL(request.url,'http://127.0.0.1'),isPublic = url.pathname === '/api/enquiries';
      const privateList = url.pathname === '/api/admin/enquiries';
      const privateId = /^\/api\/admin\/enquiries\/([a-f0-9]{64})$/.exec(url.pathname)?.[1];
      if (!isPublic && !privateList && !privateId) return send(404,{error:'NOT_FOUND'});

      // Only the public POST has a cross-origin browser contract. Private reads
      // remain same-origin and require the strict, configured owner resolver.
      if (isPublic) {
        const origin = request.headers.origin;
        if (typeof origin !== 'string' || !origins.has(origin)) return send(403,{error:'ORIGIN_DENIED'});
        response.setHeader('Access-Control-Allow-Origin',origin);
        response.setHeader('Vary','Origin');
        if (url.search) return send(400,{error:'INVALID_REQUEST'});
        if (request.method === 'OPTIONS') {
          const requested = request.headers['access-control-request-headers'];
          if (request.headers['access-control-request-method'] !== 'POST' || (requested !== undefined && (typeof requested !== 'string' || requested.split(',').map(value => value.trim().toLowerCase()).some(value => value !== 'content-type')))) return send(403,{error:'PREFLIGHT_DENIED'});
          return send(204,undefined,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
        }
        if (request.method !== 'POST') return send(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'POST, OPTIONS'});
      } else {
        response.removeHeader('Access-Control-Allow-Origin');
        response.removeHeader('Access-Control-Allow-Credentials');
        if (request.method !== 'GET') return send(405,{error:'METHOD_NOT_ALLOWED'},{Allow:'GET'});
      }

      if (inFlight >= maxConcurrentRequests) return send(429,{error:'ENQUIRY_RATE_LIMITED'},{'Retry-After':'10'});
      inFlight++; counted = true;
      if (isPublic) {
        const raw = await readJsonBody(request,ENQUIRY_BODY_LIMIT);
        let input;
        try { input = normaliseEnquiryRequest(JSON.parse(raw)); } catch { return send(400,{error:'INVALID_ENQUIRY'}); }
        const accepted = await store.accept(input);
        // Await trusted delivery while this request owns runtime CPU. Capture is
        // already durable; a notification outage cannot turn it into a failure.
        if (notify) { try { await notify(accepted.receiptId); } catch { /* Durable notification state remains available to the owner. */ } }
        return send(accepted.created ? 201 : 200,{status:'RECEIVED',receiptId:accepted.receiptId,receivedAt:accepted.receivedAt});
      }

      const authorization = request.headers.authorization;
      const token = typeof authorization === 'string' && authorization.length <= 8199 ? /^Bearer ([^\s]+)$/.exec(authorization)?.[1] : undefined;
      if (!token) return send(401,{error:'UNAUTHENTICATED'});
      const session = await resolveOwnerSession(token);
      if (!session || typeof session.actorId !== 'string' || !session.actorId || session.actorId.length > 128) return send(401,{error:'UNAUTHENTICATED'});
      if (privateId) {
        if (url.search || !validEnquiryId(privateId)) return send(400,{error:'INVALID_REQUEST'});
        const enquiry = await store.read(privateId);
        return enquiry ? send(200,enquiry) : send(404,{error:'NOT_FOUND'});
      }
      const values = {};
      for (const [key,value] of url.searchParams) {
        if (!['limit','cursor'].includes(key) || Object.hasOwn(values,key)) return send(400,{error:'INVALID_REQUEST'});
        values[key] = value;
      }
      if (values.limit !== undefined && (!/^[1-9][0-9]?$/.test(values.limit) || Number(values.limit) > 50)) return send(400,{error:'INVALID_REQUEST'});
      return send(200,await store.list({...(values.limit === undefined ? {} : {limit:Number(values.limit)}),...(values.cursor === undefined ? {} : {cursor:values.cursor})}));
    } catch (error) {
      const status = error?.httpStatus;
      if ([400,413,415].includes(status)) return send(status,{error:status === 413 ? 'REQUEST_TOO_LARGE' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : 'INVALID_REQUEST'});
      if (error?.message === 'INVALID_ENQUIRY') return send(400,{error:'INVALID_ENQUIRY'});
      if (error?.message === 'ENQUIRY_CONFLICT') return send(409,{error:'ENQUIRY_CONFLICT'});
      if (error?.message === 'ENQUIRY_EXPIRED') return send(410,{error:'ENQUIRY_EXPIRED'});
      if (error?.message === 'ENQUIRY_RATE_LIMITED') return send(429,{error:'ENQUIRY_RATE_LIMITED'},{'Retry-After':String(Number.isSafeInteger(error.retryAfter) ? Math.max(1,Math.min(86400,error.retryAfter)) : 60)});
      return send(503,{error:'SERVICE_UNAVAILABLE'});
    } finally { if (counted) inFlight--; }
  };
}
