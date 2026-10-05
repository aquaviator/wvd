import {readFileSync} from 'node:fs';
const planes=['controller','ci','service'];
export function accessInventory(){return JSON.parse(readFileSync(new URL('./access-registry.json',import.meta.url),'utf8'));}
export function accessPlan(registry,{productId,capability,plane}){
 if(registry?.schemaVersion!==1||registry.productId!==productId||!Array.isArray(registry.connections)||typeof capability!=='string'||!planes.includes(plane))throw Error('INVALID_ACCESS_REQUEST');
 const matches=registry.connections.filter(c=>c.plane===plane&&c.capabilities.includes(capability));
 return {productId,capability,plane,status:matches.length?'DISCOVER_AND_VERIFY_EXISTING_ROUTE':'DISCOVER_CURRENT_TOOLS_BEFORE_REQUESTING_ACCESS',candidates:structuredClone(matches),currentlyVerified:false,grantsPermission:false};
}
export function validateAccessInventory(registry){
 if(registry?.schemaVersion!==1||registry.productId!=='wvd'||!Array.isArray(registry.connections)||!registry.connections.length)throw Error('INVALID_ACCESS_REGISTRY');
 const ids=new Set();
 for(const c of registry.connections){
  if(!c.id||ids.has(c.id)||!planes.includes(c.plane)||!Array.isArray(c.capabilities)||!c.capabilities.length||!c.identityRef||!c.credentialRef||!c.discovery||!['OBSERVED','VERIFIED'].includes(c.evidence?.status)||!c.evidence.source||!Array.isArray(c.limits)||!c.limits.length)throw Error('INVALID_ACCESS_ENTRY');
  if(Object.keys(c).some(k=>!['id','plane','capabilities','identityRef','credentialRef','discovery','evidence','limits'].includes(k)))throw Error('UNEXPECTED_ACCESS_FIELD');
  ids.add(c.id);
 }
 return {status:'ACCESS_INVENTORY_VALID',connections:ids.size,liveAccessVerified:false};
}
