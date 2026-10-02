// Shared trusted-operator input contract; no role or identity defaults.
export function accessGrant(request,{allowEmpty=false}={}) {
  const fields=['uid','businessId','role','projectIds'],text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=128;
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key))||!text(request.uid)||!text(request.businessId)||!['Owner','Member'].includes(request.role)||!Array.isArray(request.projectIds)||(!allowEmpty&&!request.projectIds.length)||request.projectIds.length>50||request.projectIds.some(id=>!text(id))||new Set(request.projectIds).size!==request.projectIds.length)throw Error('INVALID_ACCESS_GRANT');
  return {uid:request.uid,businessId:request.businessId,role:request.role,projectIds:[...request.projectIds].sort()};
}

// Minimal privileged inspection; does not expose other memberships or admin flags.
export function inspectAccess(state,request) {
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).sort().join(',')!=='businessId,uid'||['uid','businessId'].some(key=>typeof request[key]!=='string'||!request[key].trim()||request[key].length>128))throw Error('INVALID_ACCESS_GRANT');
  const member=state.memberships.find(x=>x.actorId===request.uid&&x.businessId===request.businessId);
  const identity=state.identities.find(x=>x.id===request.uid);
  if(!member||!identity)throw Error('ACCESS_MEMBERSHIP_REQUIRED');
  return {uid:request.uid,businessId:request.businessId,role:member.role,identityActive:identity.active,membershipActive:member.active,projectIds:[...member.projectIds].sort()};
}
