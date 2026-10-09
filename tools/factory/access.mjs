import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const planes=['controller','ci','service'];
const text=(v,max=2000)=>typeof v==='string'&&v.length>0&&v.length<=max;
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const keys=(v,list)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>list.includes(k));
export function accessInventory(){return JSON.parse(readFileSync(new URL('./access-registry.json',import.meta.url),'utf8'));}
export function validateAccessInventory(registry){
 if(!keys(registry,['schemaVersion','productId','updatedAt','scope','connections'])||registry.schemaVersion!==1||!text(registry.productId,63)||!/^[a-z][a-z0-9-]+$/.test(registry.productId)||!instant(registry.updatedAt)||!text(registry.scope)||!Array.isArray(registry.connections)||registry.connections.length>100)throw Error('INVALID_ACCESS_REGISTRY');
 const ids=new Set();
 for(const c of registry.connections){
  if(!keys(c,['id','plane','capabilities','identityRef','credentialRef','discovery','evidence','limits'])||!text(c.id,100)||ids.has(c.id)||!planes.includes(c.plane)||!Array.isArray(c.capabilities)||!c.capabilities.length||c.capabilities.some(v=>!text(v,100))||new Set(c.capabilities).size!==c.capabilities.length||!text(c.identityRef)||!text(c.credentialRef)||!text(c.discovery)||!keys(c.evidence,['status','at','source'])||!['OBSERVED','VERIFIED','FAILED'].includes(c.evidence.status)||!(c.evidence.at===null||instant(c.evidence.at))||!text(c.evidence.source)||!Array.isArray(c.limits)||!c.limits.length||c.limits.some(v=>!text(v)))throw Error('INVALID_ACCESS_ENTRY');
  ids.add(c.id);
 }
 return {status:'ACCESS_INVENTORY_VALID',connections:ids.size,liveAccessVerified:false};
}
export function accessRegistryHash(registry){validateAccessInventory(registry);return createHash('sha256').update(JSON.stringify(registry)).digest('hex');}
export function accessPlan(registry,{productId,capability,plane}){
 validateAccessInventory(registry);
 if(registry.productId!==productId||!text(capability,100)||!planes.includes(plane))throw Error('INVALID_ACCESS_REQUEST');
 const matches=registry.connections.filter(c=>c.plane===plane&&c.capabilities.includes(capability));
 return {productId,capability,plane,registryHash:accessRegistryHash(registry),status:matches.length?'DISCOVER_AND_VERIFY_EXISTING_ROUTE':'DISCOVER_CURRENT_TOOLS_BEFORE_REQUESTING_ACCESS',candidates:structuredClone(matches),currentlyVerified:false,grantsPermission:false};
}
// Freshness is evaluated at execution time, never baked into a cached task packet.
export function assessAccessEvidence(plan,{now,maxAgeMs=3600000,availableConnectionIds=[]}){
 if(!instant(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>86400000||!Array.isArray(availableConnectionIds)||!Array.isArray(plan?.candidates))throw Error('INVALID_ACCESS_ASSESSMENT');
 return {registryHash:plan.registryHash,currentlyVerified:false,grantsPermission:false,candidates:plan.candidates.map(c=>{
  const age=c.evidence.at===null?null:Date.parse(now)-Date.parse(c.evidence.at);
  const state=c.plane==='controller'&&!availableConnectionIds.includes(c.id)?'SESSION_DISCOVERY_REQUIRED':c.evidence.status==='FAILED'?'RECHECK_LAST_FAILURE':age===null||age<0||age>maxAgeMs?'STALE_RECHECK_REQUIRED':'RECENT_EVIDENCE_RECHECK_TARGET';
  return {id:c.id,state,nextAction:c.discovery};
 })};
}
