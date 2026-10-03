import {createFirebaseAdminAccessUpdater} from './firebase-provisioning.mjs';
import {initializeApp,applicationDefault,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {firebaseConfiguration} from './firebase-config.mjs';
import {FirestorePortal} from './firestore.mjs';
import {createFirebaseSessionResolver} from './firebase-auth.mjs';
export function createFirebaseBackend(config) {
  const checked=firebaseConfiguration(config);
  const options={projectId:checked.projectId};
  if(checked.mode==='live')options.credential=applicationDefault();
  const app=initializeApp(options,`wvd-${randomUUID()}`),db=getFirestore(app,checked.databaseId),auth=getAuth(app);
  const portal=new FirestorePortal({db,productId:checked.productId,backupBinding:checked});
  portal.updateAccessAsAdmin=createFirebaseAdminAccessUpdater({auth,portal});
  const resolveSession=createFirebaseSessionResolver({auth,portal});
  return {portal,auth,resolveSession,close:async()=>{await db.terminate();await deleteApp(app);}};
}
