import {readdirSync,statSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
// Screenshots and test receipts are required. Videos are supplementary and may
// be omitted, explicitly recorded, to preserve the existing artifact cost cap.
export function boundEvidence(directory,{limit=5242880,reserve=65536}={}) {
 if(!Number.isSafeInteger(limit)||limit<1024||limit>5242880||!Number.isSafeInteger(reserve)||reserve<512||reserve>=limit)throw Error('INVALID_EVIDENCE_BUDGET');
 const entries=readdirSync(directory,{withFileTypes:true}).map(entry=>{
  if(!entry.isFile())throw Error('UNEXPECTED_EVIDENCE_ENTRY');
  return {name:entry.name,size:statSync(join(directory,entry.name)).size};
 });
 let bytes=entries.reduce((sum,file)=>sum+file.size,0);const omitted=[];
 for(const file of entries.filter(x=>x.name.endsWith('.webm')).sort((a,b)=>b.size-a.size||a.name.localeCompare(b.name))){
  if(bytes<=limit-reserve)break;unlinkSync(join(directory,file.name));bytes-=file.size;omitted.push({name:file.name,bytes:file.size,reason:'SUPPLEMENTARY_VIDEO_EXCEEDS_BUDGET'});
 }
 if(bytes>limit-reserve)throw Error('REQUIRED_EVIDENCE_EXCEEDS_BUDGET');
 const manifest={limitBytes:limit,reservedBytes:reserve,retainedBytes:bytes,omitted};
 const encoded=JSON.stringify(manifest,null,2);if(Buffer.byteLength(encoded)>reserve)throw Error('EVIDENCE_MANIFEST_EXCEEDS_BUDGET');
 writeFileSync(join(directory,'evidence-budget.json'),encoded);return manifest;
}
