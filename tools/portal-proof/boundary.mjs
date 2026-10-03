import {deliverablePreview} from './deliverable-preview.mjs';
// Transport-independent proof. resolveSession must be a trusted server adapter.
const schemas = {
  'workspace-access': [],
  'admin-overview': [],
  'admin-accounts': ['businessId'],
  colleagues: ['projectId'],
  'update-colleague-access': ['projectId','uid','grant','expectedRevision'],
  'admin-update-access': ['uid','businessId','role','projectIds','expectedRevision'],
  'update-progress': ['projectId','stage','nextStep','expectedDigest','operationId'],
  'publish-review': ['projectId','milestoneId','versionId','title','body','expectedVersionId'],
  'create-milestone': ['projectId','milestoneId','versionId','title','body'],
  deliverable: ['projectId','milestoneId','versionId','reviewDigest'],
  'deliverable-catalogue': ['projectId'],
  'create-project': ['businessId','projectId','stage','nextStep'],
  'create-client': ['businessId','projectId','stage','nextStep'],
  'triage-ticket': ['projectId','ticketId','priority','careAssessment','note','expectedDigest','operationId'],
  projects: [],
  tickets: ['projectId'],
  overview: ['projectId'],
  ticket: ['projectId', 'type', 'subject', 'body', 'operationId'],
  'read-ticket': ['projectId', 'ticketId'],
  reply: ['projectId', 'ticketId', 'body', 'operationId'],
  feedback: ['projectId', 'milestoneId', 'versionId', 'body', 'operationId'],
  approve: ['projectId', 'milestoneId', 'versionId', 'operationId']
};
const reads = new Set(['workspace-access', 'admin-overview', 'admin-accounts', 'colleagues', 'projects', 'tickets', 'overview', 'read-ticket','deliverable-catalogue']);
const response = (status, data) => ({status, headers: {'Cache-Control':'no-store'}, data});

