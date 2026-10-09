import {createFirebaseNotificationPreparation} from './firebase-notifications.mjs';
import {createNotificationPlanner} from './notification-plan.mjs';
import {createFirebaseInvitations} from './firebase-invitations.mjs';
import {createFirebaseAdminAccessUpdater,createFirebaseColleagueAccessUpdater} from './firebase-provisioning.mjs';
import {initializeApp,applicationDefault,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {firebaseConfiguration} from './firebase-config.mjs';
import {FirestorePortal} from './firestore.mjs';
import {createFirebaseSessionResolver,createFirebaseInvitationIdentityResolver} from './firebase-auth.mjs';
export function createFirebaseBackend(config,{invitationPolicy}={}) {
  const checked=firebaseConfiguration(config);
  const options={projectId:checked.projectId};
  if(checked.mode==='live')options.credential=applicationDefault();
  const app=initializeApp(options,`wvd-${randomUUID()}`),db=getFirestore(app,checked.databaseId),auth=getAuth(app);
  const portal=new FirestorePortal({db,productId:checked.productId,backupBinding:checked,invitationPolicy});
  portal.updateAccessAsAdmin=createFirebaseAdminAccessUpdater({auth,portal});
  portal.updateColleagueAccess=createFirebaseColleagueAccessUpdater({auth,portal});
  const resolveSession=createFirebaseSessionResolver({auth,portal});
  const resolveInvitationIdentity=createFirebaseInvitationIdentityResolver({auth});
  const invitations=createFirebaseInvitations({auth,portal,resolveSession,resolveInvitationIdentity});
  return {portal,auth,db,resolveSession,resolveInvitationIdentity,invitations,prepareNotification:createFirebaseNotificationPreparation({auth,portal,productId:checked.productId}),planNotification:createNotificationPlanner({portal,productId:checked.productId}),close:async()=>{await db.terminate();await deleteApp(app);}};
}
