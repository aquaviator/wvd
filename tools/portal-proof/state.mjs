import {reviewDigest} from './review.mjs';
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
    if(milestone.reviewRequired!==undefined && typeof milestone.reviewRequired!=='boolean')corrupt();
    if(milestone.reviews!==undefined) {
      if(!Array.isArray(milestone.reviews)||!milestone.reviewRequired)corrupt();
      const versions=new Set();
      for(const review of milestone.reviews) {
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
  for (const intent of state.outbox) {
    const linked = records.get(intent.receiptId);
    if (!linked || intent.id !== intent.receiptId || intent.type !== linked.eventType) corrupt();
  }
  // This proof persists one pending intent with every domain write; no dispatcher
  // removes intents, so a missing link indicates an incomplete/tampered aggregate.
  if (state.outbox.length !== records.size) corrupt();
  return state;
}

