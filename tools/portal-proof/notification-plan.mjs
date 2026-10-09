import {validEmailAddress} from './email-address.mjs';
import {validatePortalState} from './state.mjs';
// Read-only planning over the existing durable notification intents. No email
// lookup, message content, sender, acknowledgement or delivery occurs here.
export function planNotification(state,intentId,policy) {
  validatePortalState(state);
  const keys=['adminEmail','clientAudience','portalOrigin','productId','ref'];
  if(!policy||typeof policy!=='object'||Array.isArray(policy)||Object.keys(policy).sort().join(',')!==keys.sort().join(',')||typeof policy.ref!=='string'||!policy.ref.trim()||policy.ref.length>128||typeof policy.productId!=='string'||!/^[a-z][a-z0-9-]{1,62}$/.test(policy.productId)||!validEmailAddress(policy.adminEmail)||!['ticket-participants','project-members'].includes(policy.clientAudience))throw Error('NOTIFICATION_POLICY_REQUIRED');
  let origin;try{origin=new URL(policy.portalOrigin);if(origin.protocol!=='https:'||origin.origin!==policy.portalOrigin)throw Error();}catch{throw Error('NOTIFICATION_POLICY_REQUIRED');}
  if(typeof intentId!=='string'||!intentId||intentId.length>128)throw Error('INVALID_NOTIFICATION');
  const intent=state.outbox.find(x=>x.id===intentId);if(!intent||intent.status!=='pending')throw Error('INVALID_NOTIFICATION');
  const collections={'milestone-approved':'receipts','feedback-saved':'feedback','ticket-created':'tickets','ticket-replied':'replies'};
  // Shared validation binds each intent to its immutable business/project record.
  const collection=collections[intent.type];if(!collection)throw Error('INVALID_NOTIFICATION');
  const record=state[collection].find(x=>x.id===intent.receiptId);if(!record)throw Error('INVALID_NOTIFICATION');
  let eligible=[];
  if(['ticket-created','ticket-replied'].includes(intent.type)){
    const ticketId=intent.type==='ticket-created'?record.id:record.ticketId;
    const ticket=state.tickets.find(x=>x.id===ticketId&&x.projectId===record.projectId&&x.businessId===record.businessId);if(!ticket)throw Error('INVALID_NOTIFICATION');
    const participants=new Set([ticket.actorId,...state.replies.filter(x=>x.ticketId===ticketId&&x.projectId===record.projectId&&x.businessId===record.businessId).map(x=>x.actorId)]);
    eligible=state.memberships.filter(x=>x.active&&x.businessId===record.businessId&&x.projectIds.includes(record.projectId)&&['Owner','Member'].includes(x.role)&&state.identities.some(i=>i.id===x.actorId&&i.active)&&(policy.clientAudience==='project-members'||participants.has(x.actorId))).map(x=>x.actorId);
  }
  return {schemaVersion:1,productId:policy.productId,policyRef:policy.ref,intentId:intent.id,eventType:intent.type,adminEmail:policy.adminEmail,clientActorIds:[...new Set(eligible)].sort(),portalUrl:origin.origin+'/'};
}

// Trusted worker/operator entry point bound to the selected product adapter.
// Recipient addresses still require current Firebase verification at delivery.
export function createNotificationPlanner({portal,productId}) {
  if(typeof portal?.snapshot!=='function'||typeof productId!=='string'||!/^[a-z][a-z0-9-]{1,62}$/.test(productId))throw Error('INVALID_CONFIGURATION');
  return async(intentId,policy)=>{
    const bound=structuredClone(policy);
    if(bound?.productId!==productId)throw Error('NOTIFICATION_PRODUCT_MISMATCH');
    return planNotification(await portal.snapshot(),intentId,bound);
  };
}
