import {reviewDeliverable} from './deliverable.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
// Registered source metadata, not source discovery or proof of file access.
// Credentials, URLs and browser-authored source/version/digests are excluded.
export function createDeliverableCatalogue({portal,entries}) {
  if(typeof portal?.authorise!=='function'||!Array.isArray(entries)||entries.length>200)throw Error('INVALID_CONFIGURATION');
  let bound;
  try {
    bound=entries.map(entry=>{
      if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='id,manifest,projectId'||!id(entry.id)||typeof entry.projectId!=='string'||!entry.projectId.trim()||entry.projectId.length>128)throw Error();
      return {id:entry.id,projectId:entry.projectId,manifest:reviewDeliverable(entry.manifest)};
    });
    if(new Set(bound.map(x=>x.id)).size!==bound.length)throw Error();
  }catch{throw Error('INVALID_CONFIGURATION');}
  return {
    async list(actorId,projectId) {
      await portal.authorise(actorId,projectId,'manage-reviews');
      return bound.filter(x=>x.projectId===projectId).map(x=>({id:x.id,label:x.manifest.label,sourceVersion:x.manifest.sourceVersion,mediaType:x.manifest.mediaType}));
    },
    async resolve(actorId,projectId,entryId) {
      await portal.authorise(actorId,projectId,'manage-reviews');
      const entry=bound.find(x=>x.id===entryId&&x.projectId===projectId);
      if(!entry)throw Error('INVALID_DELIVERABLE');
      return structuredClone(entry.manifest);
    }
  };
}
