import {createHash} from 'node:crypto';
const text=(v,max)=>typeof v==='string'&&Boolean(v.trim())&&v.length<=max;
const canonicalDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function invitationPolicy(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='maxLifetimeMs,ref'||!text(value.ref,128)||!Number.isSafeInteger(value.maxLifetimeMs)||value.maxLifetimeMs<=0)throw Error('INVITATION_POLICY_REQUIRED');
  return {...value};
}
export function invitationDigest(value) {
  const fields={actorId:value.actorId,businessId:value.businessId,email:value.email,role:'Member',projectIds:value.projectIds,expiresAt:value.expiresAt};
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
export function validateInvitations(state,operations) {
  if(state.invitations===undefined)return;
  const fail=()=>{throw Error('CORRUPT_PORTAL_STATE');};
  if(!Array.isArray(state.invitations))fail();
  const ids=new Set(),tokens=new Set(),counts=new Map();
  for(const record of state.invitations){
    if(!record||typeof record!=='object'||Array.isArray(record))fail();
    const fields=['id','kind','operationId','actorId','businessId','email','role','projectIds','expiresAt','createdAt','policyRef','maxLifetimeMs','tokenHash','digest','status',...(record.status==='redeemed'?['recipientId','redeemedAt']:record.status==='revoked'?['revokedAt']:[])];
    if(Object.keys(record).sort().join(',')!==fields.sort().join(',')||!/^invitation-[1-9]\d*$/.test(record.id)||record.kind!=='invitation'||!text(record.operationId,128)||operations.has(record.operationId)||ids.has(record.id)||tokens.has(record.tokenHash)||!state.identities.some(x=>x.id===record.actorId)||!text(record.email,320)||record.email.trim()!==record.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)||record.role!=='Member'||!Array.isArray(record.projectIds)||!record.projectIds.length||record.projectIds.length>50||new Set(record.projectIds).size!==record.projectIds.length||JSON.stringify(record.projectIds)!==JSON.stringify([...record.projectIds].sort())||record.projectIds.some(id=>!state.projects.some(x=>x.id===id&&x.businessId===record.businessId))||!canonicalDate(record.createdAt)||!canonicalDate(record.expiresAt)||Date.parse(record.createdAt)>=Date.parse(record.expiresAt)||!text(record.policyRef,128)||!Number.isSafeInteger(record.maxLifetimeMs)||record.maxLifetimeMs<=0||Date.parse(record.expiresAt)-Date.parse(record.createdAt)>record.maxLifetimeMs||typeof record.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(record.tokenHash)||record.digest!==invitationDigest(record)||!['pending','redeemed','revoked'].includes(record.status))fail();
    if(record.status==='redeemed'&&(!state.identities.some(x=>x.id===record.recipientId)||!state.memberships.some(x=>x.actorId===record.recipientId&&x.businessId===record.businessId)||!canonicalDate(record.redeemedAt)||Date.parse(record.redeemedAt)<Date.parse(record.createdAt)||Date.parse(record.redeemedAt)>=Date.parse(record.expiresAt)))fail();
    if(record.status==='revoked'&&(!canonicalDate(record.revokedAt)||Date.parse(record.revokedAt)<Date.parse(record.createdAt)))fail();
    const count=(counts.get(record.businessId)??0)+1;if(count>200)fail();counts.set(record.businessId,count);ids.add(record.id);tokens.add(record.tokenHash);operations.add(record.operationId);
  }
}
