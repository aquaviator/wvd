import {accessGrant} from './access.mjs';
// Shared audit projection, used inside the same transaction as the permission write.
export function adminAccessAudit(result,actorId,revision,timestamp,changeRef='portal-project-access') {
  return {id:`operator-${revision}`,revision,action:'updateAccess',operatorRef:actorId,changeRef,timestamp,uid:result.identityId,businessId:result.businessId,role:result.role,projectIds:result.projectIds,previousProjectIds:result.previousProjectIds};
}
export function adminAccessRequest(request) {
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).sort().join(',')!=='actorId,businessId,expectedRevision,projectIds,role,uid'||typeof request.actorId!=='string'||!request.actorId.trim()||request.actorId.length>128)throw Error('INVALID_ACCESS_GRANT');
  if(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)throw Error('ACCESS_REVISION_REQUIRED');
  const {actorId,expectedRevision,...grant}=request;
  return {actorId,expectedRevision,...accessGrant(grant,{allowEmpty:true})};
}
