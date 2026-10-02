// Transport-independent proof. resolveSession must be a trusted server adapter.
const schemas = {
  projects: [],
  tickets: ['projectId'],
  overview: ['projectId'],
  ticket: ['projectId', 'type', 'subject', 'body', 'operationId'],
  'read-ticket': ['projectId', 'ticketId'],
  reply: ['projectId', 'ticketId', 'body', 'operationId'],
  feedback: ['projectId', 'milestoneId', 'versionId', 'body', 'operationId'],
  approve: ['projectId', 'milestoneId', 'versionId', 'operationId']
};
const reads = new Set(['projects', 'tickets', 'overview', 'read-ticket']);
const response = (status, data) => ({status, headers: {'Cache-Control':'no-store'}, data});

export function createBoundary({portal, resolveSession, allowedOrigin}) {
  if (typeof resolveSession !== 'function' || new URL(allowedOrigin).origin !== allowedOrigin) throw new Error('INVALID_CONFIGURATION');
  return async function handle({action, method, origin, rawBody, sessionToken}) {
    const fields = Object.hasOwn(schemas, action) ? schemas[action] : null;
    if (!fields) return response(404, {error:'NOT_FOUND'});
    if (method !== (reads.has(action) ? 'GET' : 'POST')) return response(405, {error:'METHOD_NOT_ALLOWED'});
    if (!reads.has(action) && origin !== allowedOrigin) return response(403, {error:'ORIGIN_DENIED'});
    if (typeof rawBody !== 'string') return response(400, {error:'INVALID_REQUEST'});
    if (Buffer.byteLength(rawBody, 'utf8') > 32768) return response(413, {error:'REQUEST_TOO_LARGE'});
    let input;
    try { input = JSON.parse(rawBody); } catch { return response(400, {error:'INVALID_REQUEST'}); }
    if (!input || Array.isArray(input) || typeof input !== 'object' ||
        Object.keys(input).length !== fields.length ||
        !fields.every(key => Object.hasOwn(input, key) && typeof input[key] === 'string' && input[key].length > 0)) {
      return response(400, {error:'INVALID_REQUEST'});
    }
    for (const key of fields.filter(key => !['body','subject','type'].includes(key))) {
      if (input[key].length > 128) return response(400, {error:'INVALID_REQUEST'});
    }
    try {
      const session = await resolveSession(sessionToken);
      if (!session || typeof session.actorId !== 'string' || !session.actorId) return response(401, {error:'UNAUTHENTICATED'});
      const request = {...input, actorId:session.actorId};
      const operations = {
        projects: () => portal.projectsFor(session.actorId),
        tickets: () => portal.ticketsFor(session.actorId,input.projectId),
        overview: () => portal.projectOverview(session.actorId, input.projectId),
        'read-ticket': () => portal.readTicket(session.actorId, input.projectId, input.ticketId),
        ticket: () => portal.createTicket(request),
        reply: () => portal.replyToTicket(request),
        feedback: () => portal.submitFeedback(request),
        approve: () => portal.approve(request)
      };
      return response(200, await operations[action]());
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'ACCESS_DENIED') return response(403, {error:'ACCESS_DENIED'});
      if (['OPERATION_CONFLICT','VERSION_CONFLICT','STATE_CONFLICT'].includes(message)) return response(409, {error:message});
      if (['INVALID_OPERATION','INVALID_TEXT','INVALID_TICKET_TYPE'].includes(message)) return response(400, {error:message});
      return response(503, {error:'SERVICE_UNAVAILABLE'});
    }
  };
}