export function createBoundary({portal, resolveSession, allowedOrigin,deliverableReader,deliverableCatalogue}) {
  if (typeof resolveSession !== 'function' || new URL(allowedOrigin).origin !== allowedOrigin) throw new Error('INVALID_CONFIGURATION');
  if(deliverableReader!==undefined&&typeof deliverableReader!=='function')throw Error('INVALID_CONFIGURATION');
  if(deliverableCatalogue!==undefined&&(typeof deliverableCatalogue?.list!=='function'||typeof deliverableCatalogue?.resolve!=='function'))throw Error('INVALID_CONFIGURATION');
  const publication=async(method,request)=>{
    const {deliverableId,...content}=request;
    if(deliverableId!==undefined){
      if(!deliverableCatalogue)throw Error('INVALID_DELIVERABLE');
      content.deliverable=await deliverableCatalogue.resolve(request.actorId,request.projectId,deliverableId);
    }
    return portal[method](content);
  };
  const readDeliverable=async(actorId,input)=>{
    if(!deliverableReader)throw Error('DELIVERABLE_UNAVAILABLE');
    const proof=await deliverableReader(actorId,{projectId:input.projectId,milestoneId:input.milestoneId,versionId:input.versionId,reviewDigest:input.reviewDigest});
    return {proof,preview:deliverablePreview(proof)};
  };
  return async function handle({action, method, origin, rawBody, sessionToken}) {
    let fields = Object.hasOwn(schemas, action) ? schemas[action] : null;
    if (!fields) return response(404, {error:'NOT_FOUND'});
    if (method !== (reads.has(action) ? 'GET' : 'POST')) return response(405, {error:'METHOD_NOT_ALLOWED'});
    if (!reads.has(action) && origin !== allowedOrigin) return response(403, {error:'ORIGIN_DENIED'});
    if (typeof rawBody !== 'string') return response(400, {error:'INVALID_REQUEST'});
    if (Buffer.byteLength(rawBody, 'utf8') > 32768) return response(413, {error:'REQUEST_TOO_LARGE'});
    let input;
    try { input = JSON.parse(rawBody); } catch { return response(400, {error:'INVALID_REQUEST'}); }
    if(action==='approve' && input && Object.hasOwn(input,'reviewDigest'))fields=[...fields,'reviewDigest'];
    if(['publish-review','create-milestone'].includes(action)&&input&&Object.hasOwn(input,'deliverableId'))fields=[...fields,'deliverableId'];
    if(input?.reviewDigest!==undefined && !/^[a-f0-9]{64}$/.test(input.reviewDigest))return response(400,{error:'INVALID_REQUEST'});
    if (!input || Array.isArray(input) || typeof input !== 'object' ||
        Object.keys(input).length !== fields.length ||
        !fields.every(key => Object.hasOwn(input,key)&&(action==='admin-update-access'&&key==='projectIds'?Array.isArray(input[key])&&input[key].length<=50&&input[key].every(id=>typeof id==='string'&&id.length>0&&id.length<=128):['admin-update-access','update-colleague-access'].includes(action)&&key==='expectedRevision'?Number.isSafeInteger(input[key])&&input[key]>=0:action==='update-colleague-access'&&key==='grant'?typeof input[key]==='boolean':typeof input[key]==='string'&&input[key].length>0))) {
      return response(400, {error:'INVALID_REQUEST'});
    }
    for (const key of fields.filter(key => !['body','subject','type','stage','nextStep','title','note','projectIds','expectedRevision','grant'].includes(key))) {
      if (input[key].length > 128) return response(400, {error:'INVALID_REQUEST'});
    }
    try {
      const session = await resolveSession(sessionToken);
      if (!session || typeof session.actorId !== 'string' || !session.actorId) return response(401, {error:'UNAUTHENTICATED'});
      const request = {...input, actorId:session.actorId};
      const operations = {
        'deliverable-catalogue': async()=>{await portal.authorise(session.actorId,input.projectId,'manage-reviews');return deliverableCatalogue?deliverableCatalogue.list(session.actorId,input.projectId):[];},
        deliverable: async()=>{const {proof,preview}=await readDeliverable(session.actorId,input);return {label:proof.manifest.label,sourceVersion:proof.manifest.sourceVersion,reviewDigest:proof.reviewDigest,...preview};},
        'workspace-access': () => portal.workspaceAccess(session.actorId),
        'admin-overview': () => portal.adminOverview(session.actorId),
        'admin-accounts': () => portal.adminAccounts(session.actorId,input.businessId),
        colleagues: () => portal.colleaguesFor(session.actorId,input.projectId),
        'update-colleague-access': () => portal.updateColleagueAccess(request),
        'admin-update-access': () => portal.updateAccessAsAdmin(request),
        'update-progress': () => portal.updateProjectProgress(request),
        'publish-review': () => publication('publishReviewAsAdmin',request),
        'create-milestone': () => publication('createMilestoneAsAdmin',request),
        'create-project': () => portal.createProjectAsAdmin(request),
        'create-client': () => portal.createClientAsAdmin(request),
        'triage-ticket': () => portal.triageTicket(request),
        projects: () => portal.projectsFor(session.actorId),
        tickets: () => portal.ticketsFor(session.actorId,input.projectId),
        overview: () => portal.projectOverview(session.actorId, input.projectId),
        'read-ticket': () => portal.readTicket(session.actorId, input.projectId, input.ticketId),
        ticket: () => portal.createTicket(request),
        reply: () => portal.replyToTicket(request),
        feedback: () => portal.submitFeedback(request),
        approve: async()=>{
          // Exact retries and ordinary text approvals need no provider read.
          // The transactional domain raises this gate only for a new approval
          // that requires a deliverable capability, without changing state.
          try{return await portal.approve(request);}catch(error){if(error?.message!=='DELIVERABLE_UNAVAILABLE')throw error;}
          const {proof}=await readDeliverable(session.actorId,input);
          return portal.approve(request,proof);
        }
      };
      const result=await operations[action]();
      if(action==='update-colleague-access')return response(200,{changed:result.changed,accountId:input.uid,projectId:input.projectId,hasProjectAccess:input.grant});
      return response(200,result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (['ACCESS_DENIED','BUSINESS_SCOPE_DENIED','PROJECT_SCOPE_DENIED','IDENTITY_DISABLED','ACCESS_REVOKED','ACCESS_MEMBERSHIP_REQUIRED','VERIFIED_FIREBASE_USER_REQUIRED','FIREBASE_USER_REQUIRED'].includes(message)) return response(403, {error:'ACCESS_DENIED'});
      if (['OPERATION_CONFLICT','VERSION_CONFLICT','STATE_CONFLICT','REVIEW_CONFLICT','PROGRESS_CONFLICT','REVIEW_IMMUTABLE','MILESTONE_CONFLICT','PROJECT_CONFLICT','CLIENT_CONFLICT','TRIAGE_CONFLICT','ACCESS_REVISION_CONFLICT','ACCESS_ROLE_CONFLICT','DELIVERABLE_UNAVAILABLE','DELIVERABLE_CONTENT_CONFLICT'].includes(message)) return response(409, {error:message});
      if (['INVALID_OPERATION','INVALID_TEXT','INVALID_TICKET_TYPE','INVALID_PROGRESS','INVALID_TRIAGE','INVALID_ACCESS_GRANT','ACCESS_REVISION_REQUIRED','INVALID_DELIVERABLE'].includes(message)) return response(400, {error:message});
      return response(503, {error:'SERVICE_UNAVAILABLE'});
    }
  };
}
