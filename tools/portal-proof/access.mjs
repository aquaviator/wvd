// Shared trusted-operator input contract; no role or identity defaults.
export function accessGrant(request,{allowEmpty=false}={}) {
  const fields=['uid','businessId','role','projectIds'],text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=128;
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).length!==fields.length||!fields.every(key=>Object.hasOwn(request,key))||!text(request.uid)||!text(request.businessId)||!['Owner','Member'].includes(request.role)||!Array.isArray(request.projectIds)||(!allowEmpty&&!request.projectIds.length)||request.projectIds.length>50||request.projectIds.some(id=>!text(id))||new Set(request.projectIds).size!==request.projectIds.length)throw Error('INVALID_ACCESS_GRANT');
  return {uid:request.uid,businessId:request.businessId,role:request.role,projectIds:[...request.projectIds].sort()};
}
