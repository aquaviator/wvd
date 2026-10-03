import {createHash} from 'node:crypto';
const keys=['contentSha256','label','mediaType','sourceId','sourceVersion'];
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const proofs=new WeakMap();
// In-process capability, never accepted from JSON. Transactional approval checks
// current scope/review independently and cannot trust a caller's verified flag.
export function verifiedDeliverableProof(proof,{actorId,projectId,milestoneId,versionId,reviewDigest,deliverable,scope}) {
  const bound=proof&&typeof proof==='object'?proofs.get(proof):undefined;
  return Boolean(bound&&Date.now()<bound.expiresAt&&bound.actorId===actorId&&bound.scope===scope&&JSON.stringify(bound.request)===JSON.stringify({projectId,milestoneId,versionId,reviewDigest})&&JSON.stringify(bound.manifest)===JSON.stringify(reviewDeliverable(deliverable))&&proof.bytes instanceof Uint8Array&&createHash('sha256').update(proof.bytes).digest('hex')===bound.manifest.contentSha256);
}
// An opaque source reference is resolved by trusted composition, never a URL
// supplied to a network client. The digest describes bytes, not a mutable link.
export function reviewDeliverable(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.join(',')||!reference(value.sourceId)||!reference(value.sourceVersion)||typeof value.label!=='string'||!value.label.trim()||value.label.length>200||/[\x00-\x1f\x7f]/.test(value.label)||typeof value.contentSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.contentSha256)||!['text/plain','application/pdf','image/png','image/jpeg','application/zip'].includes(value.mediaType))throw Error('INVALID_DELIVERABLE');
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}

// Internal read capability only; no route, source discovery or credentials.
// source.readVersion must honour AbortSignal and its own provider timeout. Keep
// a capacity slot until it settles, even when the caller times out, so a broken
// adapter cannot create an unbounded set of abandoned provider reads.
export function createReviewDeliverableReader({portal,source,maxBytes,timeoutMs,maxConcurrentReads,proofMaxAgeMs}) {
  if(typeof portal?.projectOverview!=='function'||typeof portal?.deliverableScope!=='function'||typeof source?.readVersion!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>512*1024||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isSafeInteger(maxConcurrentReads)||maxConcurrentReads<1||maxConcurrentReads>20||!Number.isSafeInteger(proofMaxAgeMs)||proofMaxAgeMs<1||proofMaxAgeMs>60000)throw Error('INVALID_CONFIGURATION');
  const scope=portal.deliverableScope();let active=0;
  const find=async(actorId,{projectId,milestoneId,versionId,reviewDigest})=>{
    const view=await portal.projectOverview(actorId,projectId);
    const reviews=[...view.awaitingClient,...view.completedMilestones].filter(x=>x.id===milestoneId&&x.currentVersionId===versionId).map(x=>x.review);
    reviews.push(...view.approvalHistory.filter(x=>x.milestoneId===milestoneId&&x.versionId===versionId).map(x=>x.review));
    const review=reviews.find(x=>x?.digest===reviewDigest);
    if(!review?.deliverable)throw Error('DELIVERABLE_UNAVAILABLE');
    return reviewDeliverable(review.deliverable);
  };
  return async(actorId,request)=>{
    if(typeof actorId!=='string'||!actorId||!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).sort().join(',')!=='milestoneId,projectId,reviewDigest,versionId'||!['projectId','milestoneId','versionId'].every(key=>typeof request[key]==='string'&&request[key].trim()&&request[key].length<=128)||typeof request.reviewDigest!=='string'||!/^[a-f0-9]{64}$/.test(request.reviewDigest))throw Error('INVALID_DELIVERABLE');
    const bound=structuredClone(request),manifest=await find(actorId,bound);
    if(active>=maxConcurrentReads)throw Error('DELIVERABLE_SERVICE_UNAVAILABLE');
    active++;const controller=new AbortController();let timer;
    const read=Promise.resolve().then(()=>source.readVersion({projectId:bound.projectId,sourceId:manifest.sourceId,sourceVersion:manifest.sourceVersion,maxBytes,signal:controller.signal}));
    // Attach both settlement paths without creating an unhandled rejection.
    read.then(()=>{active--;},()=>{active--;});
    try {
      const result=await Promise.race([read,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DELIVERABLE_SERVICE_UNAVAILABLE'));},timeoutMs);})]);
      if(!result||result.sourceId!==manifest.sourceId||result.sourceVersion!==manifest.sourceVersion||result.mediaType!==manifest.mediaType||!(result.bytes instanceof Uint8Array)||result.bytes.byteLength<1||result.bytes.byteLength>maxBytes)throw Error('DELIVERABLE_CONTENT_CONFLICT');
      const bytes=Buffer.from(result.bytes);
      if(createHash('sha256').update(bytes).digest('hex')!==manifest.contentSha256)throw Error('DELIVERABLE_CONTENT_CONFLICT');
      const current=await find(actorId,bound);
      if(JSON.stringify(current)!==JSON.stringify(manifest))throw Error('DELIVERABLE_CONTENT_CONFLICT');
      const proof={reviewDigest:bound.reviewDigest,manifest:structuredClone(manifest),bytes};
      proofs.set(proof,{scope,actorId,request:{projectId:bound.projectId,milestoneId:bound.milestoneId,versionId:bound.versionId,reviewDigest:bound.reviewDigest},manifest:structuredClone(manifest),expiresAt:Date.now()+proofMaxAgeMs});
      return proof;
    }catch(error){
      if(['ACCESS_DENIED','DELIVERABLE_UNAVAILABLE','DELIVERABLE_CONTENT_CONFLICT'].includes(error?.message))throw Error(error.message);
      throw Error('DELIVERABLE_SERVICE_UNAVAILABLE');
    }finally {clearTimeout(timer);}
  };
}
