import {reviewDigest} from './review.mjs';
import {progressDigest} from './progress.mjs';
import {careAssessments,ticketTriageDigest} from './triage.mjs';
// Provider-free executable model. This is not an authentication service or database.
const denied = () => { throw new Error('ACCESS_DENIED'); };
const actions = new Set(['view', 'feedback', 'ticket', 'approve', 'manage-colleagues', 'manage-progress', 'manage-reviews', 'manage-support']);
const clientReview=review=>review?Object.fromEntries(['projectId','milestoneId','versionId','title','body','digest'].map(key=>[key,review[key]])):null;
const clientTicket=ticket=>{const {triageHistory,...record}=ticket;return {...record,triageDigest:ticketTriageDigest({projectId:ticket.projectId,ticketId:ticket.id,triage:ticket.triage}),triageHistory:(triageHistory??[]).map(({priority,careAssessment,note,timestamp})=>({priority,careAssessment,note,timestamp}))};};

export function authorise(state, actorId, projectId, action) {
  if (!actions.has(action)) denied();
  const identity = state.identities.find(x => x.id === actorId && x.active);
  const project = state.projects.find(x => x.id === projectId);
  if (!identity || !project) denied();
  if(['manage-progress','manage-reviews','manage-support'].includes(action)){if(identity.wvdAdmin===true)return project;denied();}
  // Administration is separate from client approval and colleague management.
  if (identity.wvdAdmin && ['view', 'feedback', 'ticket'].includes(action)) return project;
  const membership = state.memberships.find(x =>
    x.actorId === actorId && x.businessId === project.businessId && x.active &&
    ['Owner', 'Member'].includes(x.role) && x.projectIds.includes(projectId));
  if (!membership) denied();
  if (['approve', 'manage-colleagues'].includes(action) && membership.role !== 'Owner') denied();
  return project;
}

