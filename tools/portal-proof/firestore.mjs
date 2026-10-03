import {invitationPolicy} from './invitation-state.mjs';
import {colleagueAccessRequest} from './colleague-access.mjs';
import {adminAccessAudit,adminAccessRequest} from './admin-access.mjs';
import {inspectAccess} from './access.mjs';
import {operatorContext} from './operator-audit.mjs';
import {PortalProof} from './domain.mjs';
import {validatePortalState} from './state.mjs';

export const MAX_STATE_BYTES=512*1024;
const product=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{1,62}$/.test(value);
function encode(state) {
  const json=JSON.stringify(validatePortalState(state));
  if(Buffer.byteLength(json)>MAX_STATE_BYTES)throw Error('STATE_CAPACITY');
  return json;
}
function decode(document) {
  try {
    if(!document.exists)throw Error();
    const data=document.data();
    if(data.schemaVersion!==1||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.stateJson!=='string'||Buffer.byteLength(data.stateJson)>MAX_STATE_BYTES)throw Error();
    const state=validatePortalState(JSON.parse(data.stateJson));
    if(state.operatorAudit?.some(entry=>entry.revision>data.revision))throw Error();
    return {state,revision:data.revision};
  } catch {throw Error('CORRUPT_PORTAL_STATE');}
}
// Bounded per-product aggregate adapter. Reuses the domain and integrity checks.
// Firestore transactions commit domain data and outbox intent atomically. No
// network side effects occur in callbacks, which Firestore may rerun on conflict.
export class FirestorePortal {
  #db; #ref; #clock; #backupBinding; #invitationPolicy;
  constructor({db,productId,backupBinding,clock=()=>new Date().toISOString(),invitationPolicy:policy}) {
    if(typeof db?.doc!=='function'||typeof db?.runTransaction!=='function'||!product(productId)||typeof clock!=='function')throw Error('INVALID_CONFIGURATION');
    if(backupBinding&&backupBinding.productId!==productId)throw Error('INVALID_CONFIGURATION');
    this.#invitationPolicy=policy===undefined?undefined:invitationPolicy(policy);
    this.#backupBinding=backupBinding?structuredClone(backupBinding):undefined;
    this.#db=db;this.#clock=clock;
    this.#ref=db.doc(`wvd_products/${productId}/private/portal-state`);
  }
  // Trusted provisioning API only; never exposed as a client route. Firebase UIDs
  // must be supplied as identity IDs. Existing product data is never overwritten.
  async initialize(state) {
    const normalized=new PortalProof(state,this.#clock,this.#invitationPolicy).snapshot();
    if(normalized.operatorAudit?.length)throw Error('CORRUPT_PORTAL_STATE');
    const stateJson=encode(normalized);
    return this.#db.runTransaction(async transaction=>{
      const document=await transaction.get(this.#ref);
      if(document.exists){decode(document);return {created:false};}
      transaction.create(this.#ref,{schemaVersion:1,revision:0,stateJson});return {created:true};
    });
  }
  async #run(method,args,expectedRevision,audit) {
    // A retry of the same transaction uses the same captured server time.
    const timestamp=this.#clock();
    return this.#db.runTransaction(async transaction=>{
      const document=await transaction.get(this.#ref),{state,revision}=decode(document);
      const model=new PortalProof(state,()=>timestamp,this.#invitationPolicy),before=encode(model.snapshot());
      if(method==='updateAccessAsAdmin'&&!model.workspaceAccess(args[0].actorId).admin)throw Error('ACCESS_DENIED');
      if(method==='updateColleagueAccess')model.colleagueAccessGrant(args[0]);
      if(expectedRevision!==undefined&&revision!==expectedRevision)throw Error('ACCESS_REVISION_CONFLICT');
      const result=model[method](...args),next=model.snapshot();
      if(encode(next)!==before) {
        if(revision>=Number.MAX_SAFE_INTEGER)throw Error('REVISION_EXHAUSTED');
        if(['updateAccessAsAdmin','updateColleagueAccess'].includes(method)){next.operatorAudit??=[];next.operatorAudit.push(adminAccessAudit(result,args[0].actorId,revision+1,timestamp,method==='updateColleagueAccess'?'owner-project-access':'portal-project-access'));}
        if(audit) {
          const target=['provisionAccess','updateAccess'].includes(method)?{uid:result.identityId,businessId:result.businessId,role:result.role,projectIds:result.projectIds,...(method==='updateAccess'?{previousProjectIds:result.previousProjectIds}:{})}:{projectId:result.projectId,milestoneId:result.milestoneId,versionId:result.versionId,digest:result.digest};
          next.operatorAudit??=[];
          next.operatorAudit.push({id:`operator-${revision+1}`,revision:revision+1,action:method,...audit,timestamp,...target});
        }
        transaction.update(this.#ref,{stateJson:encode(next),revision:revision+1});
      }
      if(['adminAccounts','colleaguesFor'].includes(method))result.revision=revision;
      return result;
    },{maxAttempts:5});
  }
  // Privileged operator read; no public HTTP route.
  async backupSnapshot() {
    if(!this.#backupBinding)throw Error('BACKUP_BINDING_REQUIRED');
    const document=await this.#ref.get();return {...decode(document),binding:structuredClone(this.#backupBinding)};
  }
  async inspectAccess(request) {
    const {state,revision}=decode(await this.#ref.get());
    return {...inspectAccess(state,request),revision};
  }
  async accessRevision() {
    const document=await this.#ref.get();return decode(document).revision;
  }
  async publishReview(request,expectedRevision,context) {
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    return this.#run('publishReview',[structuredClone(request)],expectedRevision,operatorContext(context));
  }
  async provisionAccess(request,expectedRevision,context) {
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    return this.#run('provisionAccess',[structuredClone(request)],expectedRevision,operatorContext(context));
  }
  async updateColleagueAccess(request) { const input=colleagueAccessRequest(request);return this.#run('updateColleagueAccess',[input],input.expectedRevision); }
  async updateAccessAsAdmin(request) {
    const input=adminAccessRequest(request);
    return this.#run('updateAccessAsAdmin',[input],input.expectedRevision);
  }
  async updateAccess(request,expectedRevision,context) {
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
    return this.#run('updateAccess',[structuredClone(request)],expectedRevision,operatorContext(context));
  }
  async activeIdentity(uid) {
    if(typeof uid!=='string'||!uid||uid.length>128)return false;
    const state=await this.snapshot();return state.identities.some(x=>x.id===uid&&x.active);
  }
  snapshot(){return this.#run('snapshot',[]);}
  projectsFor(...args){return this.#run('projectsFor',args);}
  workspaceAccess(...args){return this.#run('workspaceAccess',args);}
  adminOverview(...args){return this.#run('adminOverview',args);}
  createMemberInvitation(...args) { return this.#run('createMemberInvitation', args); }
  memberInvitationRecord(...args) { return this.#run('memberInvitationRecord', args); }
  redeemMemberInvitation(...args) { return this.#run('redeemMemberInvitation', args); }
  revokeMemberInvitation(...args) { return this.#run('revokeMemberInvitation', args); }
  colleaguesFor(...args) { return this.#run('colleaguesFor', args); }
  colleagueAccessGrant(...args) { return this.#run('colleagueAccessGrant', args); }
  adminAccounts(...args) { return this.#run('adminAccounts', args); }
  updateProjectProgress(...args){return this.#run('updateProjectProgress',args);}
  publishReviewAsAdmin(...args){return this.#run('publishReviewAsAdmin',args);}
  createMilestoneAsAdmin(...args){return this.#run('createMilestoneAsAdmin',args);}
  createClientAsAdmin(...args) { return this.#run('createClientAsAdmin', args); }
  createProjectAsAdmin(...args){return this.#run('createProjectAsAdmin',args);}
  triageTicket(...args){return this.#run('triageTicket',args);}
  ticketsFor(...args){return this.#run('ticketsFor',args);}
  authorise(...args){return this.#run('authorise',args);}
  projectOverview(...args){return this.#run('projectOverview',args);}
  approve(...args){return this.#run('approve',args);}
  submitFeedback(...args){return this.#run('submitFeedback',args);}
  createTicket(...args){return this.#run('createTicket',args);}
  readTicket(...args){return this.#run('readTicket',args);}
  replyToTicket(...args){return this.#run('replyToTicket',args);}
  revokeMembership(...args){return this.#run('revokeMembership',args);}
  replaceVersion(...args){return this.#run('replaceVersion',args);}
}
