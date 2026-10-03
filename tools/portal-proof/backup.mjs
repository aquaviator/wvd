import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {firebaseConfiguration} from './firebase-config.mjs';
import {validatePortalState} from './state.mjs';
import {MAX_STATE_BYTES} from './firestore.mjs';
import {DurablePortal} from './durable.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function binding(value) {
  // Pure validation only; these loopback references never open a connection.
  return firebaseConfiguration(value,value?.mode==='emulator'?{FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9097',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8087'}:{});
}
function payload({binding:target,sourceRevision,exportedAt,stateJson,schemaVersion}) {
  return {schemaVersion,binding:binding(target),sourceRevision,exportedAt,stateJson};
}
function checkedState(stateJson,revision) {
  if(typeof stateJson!=='string'||Buffer.byteLength(stateJson)>MAX_STATE_BYTES||!Number.isSafeInteger(revision)||revision<0)throw Error('INVALID_BACKUP');
  const state=validatePortalState(JSON.parse(stateJson));
  if(state.operatorAudit?.some(x=>x.revision>revision))throw Error('INVALID_BACKUP');
  return state;
}
export function createPortalBackup({state,sourceRevision,binding:target,exportedAt}) {
  const stateJson=JSON.stringify(state);checkedState(stateJson,sourceRevision);
  if(typeof exportedAt!=='string'||!Number.isFinite(Date.parse(exportedAt)))throw Error('INVALID_BACKUP');
  const data=payload({binding:target,sourceRevision,exportedAt,stateJson,schemaVersion:1});
  return JSON.stringify({...data,digest:hash(data)});
}
export function verifyPortalBackup(raw,expectedBinding) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_STATE_BYTES+4096)throw Error('INVALID_BACKUP');
  let envelope,data,state;
  try {
    envelope=JSON.parse(raw);
    if(!envelope||Object.keys(envelope).sort().join(',')!=='binding,digest,exportedAt,schemaVersion,sourceRevision,stateJson'||envelope.schemaVersion!==1||typeof envelope.exportedAt!=='string'||!Number.isFinite(Date.parse(envelope.exportedAt)))throw Error();
    data=payload(envelope);if(envelope.digest!==hash(data))throw Error();
    state=checkedState(data.stateJson,data.sourceRevision);
  }catch{throw Error('INVALID_BACKUP');}
  if(!isDeepStrictEqual(data.binding,binding(expectedBinding)))throw Error('BACKUP_SCOPE_DENIED');
  return {binding:structuredClone(data.binding),sourceRevision:data.sourceRevision,exportedAt:data.exportedAt,digest:envelope.digest,state};
}
// Isolated disk rehearsal only. No live writes, target path or overwrite option.
export function rehearsePortalBackup(raw,expectedBinding) {
  const verified=verifyPortalBackup(raw,expectedBinding);
  const directory=mkdtempSync(join(tmpdir(),'wvd-restore-rehearsal-'));let portal;
  try {
    const path=join(directory,'restored.sqlite');portal=new DurablePortal(path,verified.state);portal.close();portal=undefined;
    portal=new DurablePortal(path);const restored=portal.snapshot();
    if(!isDeepStrictEqual(restored,verified.state))throw Error('BACKUP_REHEARSAL_FAILED');
    return {verified:true,digest:verified.digest,sourceRevision:verified.sourceRevision,receipts:restored.receipts.length,feedback:restored.feedback.length,tickets:restored.tickets.length,replies:restored.replies.length,operatorEntries:restored.operatorAudit?.length??0,liveWrites:false};
  }finally{portal?.close();rmSync(directory,{recursive:true,force:true});}
}

// Privileged caller only; read state and revision from one document snapshot.
export async function exportPortalBackup(portal,target,clock=()=>new Date().toISOString()) {
  const checked=binding(target);
  if(typeof portal?.backupSnapshot!=='function'||typeof clock!=='function')throw Error('INVALID_BACKUP');
  const {state,revision,binding:sourceBinding}=await portal.backupSnapshot();
  if(!isDeepStrictEqual(binding(sourceBinding),checked))throw Error('BACKUP_SCOPE_DENIED');
  return createPortalBackup({state,sourceRevision:revision,binding:checked,exportedAt:clock()});
}
