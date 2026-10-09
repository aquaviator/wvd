// Attribution is supplied by the privileged caller, not a verified IAM identity.
export function operatorContext(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='changeRef,operatorRef'||Object.values(value).some(x=>typeof x!=='string'||!x.trim()||x.length>128))throw Error('OPERATOR_CONTEXT_REQUIRED');
  return structuredClone(value);
}
export function validateOperatorAudit(state) {
  if(state.operatorAudit===undefined)return;
  const corrupt=()=>{throw Error('CORRUPT_PORTAL_STATE');};
  if(!Array.isArray(state.operatorAudit))corrupt();
  let previous=-1;
  for(const entry of state.operatorAudit) {
    if(!entry||typeof entry!=='object'||Array.isArray(entry))corrupt();
    try {operatorContext({operatorRef:entry.operatorRef,changeRef:entry.changeRef});}catch{corrupt();}
    if(!Number.isSafeInteger(entry.revision)||entry.revision<=previous||entry.revision<1||entry.id!==`operator-${entry.revision}`||!['provisionAccess','updateAccess','publishReview'].includes(entry.action)||typeof entry.timestamp!=='string'||!Number.isFinite(Date.parse(entry.timestamp)))corrupt();
    const fields=['id','revision','action','operatorRef','changeRef','timestamp',...(['provisionAccess','updateAccess'].includes(entry.action)?['uid','businessId','role','projectIds',...(entry.action==='updateAccess'?['previousProjectIds']:[])]:['projectId','milestoneId','versionId','digest'])].sort();
    if(Object.keys(entry).sort().join(',')!==fields.join(','))corrupt();
    if(['provisionAccess','updateAccess'].includes(entry.action)) {
      if(!state.identities.some(x=>x.id===entry.uid)||!['Owner','Member'].includes(entry.role)||!Array.isArray(entry.projectIds)||(entry.action==='provisionAccess'&&!entry.projectIds.length)||entry.projectIds.length>50||new Set(entry.projectIds).size!==entry.projectIds.length||entry.projectIds.some(id=>!state.projects.some(x=>x.id===id&&x.businessId===entry.businessId)))corrupt();
      if(entry.action==='updateAccess'&&(!Array.isArray(entry.previousProjectIds)||new Set(entry.previousProjectIds).size!==entry.previousProjectIds.length||entry.previousProjectIds.some(id=>!state.projects.some(x=>x.id===id&&x.businessId===entry.businessId))))corrupt();
    } else if(!state.milestones.find(x=>x.id===entry.milestoneId&&x.projectId===entry.projectId)?.reviews?.some(x=>x.versionId===entry.versionId&&x.digest===entry.digest))corrupt();
    previous=entry.revision;
  }
}
