import {createHash} from 'node:crypto';
import {authorise} from './domain.mjs';
// Member invitation contract. Tokens/delivery and verified-email redemption are
// separate integration steps; this preflight grants no account permissions.
export function memberInvitation(state,request,{now,maxLifetimeMs}) {
  const fields=['actorId','businessId','email','projectIds','expiresAt'];
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).sort().join(',')!==fields.sort().join(',')||['actorId','businessId'].some(key=>typeof request[key]!=='string'||!request[key].trim()||request[key].length>128)||typeof request.email!=='string'||request.email.length>320||request.email.trim()!==request.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)||!Array.isArray(request.projectIds)||!request.projectIds.length||request.projectIds.length>50||new Set(request.projectIds).size!==request.projectIds.length||request.projectIds.some(id=>typeof id!=='string'||!id.trim()||id.length>128))throw Error('INVALID_INVITATION');
  if(typeof now!=='string'||!Number.isFinite(Date.parse(now))||!Number.isSafeInteger(maxLifetimeMs)||maxLifetimeMs<=0)throw Error('INVALID_INVITATION_POLICY');
  if(typeof request.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(request.expiresAt)||!Number.isFinite(Date.parse(request.expiresAt))||new Date(request.expiresAt).toISOString()!==request.expiresAt||Date.parse(request.expiresAt)<=Date.parse(now)||Date.parse(request.expiresAt)-Date.parse(now)>maxLifetimeMs)throw Error('INVALID_INVITATION_EXPIRY');
  for(const id of request.projectIds){const project=authorise(state,request.actorId,id,'manage-colleagues');if(project.businessId!==request.businessId)throw Error('PROJECT_SCOPE_DENIED');}
  const result={actorId:request.actorId,businessId:request.businessId,email:request.email,role:'Member',projectIds:[...request.projectIds].sort(),expiresAt:request.expiresAt};
  return {...result,digest:createHash('sha256').update(JSON.stringify(result)).digest('hex')};
}
