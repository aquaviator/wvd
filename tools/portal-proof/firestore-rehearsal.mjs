import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {verifyPortalBackup} from './backup.mjs';
import {firebaseConfiguration} from './firebase-config.mjs';
import {FirestorePortal} from './firestore.mjs';

// No caller-selected destination or live restore option. The SDK is loaded only
// after source integrity and loopback/demo-project isolation have been checked.
export async function rehearseFirestoreBackup(raw,expectedBinding) {
  const source=firebaseConfiguration(expectedBinding);
  if(source.mode!=='emulator')throw Error('ISOLATED_EMULATORS_REQUIRED');
  const verified=verifyPortalBackup(raw,source);
  const target={...source,productId:'restore-'+randomUUID()};
  const {initializeApp,deleteApp}=await import('firebase-admin/app');
  const {getFirestore}=await import('firebase-admin/firestore');
  const app=initializeApp({projectId:target.projectId},'rehearsal-'+randomUUID());
  const db=getFirestore(app,target.databaseId);
  const ref=db.doc(`wvd_products/${target.productId}/private/portal-state`);
  let created=false;
  try {
    // create, rather than set, makes even a namespace collision non-destructive.
    await ref.create({schemaVersion:1,revision:verified.sourceRevision,stateJson:JSON.stringify(verified.state)});
    created=true;
    const reopened=new FirestorePortal({db,productId:target.productId,backupBinding:target});
    const restored=await reopened.backupSnapshot();
    if(restored.revision!==verified.sourceRevision||!isDeepStrictEqual(restored.state,verified.state))throw Error('BACKUP_REHEARSAL_FAILED');
    return {verified:true,digest:verified.digest,sourceRevision:restored.revision,receipts:restored.state.receipts.length,feedback:restored.state.feedback.length,tickets:restored.state.tickets.length,replies:restored.state.replies.length,operatorEntries:restored.state.operatorAudit?.length??0,liveWrites:false};
  }finally {
    try {if(created)await ref.delete();}
    finally {try {await db.terminate();}finally {await deleteApp(app);}}
  }
}