export class PortalProof {
  #state;
  #clock;
  constructor(state, clock) {
    this.#state = structuredClone(state);
    this.#clock = clock;
    // Reject ambiguous identifiers rather than choosing the first row.
    for (const collection of ['identities', 'projects', 'milestones']) {
      const ids = this.#state[collection].map(x => x.id);
      if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_ID');
    }
    const memberships = this.#state.memberships.map(x => JSON.stringify([x.actorId, x.businessId]));
    if (new Set(memberships).size !== memberships.length) throw new Error('DUPLICATE_MEMBERSHIP');
    this.#state.receipts ??= [];
    this.#state.outbox ??= [];
    this.#state.feedback ??= [];
    this.#state.tickets ??= [];
    this.#state.replies ??= [];
  }
  snapshot() { return structuredClone(this.#state); }
  workspaceAccess(actorId) {
    const identity=this.#state.identities.find(x=>x.id===actorId&&x.active);
    if(!identity)denied();
    return {admin:identity.wvdAdmin===true};
  }
  createProjectAsAdmin({actorId,businessId,projectId,stage,nextStep}) {
    if(!this.workspaceAccess(actorId).admin)denied();
    this.#text(businessId,128);this.#text(projectId,128);
    if(!this.#state.projects.some(x=>x.businessId===businessId))throw Error('BUSINESS_SCOPE_DENIED');
    const existing=this.#state.projects.find(x=>x.id===projectId);
    if(existing&&(existing.businessId!==businessId||existing.createdByActorId!==actorId))throw Error('PROJECT_CONFLICT');
    const expectedDigest=progressDigest({projectId,stage:null,nextStep:null});
    const operationId='create-project-'+progressDigest({projectId,stage:businessId,nextStep:actorId});
    if(existing)return {projectId,businessId,initialProgress:this.updateProjectProgress({actorId,projectId,stage,nextStep,expectedDigest,operationId})};
    if(this.#state.projects.filter(x=>x.businessId===businessId).length>=200)throw Error('PROJECT_CAPACITY');
    const next=structuredClone(this.#state);
    next.projects.push({id:projectId,businessId,createdByActorId:actorId,createdAt:this.#timestamp()});
    const candidate=new PortalProof(next,this.#clock),initialProgress=candidate.updateProjectProgress({actorId,projectId,stage,nextStep,expectedDigest,operationId});
    this.#state=candidate.snapshot();return {projectId,businessId,initialProgress};
  }
  updateProjectProgress({actorId,projectId,stage,nextStep,expectedDigest,operationId}) {
    const project=authorise(this.#state,actorId,projectId,'manage-progress');
    this.#text(stage,200);this.#text(nextStep,2000);
    if(typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest))throw Error('INVALID_PROGRESS');
    const payload={kind:'progress',actorId,projectId,stage,nextStep,expectedDigest,operationId};
    const retry=this.#retry(operationId,payload);if(retry)return retry;
    if(progressDigest({projectId,stage:project.stage,nextStep:project.nextStep})!==expectedDigest)throw Error('PROGRESS_CONFLICT');
    if((project.progressHistory?.length??0)>=200)throw Error('PROGRESS_CAPACITY');
    const count=this.#state.projects.reduce((sum,x)=>sum+(x.progressHistory?.length??0),0);
    const record={...payload,id:`progress-${count+1}`,businessId:project.businessId,timestamp:this.#timestamp(),digest:progressDigest({projectId,stage,nextStep})};
    const next=structuredClone(this.#state),target=next.projects.find(x=>x.id===projectId);
    target.stage=stage;target.nextStep=nextStep;target.progressHistory??=[];target.progressHistory.push(record);
    this.#state=next;return structuredClone(record);
  }
  adminOverview(actorId) {
    if(!this.workspaceAccess(actorId).admin)denied();
    // Read-only projection: no credentials, membership rows or notification data.
    const businesses=[...new Set(this.#state.projects.map(x=>x.businessId))];
    return structuredClone({businesses:businesses.map(businessId=>({businessId,
      projects:this.#state.projects.filter(x=>x.businessId===businessId).map(project=>({
        projectId:project.id,stage:project.stage??null,nextStep:project.nextStep??null,
        awaitingReview:this.#state.milestones.filter(x=>x.projectId===project.id&&x.status==='awaiting-client').length,
        feedbackCount:this.#state.feedback.filter(x=>x.projectId===project.id).length,
        ticketCount:this.#state.tickets.filter(x=>x.projectId===project.id).length
      }))
    }))});
  }
  // Trusted operator capability only. Do not expose this through client routes.
  provisionAccess(request) {
    const fields=['uid','businessId','role','projectIds'];
    const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=128;
    if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key))||
      !text(request.uid)||!text(request.businessId)||!['Owner','Member'].includes(request.role)||!Array.isArray(request.projectIds)||!request.projectIds.length||request.projectIds.length>50||request.projectIds.some(id=>!text(id))||new Set(request.projectIds).size!==request.projectIds.length)throw Error('INVALID_ACCESS_GRANT');
    const {uid,businessId,role}=request,projectIds=[...request.projectIds].sort();
    if(projectIds.some(id=>this.#state.projects.find(project=>project.id===id)?.businessId!==businessId))throw Error('PROJECT_SCOPE_DENIED');
    const identity=this.#state.identities.find(item=>item.id===uid);
    if(identity&&!identity.active)throw Error('IDENTITY_DISABLED');
    const existing=this.#state.memberships.find(item=>item.actorId===uid&&item.businessId===businessId);
    if(existing) {
      if(!existing.active||existing.role!==role||JSON.stringify([...existing.projectIds].sort())!==JSON.stringify(projectIds))throw Error('ACCESS_ALREADY_PROVISIONED');
      return {created:false,identityId:uid,businessId,role,projectIds};
    }
    const timestamp=this.#timestamp(),next=structuredClone(this.#state);
    if(!identity)next.identities.push({id:uid,active:true});
    next.memberships.push({actorId:uid,businessId,role,projectIds,active:true,provisionedAt:timestamp});
    this.#state=next;
    return {created:true,identityId:uid,businessId,role,projectIds};
  }
  // Server-verified admin capability. Client membership cannot publish.
  createMilestoneAsAdmin({actorId,projectId,milestoneId,versionId,title,body}) {
    authorise(this.#state,actorId,projectId,'manage-reviews');
    this.#text(milestoneId,128);
    const existing=this.#state.milestones.find(x=>x.id===milestoneId);
    if(existing){
      if(existing.projectId!==projectId||existing.createdByActorId!==actorId||existing.reviews?.[0]?.versionId!==versionId)throw Error('MILESTONE_CONFLICT');
      return {milestoneId,projectId,review:this.publishReview({projectId,milestoneId,versionId,title,body})};
    }
    if(this.#state.milestones.filter(x=>x.projectId===projectId).length>=200)throw Error('MILESTONE_CAPACITY');
    const next=structuredClone(this.#state);
    next.milestones.push({id:milestoneId,projectId,currentVersionId:versionId,status:'awaiting-client',createdByActorId:actorId,createdAt:this.#timestamp()});
    const candidate=new PortalProof(next,this.#clock);
    const review=candidate.publishReviewAsAdmin({actorId,projectId,milestoneId,versionId,title,body,expectedVersionId:versionId});
    this.#state=candidate.snapshot();return {milestoneId,projectId,review};
  }
  publishReviewAsAdmin({actorId,projectId,milestoneId,versionId,title,body,expectedVersionId}) {
    authorise(this.#state,actorId,projectId,'manage-reviews');
    this.#text(expectedVersionId,128);
    const milestone=this.#state.milestones.find(x=>x.id===milestoneId&&x.projectId===projectId);
    if(!milestone)denied();
    const request={projectId,milestoneId,versionId,title,body};
    // The immutable version is its retry key. A retry never rolls back current.
    if(milestone.reviews?.some(x=>x.versionId===versionId))return this.publishReview(request);
    if(milestone.currentVersionId!==expectedVersionId)throw Error('VERSION_CONFLICT');
    const publishedAt=this.#timestamp(),result=this.publishReview(request);
    const stored=milestone.reviews.find(x=>x.versionId===versionId);
    stored.publisherActorId=actorId;stored.publishedAt=publishedAt;
    return {...result,publisherActorId:actorId,publishedAt};
  }
  // Privileged operator capability; the admin route uses the checked wrapper above.
  publishReview(request) {
    const fields=['projectId','milestoneId','versionId','title','body'];
    if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key)))throw Error('INVALID_REVIEW');
    const {projectId,milestoneId,versionId,title,body}=request;
    for(const value of [projectId,milestoneId,versionId])this.#text(value,128);
    this.#text(title,200);this.#text(body,10000);
    const milestone=this.#state.milestones.find(x=>x.id===milestoneId&&x.projectId===projectId);
    if(!milestone)denied();
    const review={projectId,milestoneId,versionId,title,body};review.digest=reviewDigest(review);
    const existing=milestone.reviews?.find(x=>x.versionId===versionId);
    if(existing){if(existing.digest!==review.digest)throw Error('REVIEW_IMMUTABLE');return structuredClone(existing);}
    // A previously approved legacy version cannot acquire new review content.
    if(this.#state.receipts.some(x=>x.milestoneId===milestoneId&&x.versionId===versionId))throw Error('REVIEW_IMMUTABLE');
    milestone.reviews??=[];milestone.reviews.push(review);milestone.reviewRequired=true;
    milestone.currentVersionId=versionId;milestone.status='awaiting-client';
    return structuredClone(review);
  }
  projectsFor(actorId) {
    return this.#state.projects.filter(project => {
      try { authorise(this.#state,actorId,project.id,'view'); return true; }
      catch { return false; }
    }).map(({id,stage,nextStep}) => ({id,stage:stage ?? null,nextStep:nextStep ?? null}));
  }
  ticketsFor(actorId, projectId) {
    authorise(this.#state,actorId,projectId,'ticket');
    return structuredClone(this.#state.tickets.filter(x => x.projectId===projectId).map(clientTicket));
  }
  authorise(actorId, projectId, action) { return structuredClone(authorise(this.#state, actorId, projectId, action)); }
  projectOverview(actorId, projectId) {
    const project = authorise(this.#state, actorId, projectId, 'view');
    let canApprove=false;try{authorise(this.#state,actorId,projectId,'approve');canApprove=true;}catch{}
    const milestones = this.#state.milestones.filter(x => x.projectId === projectId).map(({reviews,createdByActorId,createdAt,...milestone}) => ({...milestone,...(milestone.reviewRequired ? {review:clientReview(reviews?.find(x=>x.versionId===milestone.currentVersionId))} : {})}));
    return structuredClone({
      projectId, canApprove, stage: project.stage ?? null, nextStep: project.nextStep ?? null,
      progressDigest:progressDigest({projectId,stage:project.stage,nextStep:project.nextStep}),
      progressHistory:(project.progressHistory??[]).map(({stage,nextStep,timestamp})=>({stage,nextStep,timestamp})),
      feedbackHistory:this.#state.feedback.filter(x=>x.projectId===projectId).map(({id,milestoneId,versionId,timestamp,body})=>({id,milestoneId,versionId,timestamp,body})),
      approvalHistory:this.#state.receipts.filter(x=>x.projectId===projectId).map(({id,milestoneId,versionId,timestamp,reviewDigest})=>({id,milestoneId,versionId,timestamp,reviewDigest:reviewDigest??null,review:reviewDigest?clientReview(this.#state.milestones.find(x=>x.id===milestoneId&&x.projectId===projectId)?.reviews?.find(x=>x.versionId===versionId&&x.digest===reviewDigest)):null})),
      completedMilestones: milestones.filter(x => x.status === 'approved'),
      awaitingClient: milestones.filter(x => x.status === 'awaiting-client')
    });
  }
  #timestamp() {
    const timestamp = this.#clock();
    if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new Error('INVALID_SERVER_TIME');
    return timestamp;
  }
  #retry(operationId, payload) {
    if (typeof operationId !== 'string' || !operationId || operationId.length > 128) throw new Error('INVALID_OPERATION');
    const existing = [...this.#state.receipts, ...this.#state.feedback, ...this.#state.tickets, ...this.#state.replies,...this.#state.projects.flatMap(x=>x.progressHistory??[]),...this.#state.tickets.flatMap(x=>x.triageHistory??[])].find(x => x.operationId === operationId);
    if (!existing) return null;
    for (const [key, value] of Object.entries(payload)) if (existing[key] !== value) throw new Error('OPERATION_CONFLICT');
    return structuredClone(existing);
  }
  #text(value, maximum) {
    // Prototype bounds only; production request-body/rate limits remain separate.
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error('INVALID_TEXT');
    return value;
  }
  #save(collection, payload, eventType) {
    const next = structuredClone(this.#state);
    const record = { ...payload, id: `${collection}-${next[collection].length + 1}`, timestamp: this.#timestamp() };
    next[collection].push(record);
    // Payload-free notification intent; recipient selection is unresolved.
    next.outbox.push({id: record.id, type: eventType, receiptId: record.id, status: 'pending'});
    this.#state = next;
    return structuredClone(record);
  }
  submitFeedback({ actorId, projectId, milestoneId, versionId, body, operationId }) {
    const project = authorise(this.#state, actorId, projectId, 'feedback');
    this.#text(body, 10000);
    const payload = {kind:'feedback',actorId,projectId,milestoneId,versionId,body,operationId};
    const retry = this.#retry(operationId, payload);
    if (retry) return retry;
    const milestone = this.#state.milestones.find(x => x.id === milestoneId && x.projectId === projectId);
    if (!milestone) denied();
    if (typeof versionId !== 'string' || !versionId || milestone.currentVersionId !== versionId) throw new Error('VERSION_CONFLICT');
    return this.#save('feedback', {...payload,businessId:project.businessId}, 'feedback-saved');
  }
  createTicket({actorId, projectId, type, subject, body, operationId}) {
    const project = authorise(this.#state, actorId, projectId, 'ticket');
    if (!['question','fault','change-request'].includes(type)) throw new Error('INVALID_TICKET_TYPE');
    this.#text(subject, 200); this.#text(body, 10000);
    const payload = {kind:'ticket',actorId,projectId,type,subject,body,operationId};
    const retry = this.#retry(operationId, payload);
    return clientTicket(retry ?? this.#save('tickets', {...payload,businessId:project.businessId}, 'ticket-created'));
  }
  readTicket(actorId, projectId, ticketId) {
    authorise(this.#state, actorId, projectId, 'ticket');
    const ticket = this.#state.tickets.find(x => x.id === ticketId && x.projectId === projectId);
    if (!ticket) denied();
    return structuredClone({ticket:clientTicket(ticket), replies:this.#state.replies.filter(x =>
      x.ticketId === ticketId && x.projectId === projectId && x.businessId === ticket.businessId)});
  }
  replyToTicket({actorId,projectId,ticketId,body,operationId}) {
    const {ticket} = this.readTicket(actorId,projectId,ticketId);
    this.#text(body, 10000);
    const payload = {kind:'reply',actorId,projectId,ticketId,body,operationId};
    const retry = this.#retry(operationId,payload);
    return retry ?? this.#save('replies',{...payload,businessId:ticket.businessId},'ticket-replied');
  }
  triageTicket({actorId,projectId,ticketId,priority,careAssessment,note,expectedDigest,operationId}) {
    const project=authorise(this.#state,actorId,projectId,'manage-support');
    const ticket=this.#state.tickets.find(x=>x.id===ticketId&&x.projectId===projectId);if(!ticket)denied();
    this.#text(priority,100);this.#text(note,2000);
    if(!careAssessments.includes(careAssessment)||typeof expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(expectedDigest))throw Error('INVALID_TRIAGE');
    const payload={kind:'triage',actorId,projectId,ticketId,priority,careAssessment,note,expectedDigest,operationId};
    const retry=this.#retry(operationId,payload);if(retry)return retry;
    if(ticketTriageDigest({projectId,ticketId,triage:ticket.triage})!==expectedDigest)throw Error('TRIAGE_CONFLICT');
    if((ticket.triageHistory?.length??0)>=200)throw Error('TRIAGE_CAPACITY');
    const timestamp=this.#timestamp(),digest=ticketTriageDigest({projectId,ticketId,triage:payload});
    const count=this.#state.tickets.reduce((sum,x)=>sum+(x.triageHistory?.length??0),0),record={...payload,id:`triage-${count+1}`,businessId:project.businessId,timestamp,digest};
    const next=structuredClone(this.#state),target=next.tickets.find(x=>x.id===ticketId);
    target.triage={priority,careAssessment,note,timestamp,digest};target.triageHistory??=[];target.triageHistory.push(record);
    this.#state=next;return structuredClone(record);
  }
  revokeMembership(actorId, businessId) {
    // Trusted test-adapter operation, not an exposed admin or client endpoint.
    const membership = this.#state.memberships.find(x => x.actorId === actorId && x.businessId === businessId);
    if (membership) membership.active = false;
  }
  replaceVersion(milestoneId, versionId) {
    // Trusted test-adapter operation. Historical approvals are immutable.
    const milestone = this.#state.milestones.find(x => x.id === milestoneId);
    if (!milestone || typeof versionId !== 'string' || !versionId) throw new Error('INVALID_VERSION');
    milestone.currentVersionId = versionId;
    milestone.status = 'awaiting-client';
  }
  approve({ actorId, projectId, milestoneId, versionId, operationId, reviewDigest: digest }) {
    // Recheck current membership even for a repeated request.
    const project = authorise(this.#state, actorId, projectId, 'approve');
    const binding=digest===undefined?{}:{reviewDigest:digest};
    const existing = this.#retry(operationId,{kind:'approval',actorId,projectId,milestoneId,versionId,...binding});
    if(existing && existing.reviewDigest!==digest)throw Error('OPERATION_CONFLICT');
    if (existing) return existing;
    const milestone = this.#state.milestones.find(x => x.id === milestoneId && x.projectId === projectId);
    if (!milestone) denied();
    if (typeof versionId !== 'string' || !versionId || milestone.currentVersionId !== versionId) throw new Error('VERSION_CONFLICT');
    if(milestone.reviewRequired && (!digest || milestone.reviews?.find(x=>x.versionId===versionId)?.digest!==digest))throw Error('REVIEW_CONFLICT');
    if(!milestone.reviewRequired && digest!==undefined)throw Error('REVIEW_CONFLICT');
    if (milestone.status !== 'awaiting-client') throw new Error('STATE_CONFLICT');
    const timestamp = this.#timestamp();
    const receipt = {
      id: `approval-${this.#state.receipts.length + 1}`, kind:'approval', operationId, actorId,
      businessId: project.businessId, projectId, milestoneId, versionId, timestamp, ...binding
    };
    // Synchronous copy-on-write commit models one transaction. A production
    // adapter must implement locking/constraints in the selected durable store.
    const next = structuredClone(this.#state);
    next.milestones.find(x => x.id === milestoneId).status = 'approved';
    next.receipts.push(receipt);
    next.outbox.push({ id: receipt.id, type: 'milestone-approved', receiptId: receipt.id, status: 'pending' });
    this.#state = next;
    return structuredClone(receipt);
  }
}
