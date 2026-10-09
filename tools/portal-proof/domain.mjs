import {reviewDeliverable,verifiedDeliverableProof} from './deliverable.mjs';
import {memberInvitation} from './invitation.mjs';
import {invitationPolicy} from './invitation-state.mjs';
import {matchesOpaqueToken} from './opaque-token.mjs';
import {colleagueAccessRequest} from './colleague-access.mjs';
import {reviewDigest} from './review.mjs';
import {progressDigest} from './progress.mjs';
import {careAssessments,ticketTriageDigest} from './triage.mjs';
import {accessGrant} from './access.mjs';
import {adminAccessRequest} from './admin-access.mjs';
// Provider-free executable model. This is not an authentication service or database.
const denied = () => { throw new Error('ACCESS_DENIED'); };
const actions = new Set(['view', 'feedback', 'ticket', 'approve', 'manage-colleagues', 'manage-progress', 'manage-reviews', 'manage-support']);
const clientReview=review=>review?Object.fromEntries(['projectId','milestoneId','versionId','title','body','digest',...(review.deliverable===undefined?[]:['deliverable'])].map(key=>[key,review[key]])):null;
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
  #clock; #invitationPolicy; #deliverableScope;
  constructor(state, clock, policy,deliverableScope={}) {
    this.#deliverableScope=deliverableScope;
    this.#invitationPolicy=policy===undefined?undefined:invitationPolicy(policy);
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
  createClientAsAdmin(request) { return this.#createProjectAsAdmin(request,true); }
  createProjectAsAdmin(request) { return this.#createProjectAsAdmin(request,false); }
  #createProjectAsAdmin({actorId,businessId,projectId,stage,nextStep},newClient) {
    if(!this.workspaceAccess(actorId).admin)denied();
    this.#text(businessId,128);this.#text(projectId,128);
    const known=this.#state.projects.some(x=>x.businessId===businessId),existing=this.#state.projects.find(x=>x.id===projectId);
    if(!newClient&&!known)throw Error('BUSINESS_SCOPE_DENIED');
    if(newClient&&known&&!(existing?.businessId===businessId&&existing.createdForNewClient===true&&existing.createdByActorId===actorId))throw Error('CLIENT_CONFLICT');
    if(newClient&&!known&&new Set(this.#state.projects.map(x=>x.businessId)).size>=200)throw Error('CLIENT_CAPACITY');
    if(existing&&(existing.businessId!==businessId||existing.createdByActorId!==actorId))throw Error('PROJECT_CONFLICT');
    const expectedDigest=progressDigest({projectId,stage:null,nextStep:null});
    const operationId='create-project-'+progressDigest({projectId,stage:businessId,nextStep:actorId});
    if(existing)return {projectId,businessId,initialProgress:this.updateProjectProgress({actorId,projectId,stage,nextStep,expectedDigest,operationId})};
    if(this.#state.projects.filter(x=>x.businessId===businessId).length>=200)throw Error('PROJECT_CAPACITY');
    const next=structuredClone(this.#state);
    next.projects.push({id:projectId,businessId,createdByActorId:actorId,createdAt:this.#timestamp(),...(newClient?{createdForNewClient:true}:{})});
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
  adminAccounts(actorId,businessId) {
    if(!this.workspaceAccess(actorId).admin)denied();
    this.#text(businessId,128);
    if(!this.#state.projects.some(x=>x.businessId===businessId))throw Error('BUSINESS_SCOPE_DENIED');
    return structuredClone({businessId,accounts:this.#state.memberships.filter(x=>x.businessId===businessId).map(member=>({
      accountId:member.actorId,role:member.role,
      identityActive:this.#state.identities.find(x=>x.id===member.actorId)?.active===true,
      membershipActive:member.active,projectIds:[...member.projectIds].sort()
    }))});
  }
  // Trusted operator capability only. Do not expose this through client routes.
  provisionAccess(request) {
    const {uid,businessId,role,projectIds}=accessGrant(request);
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
  // Trusted internal invitation operations. Redemption identity/email must come
  // from the separate current Firebase SDK proof, never directly from HTTP input.
  createClientInvitation(request) { return this.#createInvitation(request,true); }
  createMemberInvitation(request) { return this.#createInvitation(request,false); }
  #createInvitation(request,clientOwner) {
    if(!request||Object.keys(request).sort().join(',')!=='actorId,businessId,email,expiresAt,operationId,projectIds,tokenHash'||typeof request.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(request.tokenHash))throw Error('INVALID_INVITATION');
    const policy=invitationPolicy(this.#invitationPolicy),createdAt=new Date(this.#timestamp()).toISOString();
    const {operationId,tokenHash,...input}=request,review=memberInvitation(this.#state,input,{now:createdAt,maxLifetimeMs:policy.maxLifetimeMs,clientOwner});
    const payload={kind:'invitation',operationId,...review};
    // The canonical digest binds the project array for the shared scalar retry contract.
    const retry=this.#retry(operationId,{kind:'invitation',operationId,digest:review.digest});if(retry)return {created:false,invitation:retry};
    if(this.#state.invitations?.some(x=>x.tokenHash===tokenHash))throw Error('INVITATION_TOKEN_CONFLICT');
    if((this.#state.invitations??[]).filter(x=>x.businessId===input.businessId).length>=200)throw Error('INVITATION_CAPACITY');
    const record={id:`invitation-${(this.#state.invitations?.length??0)+1}`,...payload,createdAt,policyRef:policy.ref,maxLifetimeMs:policy.maxLifetimeMs,tokenHash,status:'pending'};
    const next=structuredClone(this.#state);next.invitations??=[];next.invitations.push(record);this.#state=next;
    return {created:true,invitation:structuredClone(record)};
  }
  memberInvitationsFor(actorId,projectId) {
    const project=authorise(this.#state,actorId,projectId,this.workspaceAccess(actorId).admin?'manage-reviews':'manage-colleagues'),now=Date.parse(this.#timestamp());
    return structuredClone({projectId,invitations:(this.#state.invitations??[]).filter(x=>x.actorId===actorId&&x.businessId===project.businessId&&x.projectIds.includes(projectId)).map(record=>{
      let canRevoke=record.status==='pending';if(canRevoke)try{for(const id of record.projectIds)authorise(this.#state,actorId,id,record.role==='Owner'?'manage-reviews':'manage-colleagues');}catch{canRevoke=false;}
      return {invitationId:record.id,email:record.email,createdAt:record.createdAt,expiresAt:record.expiresAt,status:record.status,expired:record.status==='pending'&&Date.parse(record.expiresAt)<=now,canRevoke};
    })});
  }
  memberInvitationRecord(token) {
    const record=this.#state.invitations?.find(x=>matchesOpaqueToken(token,x.tokenHash));
    if(!record)throw Error('INVALID_INVITATION');return structuredClone(record);
  }
  #pendingInvitation(record,now) {
    const policy=invitationPolicy(this.#invitationPolicy);
    if(record.status!=='pending'||Date.parse(now)<Date.parse(record.createdAt)||Date.parse(record.expiresAt)<=Date.parse(now)||record.policyRef!==policy.ref||record.maxLifetimeMs!==policy.maxLifetimeMs)throw Error('INVALID_INVITATION');
    memberInvitation(this.#state,{actorId:record.actorId,businessId:record.businessId,email:record.email,projectIds:record.projectIds,expiresAt:record.expiresAt},{now,maxLifetimeMs:policy.maxLifetimeMs,clientOwner:record.role==='Owner'});
  }
  redeemMemberInvitation({token,recipientId,email}) {
    if(typeof recipientId!=='string'||!recipientId.trim()||recipientId.length>128||typeof email!=='string')throw Error('INVALID_INVITATION');
    const record=this.memberInvitationRecord(token);
    if(record.email.toLowerCase()!==email.toLowerCase())throw Error('INVITATION_RECIPIENT_MISMATCH');
    if(record.status==='redeemed'){if(record.recipientId!==recipientId)throw Error('INVALID_INVITATION');return {redeemed:true,alreadyRedeemed:true,invitationId:record.id};}
    const now=new Date(this.#timestamp()).toISOString();this.#pendingInvitation(record,now);
    const candidate=new PortalProof(this.#state,()=>now,this.#invitationPolicy);
    const existing=this.#state.memberships.find(x=>x.actorId===recipientId&&x.businessId===record.businessId);
    if(record.role==='Owner'&&existing){
      if(!existing.active)throw Error('ACCESS_REVOKED');
      if(existing.role!=='Owner')throw Error('ACCESS_ROLE_CONFLICT');
      if(!this.#state.identities.some(x=>x.id===recipientId&&x.active))throw Error('IDENTITY_DISABLED');
      candidate.updateAccess({uid:recipientId,businessId:record.businessId,role:'Owner',projectIds:[...new Set([...existing.projectIds,...record.projectIds])]});
    }else candidate.provisionAccess({uid:recipientId,businessId:record.businessId,role:record.role,projectIds:record.projectIds});
    const saved=candidate.#state.invitations.find(x=>x.id===record.id);saved.status='redeemed';saved.recipientId=recipientId;saved.redeemedAt=now;
    this.#state=candidate.snapshot();return {redeemed:true,alreadyRedeemed:false,invitationId:record.id};
  }
  revokeMemberInvitation({actorId,invitationId}) {
    const record=this.#state.invitations?.find(x=>x.id===invitationId&&x.actorId===actorId);if(!record)denied();
    for(const projectId of record.projectIds)authorise(this.#state,actorId,projectId,record.role==='Owner'?'manage-reviews':'manage-colleagues');
    if(record.status==='redeemed')throw Error('INVITATION_CONSUMED');
    if(record.status==='revoked')return {revoked:true,invitationId};
    const now=new Date(this.#timestamp()).toISOString();if(Date.parse(now)<Date.parse(record.createdAt))throw Error('INVALID_SERVER_TIME');
    const next=structuredClone(this.#state),saved=next.invitations.find(x=>x.id===invitationId);saved.status='revoked';saved.revokedAt=now;this.#state=next;return {revoked:true,invitationId};
  }
  colleaguesFor(actorId,projectId) {
    const project=authorise(this.#state,actorId,projectId,'manage-colleagues');
    return {projectId,businessId:project.businessId,accounts:this.#state.memberships.filter(x=>x.businessId===project.businessId&&x.role==='Member').map(x=>({accountId:x.actorId,identityActive:this.#state.identities.find(i=>i.id===x.actorId)?.active===true,membershipActive:x.active,hasProjectAccess:x.projectIds.includes(projectId)}))};
  }
  colleagueAccessGrant(request) {
    const {actorId,projectId,uid,grant}=colleagueAccessRequest(request),project=authorise(this.#state,actorId,projectId,'manage-colleagues');
    const member=this.#state.memberships.find(x=>x.actorId===uid&&x.businessId===project.businessId);
    if(!member)throw Error('ACCESS_MEMBERSHIP_REQUIRED');
    if(member.role!=='Member')throw Error('ACCESS_ROLE_CONFLICT');
    const projectIds=grant?[...new Set([...member.projectIds,projectId])]:member.projectIds.filter(x=>x!==projectId);
    return {uid,businessId:project.businessId,role:'Member',projectIds};
  }
  updateColleagueAccess(request) { return this.updateAccess(this.colleagueAccessGrant(request)); }
  updateAccessAsAdmin(request) {
    const {actorId,expectedRevision,...grant}=adminAccessRequest(request);
    if(!this.workspaceAccess(actorId).admin)denied();
    return this.updateAccess(grant);
  }
  // Trusted operator only. Existing business role, activation and admin flags stay intact.
  updateAccess(request) {
    const {uid,businessId,role,projectIds}=accessGrant(request,{allowEmpty:true});
    if(projectIds.some(id=>this.#state.projects.find(x=>x.id===id)?.businessId!==businessId))throw Error('PROJECT_SCOPE_DENIED');
    const identity=this.#state.identities.find(x=>x.id===uid),membership=this.#state.memberships.find(x=>x.actorId===uid&&x.businessId===businessId);
    if(!identity||!membership)throw Error('ACCESS_MEMBERSHIP_REQUIRED');
    if(membership.role!==role)throw Error('ACCESS_ROLE_CONFLICT');
    const previousProjectIds=[...membership.projectIds].sort(),added=projectIds.some(id=>!previousProjectIds.includes(id));
    if(added&&!identity.active)throw Error('IDENTITY_DISABLED');
    if(added&&!membership.active)throw Error('ACCESS_REVOKED');
    const result={changed:JSON.stringify(previousProjectIds)!==JSON.stringify(projectIds),identityId:uid,businessId,role,projectIds,previousProjectIds};
    if(result.changed){const next=structuredClone(this.#state);next.memberships.find(x=>x.actorId===uid&&x.businessId===businessId).projectIds=projectIds;this.#state=next;}
    return structuredClone(result);
  }
  // Server-verified admin capability. Client membership cannot publish.
  createMilestoneAsAdmin({actorId,projectId,milestoneId,versionId,title,body,deliverable}) {
    authorise(this.#state,actorId,projectId,'manage-reviews');
    this.#text(milestoneId,128);
    const existing=this.#state.milestones.find(x=>x.id===milestoneId);
    if(existing){
      if(existing.projectId!==projectId||existing.createdByActorId!==actorId||existing.reviews?.[0]?.versionId!==versionId)throw Error('MILESTONE_CONFLICT');
      return {milestoneId,projectId,review:this.publishReview({projectId,milestoneId,versionId,title,body,...(deliverable===undefined?{}:{deliverable})})};
    }
    if(this.#state.milestones.filter(x=>x.projectId===projectId).length>=200)throw Error('MILESTONE_CAPACITY');
    const next=structuredClone(this.#state);
    next.milestones.push({id:milestoneId,projectId,currentVersionId:versionId,status:'awaiting-client',createdByActorId:actorId,createdAt:this.#timestamp()});
    const candidate=new PortalProof(next,this.#clock);
    const review=candidate.publishReviewAsAdmin({actorId,projectId,milestoneId,versionId,title,body,...(deliverable===undefined?{}:{deliverable}),expectedVersionId:versionId});
    this.#state=candidate.snapshot();return {milestoneId,projectId,review};
  }
  publishReviewAsAdmin({actorId,projectId,milestoneId,versionId,title,body,deliverable,expectedVersionId}) {
    authorise(this.#state,actorId,projectId,'manage-reviews');
    this.#text(expectedVersionId,128);
    const milestone=this.#state.milestones.find(x=>x.id===milestoneId&&x.projectId===projectId);
    if(!milestone)denied();
    const request={projectId,milestoneId,versionId,title,body,...(deliverable===undefined?{}:{deliverable})};
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
    const fields=['projectId','milestoneId','versionId','title','body',...(request&&Object.hasOwn(request,'deliverable')?['deliverable']:[])];
    if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key)))throw Error('INVALID_REVIEW');
    const {projectId,milestoneId,versionId,title,body}=request;
    for(const value of [projectId,milestoneId,versionId])this.#text(value,128);
    this.#text(title,200);this.#text(body,10000);
    const milestone=this.#state.milestones.find(x=>x.id===milestoneId&&x.projectId===projectId);
    if(!milestone)denied();
    const review={projectId,milestoneId,versionId,title,body,...(request.deliverable===undefined?{}:{deliverable:reviewDeliverable(request.deliverable)})};review.digest=reviewDigest(review);
    const existing=milestone.reviews?.find(x=>x.versionId===versionId);
    if(existing){if(existing.digest!==review.digest)throw Error('REVIEW_IMMUTABLE');return structuredClone(existing);}
    // A previously approved legacy version cannot acquire new review content.
    if(this.#state.receipts.some(x=>x.milestoneId===milestoneId&&x.versionId===versionId))throw Error('REVIEW_IMMUTABLE');
    milestone.reviews??=[];milestone.reviews.push(review);milestone.reviewRequired=true;
    milestone.currentVersionId=versionId;milestone.status='awaiting-client';
    return structuredClone(review);
  }
  // Internal instance capability; never included in client projections.
  deliverableScope(){return this.#deliverableScope;}
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
    let canManageColleagues=false;try{authorise(this.#state,actorId,projectId,'manage-colleagues');canManageColleagues=true;}catch{}
    const milestones = this.#state.milestones.filter(x => x.projectId === projectId).map(({reviews,createdByActorId,createdAt,...milestone}) => ({...milestone,...(milestone.reviewRequired ? {review:clientReview(reviews?.find(x=>x.versionId===milestone.currentVersionId))} : {})}));
    return structuredClone({
      projectId, canApprove, canManageColleagues, stage: project.stage ?? null, nextStep: project.nextStep ?? null,
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
    const existing = [...this.#state.receipts, ...this.#state.feedback, ...this.#state.tickets, ...this.#state.replies,...(this.#state.invitations??[]),...this.#state.projects.flatMap(x=>x.progressHistory??[]),...this.#state.tickets.flatMap(x=>x.triageHistory??[])].find(x => x.operationId === operationId);
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
  approve({ actorId, projectId, milestoneId, versionId, operationId, reviewDigest: digest },deliverableProof) {
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
    const deliverable=milestone.reviews?.find(x=>x.versionId===versionId)?.deliverable;
    if(deliverable&&!verifiedDeliverableProof(deliverableProof,{actorId,projectId,milestoneId,versionId,reviewDigest:digest,deliverable,scope:this.#deliverableScope}))throw Error('DELIVERABLE_UNAVAILABLE');
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
