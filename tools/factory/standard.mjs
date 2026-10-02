import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const standard=JSON.parse(readFileSync(new URL('./development-standard.json',import.meta.url),'utf8'));
const catalogue=JSON.parse(readFileSync(new URL('./reuse-catalogue.json',import.meta.url),'utf8'));
const plain=value=>value && typeof value==='object' && !Array.isArray(value);
const id=value=>typeof value==='string' && /^[a-z][a-z0-9-]{1,62}$/.test(value);
const allowedKeys=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
export function developmentStandard() {return structuredClone(standard);}
export function reuseCatalogue() {return structuredClone(catalogue);}
export const standardHash=createHash('sha256').update(JSON.stringify({standard,catalogue})).digest('hex');

// Planning only: no provider API, account creation, copied secrets or deployment.
export function projectPlan(config) {
  if(!plain(config)||!allowedKeys(config,['productId','flavour','bindings','reuseDecisions'])||!id(config.productId)||!Object.hasOwn(standard.flavours,config.flavour))throw Error('Invalid product/flavour');
  const bindings=config.bindings;
  if(!plain(bindings)||!allowedKeys(bindings,['googleProjectId','hostingTarget','dataNamespace','credentialRef'])||!Object.hasOwn(bindings,'dataNamespace')||bindings.dataNamespace!==config.productId)throw Error('Explicit product-scoped bindings required');
  for(const key of ['googleProjectId','hostingTarget'])if(bindings[key]!==undefined&&bindings[key]!==null&&!id(bindings[key]))throw Error('Invalid Google target reference');
  if(bindings.credentialRef!==undefined&&bindings.credentialRef!==null&&(typeof bindings.credentialRef!=='string'||!/^[a-z][a-z0-9-]{1,62}\/[a-z][a-z0-9-]{1,62}$/.test(bindings.credentialRef)||!bindings.credentialRef.startsWith(`${config.productId}/`)))throw Error('Product-scoped credential reference required');
  if(!Array.isArray(config.reuseDecisions)||!config.reuseDecisions.length)throw Error('Reuse assessment required');
  const seen=new Set();
  for(const entry of config.reuseDecisions){
    if(!plain(entry)||!allowedKeys(entry,['assetId','decision','reason','evidenceRef'])||seen.has(entry.assetId)||!catalogue.assets.some(asset=>asset.id===entry.assetId)||!['reuse','adapt','not-suitable'].includes(entry.decision)||typeof entry.reason!=='string'||!entry.reason.trim()||entry.reason.length>1000||typeof entry.evidenceRef!=='string'||!entry.evidenceRef.trim()||entry.evidenceRef.length>300)throw Error('Invalid reuse decision/evidence');
    seen.add(entry.assetId);
  }
  const flavour=standard.flavours[config.flavour];
  if(flavour.reuseAssetIds.some(assetId=>!seen.has(assetId)))throw Error('Assess all baseline reuse candidates for this flavour');
  const missing=['googleProjectId',...(flavour.googleCapabilities.includes('hosting')?['hostingTarget']:[]),'credentialRef'].filter(key=>!bindings[key]);
  return {schemaVersion:1,productId:config.productId,flavour:config.flavour,standardId:standard.id,standardVersion:standard.version,standardHash,
    platform:'google',newServiceSubscriptionsAllowed:false,newExternalSpendGBP:0,
    bindings:structuredClone(bindings),reuseDecisions:structuredClone(config.reuseDecisions),
    discovery:missing.map(key=>`Verify existing Google ${key}`),
    readiness:'NOT_DEPLOYMENT_VERIFIED',provisioning:false,productionApprovalRequired:true};
}
