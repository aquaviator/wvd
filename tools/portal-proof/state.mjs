import {validateInvitations} from './invitation-state.mjs';
import {validateOperatorAudit} from './operator-audit.mjs';
import {reviewDigest} from './review.mjs';
import {progressDigest} from './progress.mjs';
import {careAssessments,ticketTriageDigest} from './triage.mjs';
// Shared state integrity checks for local and Google persistence adapters.
const collections = ['identities','projects','memberships','milestones','receipts','outbox','feedback','tickets','replies'];
const string = value => typeof value === 'string' && value.length > 0;
export function validatePortalState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('CORRUPT_PORTAL_STATE');
  for (const name of collections) {
    if (!Array.isArray(state[name]) || state[name].some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('CORRUPT_PORTAL_STATE');
  }
  if (state.identities.some(x => !string(x.id) || typeof x.active !== 'boolean' || (x.wvdAdmin !== undefined && typeof x.wvdAdmin !== 'boolean')) ||
      state.projects.some(x => !string(x.id) || !string(x.businessId)) ||
      state.memberships.some(x => !string(x.actorId) || !string(x.businessId) || typeof x.active !== 'boolean' || !['Owner','Member'].includes(x.role) || !Array.isArray(x.projectIds) || x.projectIds.some(id => !string(id))) ||
      state.milestones.some(x => !string(x.id) || !string(x.projectId) || !string(x.currentVersionId) || !string(x.status))) throw new Error('CORRUPT_PORTAL_STATE');
  for (const name of ['receipts','feedback','tickets','replies']) {
    if (state[name].some(x => !string(x.id) || !string(x.operationId) || !string(x.actorId) || !string(x.projectId))) throw new Error('CORRUPT_PORTAL_STATE');
  }
  if (state.outbox.some(x => !string(x.id) || !string(x.receiptId) || !string(x.type) || !string(x.status))) throw new Error('CORRUPT_PORTAL_STATE');
  const corrupt = () => { throw new Error('CORRUPT_PORTAL_STATE'); };
  for (const name of collections.filter(x => x !== 'memberships')) {
    const ids = state[name].map(x => x.id);
    if (new Set(ids).size !== ids.length) corrupt();
  }
  const identities = new Map(state.identities.map(x => [x.id,x]));
  const projects = new Map(state.projects.map(x => [x.id,x]));
  const milestones = new Map(state.milestones.map(x => [x.id,x]));
  const tickets = new Map(state.tickets.map(x => [x.id,x]));
  const memberships = new Set();
  for (const member of state.memberships) {
    const key = JSON.stringify([member.actorId,member.businessId]);
    if (memberships.has(key) || !identities.has(member.actorId) || !state.projects.some(x => x.businessId === member.businessId) || new Set(member.projectIds).size !== member.projectIds.length || member.projectIds.some(id => projects.get(id)?.businessId !== member.businessId)) corrupt();
    memberships.add(key);
  }
  for (const milestone of state.milestones) if (!projects.has(milestone.projectId)) corrupt();
  for(const milestone of state.milestones) {
    if((milestone.createdByActorId===undefined)!==(milestone.createdAt===undefined)||(milestone.createdByActorId!==undefined&&(!identities.has(milestone.createdByActorId)||typeof milestone.createdAt!=='string'||!Number.isFinite(Date.parse(milestone.createdAt))||!milestone.reviews?.length)))corrupt();
    if(milestone.reviewRequired!==undefined && typeof milestone.reviewRequired!=='boolean')corrupt();
    if(milestone.reviews!==undefined) {
      if(!Array.isArray(milestone.reviews)||!milestone.reviewRequired)corrupt();
      const versions=new Set();
      for(const review of milestone.reviews) {
        if((review.publisherActorId===undefined)!==(review.publishedAt===undefined)||(review.publisherActorId!==undefined&&(!identities.has(review.publisherActorId)||typeof review.publishedAt!=='string'||!Number.isFinite(Date.parse(review.publishedAt)))))corrupt();
        if(!review||review.projectId!==milestone.projectId||review.milestoneId!==milestone.id||!string(review.versionId)||review.versionId.length>128||!string(review.title)||!review.title.trim()||review.title.length>200||!string(review.body)||!review.body.trim()||review.body.length>10000||versions.has(review.versionId)||review.digest!==reviewDigest(review))corrupt();
        versions.add(review.versionId);
      }
    }
  }
  const records = new Map(), operations = new Set();
  const types = {receipts:['approval','milestone-approved'],feedback:['feedback','feedback-saved'],tickets:['ticket','ticket-created'],replies:['reply','ticket-replied']};
  for (const [name,[kind,eventType]] of Object.entries(types)) {
    for (const record of state[name]) {
      const project = projects.get(record.projectId);
      if (records.has(record.id) || operations.has(record.operationId) || !identities.has(record.actorId) || !project || record.businessId !== project.businessId || record.kind !== kind) corrupt();
      if (name === 'receipts' || name === 'feedback') {
        // Historical versions intentionally survive replacement of currentVersionId.
        if (!string(record.versionId) || milestones.get(record.milestoneId)?.projectId !== record.projectId) corrupt();
      }
      if(name==='receipts') {
        const review=milestones.get(record.milestoneId)?.reviews?.find(x=>x.versionId===record.versionId);
        if((review||record.reviewDigest!==undefined) && review?.digest!==record.reviewDigest)corrupt();
      }
      if (name === 'replies') {
        const ticket = tickets.get(record.ticketId);
        if (!ticket || ticket.projectId !== record.projectId || ticket.businessId !== record.businessId) corrupt();
      }
      records.set(record.id,{record,eventType}); operations.add(record.operationId);
    }
  }
  const progressIds=new Set(),newClients=new Set();
  for(const project of state.projects) {
    if(project.createdForNewClient!==undefined){if(project.createdForNewClient!==true||project.createdByActorId===undefined||newClients.has(project.businessId))corrupt();newClients.add(project.businessId);}
    if((project.createdByActorId===undefined)!==(project.createdAt===undefined)||(project.createdByActorId!==undefined&&(!identities.has(project.createdByActorId)||typeof project.createdAt!=='string'||!Number.isFinite(Date.parse(project.createdAt))||!project.progressHistory?.length||project.progressHistory[0].actorId!==project.createdByActorId)))corrupt();
    if(project.progressHistory===undefined)continue;
    if(!Array.isArray(project.progressHistory)||project.progressHistory.length>200)corrupt();
    let previous;
    for(const entry of project.progressHistory) {
      const fields=['actorId','businessId','digest','expectedDigest','id','kind','nextStep','operationId','projectId','stage','timestamp'];
      if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!==fields.sort().join(',')||entry.kind!=='progress'||!string(entry.id)||records.has(entry.id)||progressIds.has(entry.id)||!string(entry.operationId)||entry.operationId.length>128||operations.has(entry.operationId)||!identities.has(entry.actorId)||entry.projectId!==project.id||entry.businessId!==project.businessId||!string(entry.stage)||!entry.stage.trim()||entry.stage.length>200||!string(entry.nextStep)||!entry.nextStep.trim()||entry.nextStep.length>2000||typeof entry.timestamp!=='string'||!Number.isFinite(Date.parse(entry.timestamp))||typeof entry.expectedDigest!=='string'||!/^[a-f0-9]{64}$/.test(entry.expectedDigest)||entry.digest!==progressDigest(entry)||(previous!==undefined&&entry.expectedDigest!==previous))corrupt();
      previous=entry.digest;operations.add(entry.operationId);progressIds.add(entry.id);
    }
    if(previous!==undefined&&previous!==progressDigest({projectId:project.id,stage:project.stage,nextStep:project.nextStep}))corrupt();
  }
  const triageIds=new Set();
  for(const ticket of state.tickets) {
    if(ticket.triage===undefined&&ticket.triageHistory===undefined)continue;
    if(!ticket.triage||typeof ticket.triage!=='object'||Array.isArray(ticket.triage)||Object.keys(ticket.triage).sort().join(',')!=='careAssessment,digest,note,priority,timestamp'||!Array.isArray(ticket.triageHistory)||!ticket.triageHistory.length||ticket.triageHistory.length>200)corrupt();
    let previous=ticketTriageDigest({projectId:ticket.projectId,ticketId:ticket.id});
    for(const entry of ticket.triageHistory) {
      const fields=['actorId','businessId','careAssessment','digest','expectedDigest','id','kind','note','operationId','priority','projectId','ticketId','timestamp'];
      if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!==fields.sort().join(',')||entry.kind!=='triage'||!string(entry.id)||records.has(entry.id)||progressIds.has(entry.id)||triageIds.has(entry.id)||!string(entry.operationId)||entry.operationId.length>128||operations.has(entry.operationId)||!identities.has(entry.actorId)||entry.projectId!==ticket.projectId||entry.businessId!==ticket.businessId||entry.ticketId!==ticket.id||!string(entry.priority)||!entry.priority.trim()||entry.priority.length>100||!string(entry.note)||!entry.note.trim()||entry.note.length>2000||!careAssessments.includes(entry.careAssessment)||typeof entry.timestamp!=='string'||!Number.isFinite(Date.parse(entry.timestamp))||entry.expectedDigest!==previous||entry.digest!==ticketTriageDigest({projectId:entry.projectId,ticketId:entry.ticketId,triage:entry}))corrupt();
      previous=entry.digest;operations.add(entry.operationId);triageIds.add(entry.id);
    }
    const last=ticket.triageHistory.at(-1);
    if(['priority','careAssessment','note','timestamp','digest'].some(key=>ticket.triage[key]!==last[key]))corrupt();
  }
  validateInvitations(state,operations);
  for (const intent of state.outbox) {
    const linked = records.get(intent.receiptId);
    if (!linked || intent.id !== intent.receiptId || intent.type !== linked.eventType) corrupt();
  }
  // This proof persists one pending intent with every domain write; no dispatcher
  // removes intents, so a missing link indicates an incomplete/tampered aggregate.
  if (state.outbox.length !== records.size) corrupt();
  validateOperatorAudit(state);
  return state;
}
